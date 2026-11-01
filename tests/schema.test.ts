import { describe, it, expect } from "vitest";
import {
  briefSchema,
  planSchema,
  eventSchema,
  validateAllocation,
} from "../shared/schema";
import { demoEvent, initialBrief } from "../src/demo";
describe("event contract", () => {
  it("creates valid sample plans for all event types and budgets", () => {
    for (const type of ["Wedding", "Birthday", "Community"] as const) {
      const e = demoEvent({ ...initialBrief, type, budget: 1001 });
      expect(eventSchema.safeParse(e).success).toBe(true);
      expect(() => validateAllocation(e.plan, e.brief)).not.toThrow();
    }
  });
  it("rejects impossible dates, unknown fields, and invalid numbers", () => {
    for (const patch of [
      { date: "2027-02-30" },
      { guests: 0 },
      { guests: 2.5 },
      { budget: NaN },
      { preferences: "a".repeat(1501) },
      { apiKey: "secret" },
    ])
      expect(briefSchema.safeParse({ ...initialBrief, ...patch }).success).toBe(
        false,
      );
  });
  it("rejects overspending and tasks after the event in generated plans", () => {
    const e = demoEvent();
    e.plan.budget[0].amount = 900000;
    expect(() => validateAllocation(e.plan, e.brief)).toThrow();
    const clean = demoEvent();
    clean.plan.tasks[0].due = "2028-01-01";
    expect(() => validateAllocation(clean.plan, clean.brief)).toThrow();
  });
  it("rejects malformed AI responses and duplicate IDs", () => {
    const p = demoEvent().plan;
    p.tasks[1].id = p.tasks[0].id;
    expect(planSchema.safeParse(p).success).toBe(false);
    expect(planSchema.safeParse({ summary: "hello" }).success).toBe(false);
  });
});
