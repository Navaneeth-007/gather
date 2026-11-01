import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
beforeEach(() => {
  localStorage.clear();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("planner interactions", () => {
  it("edits budgets, tasks and vendor status, retaining changes locally", async () => {
    const u = userEvent.setup();
    render(<App />);
    await u.click(screen.getByRole("button", { name: "Budget" }));
    const amount = screen.getByLabelText("Venue & rentals spent");
    await u.clear(amount);
    await u.type(amount, "5000");
    expect(
      JSON.parse(localStorage.getItem("gather-demo")!).plan.budget[0].spent,
    ).toBe(5000);
    await u.click(screen.getByRole("button", { name: "Timeline" }));
    await u.click(
      screen.getByLabelText("Complete Find a venue that feels like you"),
    );
    expect(
      JSON.parse(localStorage.getItem("gather-demo")!).plan.tasks[0].done,
    ).toBe(true);
    await u.click(screen.getByRole("button", { name: "Vendors" }));
    await u.selectOptions(
      screen.getAllByLabelText("Booking status")[0],
      "Booked",
    );
    expect(
      JSON.parse(localStorage.getItem("gather-demo")!).plan.vendors[0].status,
    ).toBe("Booked");
  });
  it("creates a clearly labeled sample for a different event", async () => {
    const u = userEvent.setup();
    render(<App />);
    await u.click(screen.getByRole("button", { name: "New event" }));
    await u.click(screen.getByRole("button", { name: "Birthday" }));
    await u.type(screen.getByLabelText("Event name"), "Maya’s birthday");
    await u.click(screen.getByRole("button", { name: "Create a sample plan" }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Maya’s birthday" }),
      ).toBeTruthy(),
    );
    expect(screen.getByText("SAMPLE PLAN")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Sample plan");
  });
  it("recovers corrupt local data and offers key setup without an account", async () => {
    localStorage.setItem("gather-demo", "broken");
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Ananya & Aarav’s wedding" }),
    ).toBeTruthy();
    await userEvent.click(
      screen.getByRole("button", { name: "Add Gemini key" }),
    );
    expect(screen.getByLabelText("Gemini API key")).toBeTruthy();
  });
});

it("uses a memory-only key without an account and can remove it", async () => {
  const u = userEvent.setup();
  const secret = "test_only_key_12345678901234567890";
  const { demoEvent } = await import("../src/demo");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init.body));
      const brief = JSON.parse(body.contents[0].parts[0].text);
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(demoEvent(brief).plan) }],
              },
              finishReason: "STOP",
            },
          ],
        }),
      };
    }),
  );
  render(<App />);
  await u.click(screen.getByRole("button", { name: "Add Gemini key" }));
  await u.type(screen.getByLabelText("Gemini API key"), secret);
  await u.click(screen.getByRole("button", { name: "Use my key" }));
  expect(screen.queryByDisplayValue(secret)).toBeNull();
  expect(localStorage.getItem("gather-demo")).not.toContain(secret);
  await u.click(screen.getByRole("button", { name: "New event" }));
  await u.type(screen.getByLabelText("Event name"), "A Gemini celebration");
  await u.click(
    screen.getByRole("button", { name: "Create my plan with Gemini" }),
  );
  await waitFor(() => expect(screen.getByText("GEMINI PLAN")).toBeTruthy());
  expect(
    screen.getByRole("heading", { name: "A Gemini celebration" }),
  ).toBeTruthy();
  expect(localStorage.getItem("gather-demo")).not.toContain(secret);
  await u.click(screen.getByRole("button", { name: "AI connected" }));
  await u.click(screen.getByRole("button", { name: "Remove key" }));
  expect(screen.getByRole("button", { name: "Add Gemini key" })).toBeTruthy();
});
it("retains the existing plan when Gemini rejects a request", async () => {
  const u = userEvent.setup();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));
  render(<App />);
  await u.click(screen.getByRole("button", { name: "Add Gemini key" }));
  await u.type(
    screen.getByLabelText("Gemini API key"),
    "test_only_key_12345678901234567890",
  );
  await u.click(screen.getByRole("button", { name: "Use my key" }));
  await u.click(screen.getByRole("button", { name: "New event" }));
  await u.type(screen.getByLabelText("Event name"), "Rejected celebration");
  await u.click(
    screen.getByRole("button", { name: "Create my plan with Gemini" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain(
      "Google denied access",
    ),
  );
  expect(JSON.parse(localStorage.getItem("gather-demo")!).brief.name).toBe(
    "Ananya & Aarav’s wedding",
  );
});
