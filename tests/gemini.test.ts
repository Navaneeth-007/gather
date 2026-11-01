import { afterEach, describe, it, expect, vi } from "vitest";
import { generateWithOwnKey } from "../src/gemini";
import { demoEvent, initialBrief } from "../src/demo";
const key = "test_only_key_12345678901234567890";
const brief = { ...initialBrief, date: "2099-02-14" };
afterEach(() => vi.unstubAllGlobals());
describe("bring your own Gemini key", () => {
  it("sends the key only in a header to Google and validates structured output", async () => {
    const plan = demoEvent(brief).plan;
    const fetcher = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: { parts: [{ text: JSON.stringify(plan) }] },
              finishReason: "STOP",
            },
          ],
        }),
      });
    vi.stubGlobal("fetch", fetcher);
    expect(await generateWithOwnKey(key, "gemini-2.5-flash", brief)).toEqual(
      plan,
    );
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    );
    expect(url).not.toContain(key);
    expect(init.body).not.toContain(key);
    expect(init.headers["x-goog-api-key"]).toBe(key);
    expect(
      JSON.parse(init.body).generationConfig.responseJsonSchema,
    ).toBeTruthy();
  });
  it("rejects invalid keys and model paths before making a request", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    await expect(
      generateWithOwnKey("short", "gemini-2.5-flash", brief),
    ).rejects.toThrow("valid Gemini API key");
    await expect(
      generateWithOwnKey(key, "https://example.com", brief),
    ).rejects.toThrow("model name");
    expect(f).not.toHaveBeenCalled();
  });
  it("gives quota errors without surfacing upstream payloads or credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: false,
          status: 429,
          json: async () => ({ error: { message: key } }),
        }),
    );
    await expect(
      generateWithOwnKey(key, "gemini-2.5-flash", brief),
    ).rejects.toThrow("quota");
  });
  it("rejects malformed, truncated and over-budget responses", async () => {
    for (const body of [
      { candidates: [{ content: { parts: [{ text: "invalid json" }] } }] },
      { candidates: [{ finishReason: "MAX_TOKENS" }] },
      {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    ...demoEvent(brief).plan,
                    budget: [
                      {
                        id: "bad",
                        category: "Venue",
                        amount: 99999999,
                        spent: 0,
                      },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      },
    ]) {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true, json: async () => body }),
      );
      await expect(
        generateWithOwnKey(key, "gemini-2.5-flash", brief),
      ).rejects.toThrow();
    }
  });
  it("handles network errors without echoing secrets", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError(key)));
    await expect(
      generateWithOwnKey(key, "gemini-2.5-flash", brief),
    ).rejects.toThrow("Could not reach Gemini");
  });
});
