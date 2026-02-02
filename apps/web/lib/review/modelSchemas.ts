import { z } from "zod";

export const SeveritySchema = z.enum(["note", "minor", "major"]);

export const FindingSchema = z.object({
  path: z.string().min(1),
  severity: SeveritySchema,
  title: z.string().min(1),
  message: z.string().min(1),
  line: z.number().int().positive().optional(),
  hunk: z.string().optional(),
  suggestion: z.string().optional()
});

export const ModelOutputSchema = z.object({
  findings: z.array(FindingSchema)
});

export type ParsedModelOutput = z.infer<typeof ModelOutputSchema>;
