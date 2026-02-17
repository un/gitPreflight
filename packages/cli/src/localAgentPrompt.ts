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
  const modeLabel = opts.mode === "push" ? "push" : "staged";

  const sections: string[] = [
    `You are GitPreflight, a local code review agent. Review ONLY the ${modeLabel} patch.`,
    "Primary objective: block changes that make future LLM-driven maintenance less reliable.",
    "",
    "Return ONLY markdown that matches this exact contract (no extra text before or after):",
    "# GitPreflight Review",
    "",
    "Result: PASS|FAIL|UNCHECKED",
    "Counts: note=<n> minor=<n> major=<n>",
    "",
    "## Findings",
    "",
    "### <repo-relative-path>",
    "",
    "#### <short title>",
    "Path: <repo-relative-path>",
    "Line: <line number> (optional)",
    "Severity: note|minor|major",
    "Agreement: <agreed>/<total>",
    "",
    "<clear explanation and concrete fix>",
    "",
    "Rules:",
    "- Keep labels exactly as written (Result/Counts/Findings/Path/Line/Severity/Agreement).",
    "- Result semantics: use FAIL only when at least one major finding exists.",
    "- If findings are only minor/note, use PASS and still report them in Findings.",
    "- Use UNCHECKED only when you cannot evaluate the patch reliably.",
    "- Counts must exactly match findings by severity.",
    "- If there are no findings, write `(none)` directly under `## Findings`.",
    "- Focus on concrete, code-level issues in the provided patch.",
    "- Use major for blockers, minor for should-fix, note for informational guidance.",
    "- Be concise, direct, and specific.",
    "",
    "Review priorities (in order):",
    "1) Correctness and failure modes: partial failures, retries, idempotency, and rollback clarity.",
    "2) Maintainability for LLMs: naming consistency, explicit intent, and low ambiguity under partial context.",
    "3) Change coupling and rollout safety: hidden deploy ordering assumptions and backward compatibility risks.",
    "4) Scope control: oversized mixed-concern changes, repeated logic, and hard-to-follow sequencing.",
    "5) Ownership clarity: classify findings as ADDED_BY_PR, MODIFIED_BY_PR, or DEPENDENCY_DEBT.",
    "",
    "Database/migration-specific checks (when relevant):",
    "- Ensure migrations are split into clear sequential steps with predictable ordering.",
    "- Flag mixed concerns (schema + data backfill + behavior change in one step).",
    "- Explicitly evaluate retry safety, idempotency, and partial-failure recovery.",
    "- Call out one-way changes with unclear rollback expectations.",
    "- Verify schema naming consistency and avoid overloaded/ambiguous fields.",
    "- Flag app/deploy coupling assumptions that can break staggered rollouts.",
    "",
    "Severity policy:",
    "- major: merge-blocking correctness, safety, or maintainability risk.",
    "- minor: should-fix issue with real cost but not immediately blocking.",
    "- note: informational improvement.",
    "",
    "When flagging an issue, explain:",
    "- The concrete failure mode.",
    "- Why an LLM maintainer would likely misread or mishandle it later.",
    "- The smallest concrete fix.",
    "- Whether it should block merge or be tracked as follow-up.",
    "",
    "Before returning, double-check that your `Counts` line exactly matches all findings by severity.",
    ""
  ];

  if (instructionSections) {
    sections.push("Instruction files:");
    sections.push("");
    sections.push(instructionSections);
    sections.push("");
  }

  sections.push(`${opts.mode === "push" ? "Push patch" : "Staged patch"}:`);
  sections.push(opts.reviewPatch);

  return sections.join("\n");
}
