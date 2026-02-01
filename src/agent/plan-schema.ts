import { z } from "zod";

export const PlanItemSchema = z.object({
  priority: z.enum(["P0", "P1", "P2"]),
  id: z.string(),
  threadId: z.string().optional(),
  from: z.string().optional(),
  subject: z.string().optional(),
  date: z.string().optional(),

  /** Why this item is classified at this priority (must reference subject/snippet evidence) */
  reason: z.string(),

  /** Next steps in plain Chinese, actionable */
  next_steps: z.array(z.string()).min(1),

  /** Optional follow-up data we would fetch if we executed the plan */
  fetch: z.enum(["none", "thread", "full_message"]).default("none"),
});

export const PlanSchema = z.object({
  run_id: z.string(),
  generated_at: z.string(),
  query: z.object({
    gmail_query: z.string(),
    max_results: z.number(),
  }),
  counts: z.object({
    total: z.number(),
    p0: z.number(),
    p1: z.number(),
    p2: z.number(),
  }),
  items: z.array(PlanItemSchema),
  notes: z.array(z.string()).optional(),
});

export type Plan = z.infer<typeof PlanSchema>;
