import { createHash } from "node:crypto";
import * as github from "@actions/github";
import { hasRequiredPermission, type PermissionLevel } from "./config";

type Octokit = ReturnType<typeof github.getOctokit>;
type GitHubContext = typeof github.context;

export interface PullRequestFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  blobUrl: string;
  diffUrl: string;
  patch?: string;
  patchUnavailable: boolean;
  patchTruncated: boolean;
}

export interface PullRequestData {
  owner: string;
  repository: string;
  fullName: string;
  number: number;
  title: string;
  body: string;
  author: string;
  baseRef: string;
  baseSha: string;
  headRef: string;
  headSha: string;
  url: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  filesIncluded: number;
  filesOmitted: number;
  patchCharactersIncluded: number;
  diffTruncated: boolean;
  files: PullRequestFile[];
}

export function getPullNumber(
  context: GitHubContext,
  configuredPullNumber?: number,
): number {
  if (configuredPullNumber) return configuredPullNumber;

  const issue = context.payload.issue as { number?: unknown } | undefined;
  const pullRequest = context.payload.pull_request as
    { number?: unknown } | undefined;
  const candidate = issue?.number ?? pullRequest?.number;

  if (typeof candidate !== "number" || !Number.isInteger(candidate)) {
    throw new Error(
      "Could not infer a pull request number from this event. Set the pull-number input.",
    );
  }

  return candidate;
}

export function getCommentBody(context: GitHubContext): string | undefined {
  const comment = context.payload.comment as { body?: unknown } | undefined;
  return typeof comment?.body === "string" ? comment.body : undefined;
}

export function getInvokingUser(context: GitHubContext): string {
  const comment = context.payload.comment as
    { user?: { login?: unknown } } | undefined;
  return typeof comment?.user?.login === "string"
    ? comment.user.login
    : context.actor;
}

export async function assertInvokerPermission(
  octokit: Octokit,
  context: GitHubContext,
  username: string,
  minimumPermission: PermissionLevel,
): Promise<void> {
  const { owner, repo } = context.repo;
  const response = await octokit.rest.repos.getCollaboratorPermissionLevel({
    owner,
    repo,
    username,
  });
  const actual = normalizePermission(response.data.permission);

  if (!hasRequiredPermission(actual, minimumPermission)) {
    throw new Error(
      `@${username} has '${actual}' permission, but '${minimumPermission}' is required to generate a report.`,
    );
  }
}

export async function loadPullRequest(
  octokit: Octokit,
  context: GitHubContext,
  pullNumber: number,
  maxDiffChars: number,
): Promise<PullRequestData> {
  const { owner, repo } = context.repo;
  const [{ data: pullRequest }, allFiles] = await Promise.all([
    octokit.rest.pulls.get({ owner, repo, pull_number: pullNumber }),
    octokit.paginate(octokit.rest.pulls.listFiles, {
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    }),
  ]);

  const selectedFiles = allFiles.slice(0, 500);
  let remainingPatchCharacters = maxDiffChars;
  let patchCharactersIncluded = 0;
  let diffTruncated = allFiles.length > selectedFiles.length;

  const files: PullRequestFile[] = selectedFiles.map((file) => {
    const originalPatch = file.patch ?? "";
    const patchUnavailable = file.patch === undefined && file.changes > 0;
    const perFileLimit = Math.min(30_000, remainingPatchCharacters);
    const patch = originalPatch.slice(0, perFileLimit);
    const patchTruncated = patch.length < originalPatch.length;

    remainingPatchCharacters -= patch.length;
    patchCharactersIncluded += patch.length;
    diffTruncated ||= patchTruncated || patchUnavailable;

    return {
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      blobUrl: createBlobUrl(owner, repo, pullRequest.head.sha, file.filename),
      diffUrl: `${pullRequest.html_url}/files#diff-${createHash("sha256").update(file.filename).digest("hex")}`,
      patch: patch || undefined,
      patchUnavailable,
      patchTruncated,
    };
  });

  return {
    owner,
    repository: repo,
    fullName: `${owner}/${repo}`,
    number: pullRequest.number,
    title: pullRequest.title,
    body: (pullRequest.body ?? "").slice(0, 30_000),
    author: pullRequest.user?.login ?? "unknown",
    baseRef: pullRequest.base.ref,
    baseSha: pullRequest.base.sha,
    headRef: pullRequest.head.ref,
    headSha: pullRequest.head.sha,
    url: pullRequest.html_url,
    additions: pullRequest.additions,
    deletions: pullRequest.deletions,
    changedFiles: pullRequest.changed_files,
    filesIncluded: files.length,
    filesOmitted: Math.max(0, allFiles.length - files.length),
    patchCharactersIncluded,
    diffTruncated,
    files,
  };
}

export async function publishReportComment(
  octokit: Octokit,
  context: GitHubContext,
  pullNumber: number,
  body: string,
): Promise<void> {
  const { owner, repo } = context.repo;
  const marker = "<!-- pr-explainer-report -->";
  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    owner,
    repo,
    issue_number: pullNumber,
    per_page: 100,
  });
  const existing = [...comments]
    .reverse()
    .find(
      (comment) =>
        comment.user?.type === "Bot" && comment.body?.includes(marker),
    );

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
    return;
  }

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: pullNumber,
    body,
  });
}

function createBlobUrl(
  owner: string,
  repo: string,
  sha: string,
  filename: string,
): string {
  const encodedPath = filename
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/blob/${sha}/${encodedPath}`;
}

function normalizePermission(permission: string): PermissionLevel {
  if (
    permission === "admin" ||
    permission === "maintain" ||
    permission === "write" ||
    permission === "triage" ||
    permission === "read"
  ) {
    return permission;
  }
  return "none";
}
