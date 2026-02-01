import { z } from "zod";

export const RefinedActionSchema = z.object({
  id: z.string(),
  priority: z.enum(["P0", "P1", "P2"]),
  title: z.string(),
  why: z.string(),
  steps: z.array(z.string()).min(1).max(6),
  requires_confirmation: z.boolean().default(true),
});

export const RefinedPlanSchema = z.object({
  run_id: z.string(),
  based_on_run_id: z.string(),
  generated_at: z.string(),
  summary: z.array(z.string()).min(1).max(10),
  actions: z.array(RefinedActionSchema),
  notes: z.array(z.string()).optional(),
});

export type RefinedPlan = z.infer<typeof RefinedPlanSchema>;
