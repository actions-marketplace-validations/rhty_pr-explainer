(() => {
  const mermaid = globalThis.mermaid;
  if (!mermaid) return;

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    maxTextSize: 50_000,
    maxEdges: 500,
    theme: "default",
  });
  void mermaid
    .run({ nodes: document.querySelectorAll(".mermaid") })
    .catch((error) => {
      console.warn("PR Explainer could not render a Mermaid diagram.", error);
    });
})();
