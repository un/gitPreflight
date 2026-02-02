export type Severity = "note" | "minor" | "major";

export type ReviewStatus = "PASS" | "FAIL" | "UNCHECKED";

export type Agreement = {
  agreed: number;
  total: number;
};

export type Finding = {
  path: string;
  severity: Severity;
  title: string;
  message: string;

  line?: number;
  hunk?: string;
  suggestion?: string;
  agreement?: Agreement;

  // Optional diagnostic metadata (not required for Markdown output).
  modelVotes?: string[];
};

export type ReviewResult = {
  status: ReviewStatus;
  findings: Finding[];
};
