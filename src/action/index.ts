import * as core from "@actions/core";
import * as github from "@actions/github";
import { readActionConfig, resolveLanguage } from "./config";
import {
  assertInvokerPermission,
  getCommentBody,
  getInvokingUser,
  getPullNumber,
  loadPullRequest,
  publishReportComment,
} from "./github";
import { generateHtml } from "./provider";
import { buildModelRequest } from "./prompt";
import { createReportPayload, createReportUrl } from "./report";

const REPORT_MARKER = "<!-- pr-explainer-report -->";

export async function run(): Promise<void> {
  try {
    const config = readActionConfig(core.getInput);
    core.setSecret(config.githubToken);
    core.setSecret(config.apiKey);

    const commentBody = getCommentBody(github.context);
    if (
      github.context.eventName === "issue_comment" &&
      !commentBody?.trimStart().startsWith(config.command)
    ) {
      core.info(
        `Comment does not start with '${config.command}'; nothing to do.`,
      );
      return;
    }

    const octokit = github.getOctokit(config.githubToken);
    const pullNumber = getPullNumber(github.context, config.pullNumber);
    const invokingUser = getInvokingUser(github.context);

    await assertInvokerPermission(
      octokit,
      github.context,
      invokingUser,
      config.minimumPermission,
    );

    core.info(
      `Loading ${github.context.repo.owner}/${github.context.repo.repo}#${pullNumber}.`,
    );
    const pullRequest = await loadPullRequest(
      octokit,
      github.context,
      pullNumber,
      config.maxDiffChars,
    );
    const language = resolveLanguage(
      config.language,
      commentBody,
      config.command,
      `${pullRequest.title}\n${pullRequest.body}`,
    );
    const modelRequest = buildModelRequest(
      pullRequest,
      language,
      config.customInstructions,
    );

    core.info(
      `Generating a ${language} report with ${config.provider}/${config.model}.`,
    );
    const html = await generateHtml({
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model,
      reasoningEffort: config.reasoningEffort,
      instructions: modelRequest.instructions,
      input: modelRequest.input,
    });
    const payload = createReportPayload({
      language,
      title: pullRequest.title,
      repository: pullRequest.fullName,
      pullNumber,
      pullUrl: pullRequest.url,
      headSha: pullRequest.headSha,
      html,
    });
    const reportUrl = createReportUrl(
      config.viewerUrl,
      payload,
      config.maxUrlChars,
    );

    await publishReportComment(
      octokit,
      github.context,
      pullNumber,
      createCommentBody(
        reportUrl,
        language,
        config.provider,
        config.model,
        pullRequest.diffTruncated,
      ),
    );

    core.setOutput("report-url", reportUrl);
    core.setOutput("report-provider", config.provider);
    core.setOutput("report-model", config.model);
    core.setOutput("report-language", language);
    core.setOutput("report-bytes", Buffer.byteLength(html, "utf8").toString());
    await core.summary
      .addHeading("PR Explainer")
      .addLink("Open the interactive report", reportUrl)
      .addRaw(
        `\n\nLanguage: ${language} · Provider: ${config.provider} · Model: ${config.model}`,
      )
      .write();
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

function createCommentBody(
  reportUrl: string,
  language: string,
  provider: string,
  model: string,
  diffTruncated: boolean,
): string {
  const japanese = language.toLowerCase().startsWith("ja");
  const title = japanese
    ? "PRのHTML解説を生成しました"
    : "Interactive PR explanation ready";
  const link = japanese ? "HTML解説を開く" : "Open the HTML explanation";
  const warning = japanese
    ? "このURLを知っている人はレポートを閲覧できます。Private Repoではリンクを機密情報として扱ってください。"
    : "Anyone with this URL can read the report. Treat the link as sensitive when the pull request is private.";
  const truncation = diffTruncated
    ? japanese
      ? "\n\n> 一部の大きな差分は入力上限に合わせて省略されています。"
      : "\n\n> Parts of the diff were omitted to stay within the configured input limit."
    : "";

  return `${REPORT_MARKER}\n## ${title}\n\n[${link}](${reportUrl})\n\n<sub>${language} · ${provider}/${model}</sub>\n\n> ${warning}${truncation}`;
}

void run();
