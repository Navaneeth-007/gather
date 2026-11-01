import { z } from "zod";
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      !Number.isNaN(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s,
    "Choose a valid date",
  );
export const briefSchema = z
  .object({
    name: z.string().trim().min(3).max(90),
    type: z.enum(["Wedding", "Birthday", "Community"]),
    date: dateSchema,
    location: z.string().trim().min(2).max(100),
    guests: z.number().int().min(1).max(10000),
    budget: z.number().min(1000).max(100000000),
    currency: z.literal("INR"),
    preferences: z.string().trim().max(1500),
  })
  .strict();
export const budgetItemSchema = z
  .object({
    id: z.string().min(1).max(60),
    category: z.string().min(1).max(80),
    amount: z.number().finite().min(0).max(100000000),
    spent: z.number().finite().min(0).max(100000000),
  })
  .strict();
export const taskSchema = z
  .object({
    id: z.string().min(1).max(60),
    title: z.string().min(1).max(160),
    due: dateSchema,
    category: z.string().min(1).max(60),
    done: z.boolean(),
  })
  .strict();
export const vendorSchema = z
  .object({
    id: z.string().min(1).max(60),
    category: z.string().min(1).max(80),
    notes: z.string().max(500),
    status: z.enum(["To research", "Shortlisted", "Booked"]),
  })
  .strict();
export const ideaSchema = z
  .object({
    title: z.string().min(1).max(100),
    description: z.string().min(1).max(600),
  })
  .strict();
export const planSchema = z
  .object({
    summary: z.string().min(1).max(1000),
    budget: z.array(budgetItemSchema).min(1).max(20),
    tasks: z.array(taskSchema).min(1).max(40),
    vendors: z.array(vendorSchema).min(1).max(20),
    ideas: z.array(ideaSchema).min(1).max(10),
  })
  .strict()
  .superRefine((p, ctx) => {
    for (const key of ["budget", "tasks", "vendors"] as const) {
      if (new Set(p[key].map((x) => x.id)).size !== p[key].length)
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "Duplicate item IDs",
        });
    }
  });
export const eventSchema = z
  .object({
    brief: briefSchema,
    plan: planSchema,
    source: z.enum(["demo", "gemini"]),
    updatedAt: z.number(),
  })
  .strict();
export type Brief = z.infer<typeof briefSchema>;
export type Plan = z.infer<typeof planSchema>;
export type EventData = z.infer<typeof eventSchema>;
export function validateAllocation(plan: Plan, brief: Brief) {
  if (plan.budget.reduce((s, b) => s + b.amount, 0) > brief.budget)
    throw new Error(
      "The proposed allocations exceed the event budget. Please try again.",
    );
  if (plan.tasks.some((t) => t.due > brief.date))
    throw new Error("A task is scheduled after the event. Please try again.");
  return plan;
}
