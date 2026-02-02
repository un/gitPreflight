import { sleep } from "workflow";

export type ReviewWorkflowInput = {
  branch: string;
  planTier: string;
  stagedPatch: string;
  stagedFiles: Array<{ path: string; changeType: string; isBinary: boolean }>;
  instructionFiles: Array<{ path: string; sha256: string }>;
};

export type ReviewWorkflowOutput = {
  status: "PASS" | "FAIL" | "UNCHECKED";
  findings: any[];
};

export async function reviewWorkflow(input: ReviewWorkflowInput): Promise<ReviewWorkflowOutput> {
  "use workflow";

  // v0 placeholder. Real orchestration lands in S151+.
  void input;

  await sleep(1);

  return {
    status: "PASS",
    findings: []
  };
}
