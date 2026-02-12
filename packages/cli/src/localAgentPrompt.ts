type ReviewMode = "staged" | "push";

function formatInstructionSections(instructionFiles: Array<{ path: string; content: string }>): string {
  return instructionFiles
    .map((file) => {
      const clipped = file.content.length > 20_000 ? `${file.content.slice(0, 20_000)}\n\n(...truncated)` : file.content;
      return `--- ${file.path} ---\n${clipped.trimEnd()}\n--- end ${file.path} ---`;
    })
    .join("\n\n");
}

export function buildLocalAgentReviewPrompt(opts: {
  mode: ReviewMode;
  reviewPatch: string;
  instructionFiles: Array<{ path: string; content: string }>;
}) {
  const instructionSections = formatInstructionSections(opts.instructionFiles);

  return (
    `You are GitPreflight in local-agent mode. Review ONLY the ${opts.mode === "push" ? "push" : "staged"} patch.\n` +
    "Output MUST follow the GitPreflight Markdown contract:\n" +
    "- Start with '# GitPreflight Review'\n" +
    "- Include 'Result: PASS|FAIL|UNCHECKED'\n" +
    "- Include 'Counts: note=<n> minor=<n> major=<n>'\n" +
    "- Include '## Findings' grouped by file\n" +
    "- For each finding include Path/Severity/Agreement lines and optional ```suggestion blocks\n\n" +
    (instructionSections ? `Instruction files:\n\n${instructionSections}\n\n` : "") +
    `${opts.mode === "push" ? "Push patch" : "Staged patch"}:\n${opts.reviewPatch}`
  );
}
