import { afterEach, describe, it, expect, vi } from "vitest";
import {
  generateWithOwnKey,
  validKey,
  normalizeKey,
  listGeminiModels,
  connectAutomaticModel,
  generateWithAutomaticModel,
} from "../src/gemini";
import { demoEvent, initialBrief } from "../src/demo";
const key = "test_only_key_12345678901234567890";
const brief = { ...initialBrief, date: "2099-02-14" };
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("bring your own Gemini key", () => {
  it("sends the key only in a header to Google and validates structured output", async () => {
    const plan = demoEvent(brief).plan;
    const fetcher = vi.fn().mockResolvedValue({
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
      vi.fn().mockResolvedValue({
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

describe("key verification and model discovery", () => {
  it("accepts opaque keys with punctuation and longer authorization formats", () => {
    expect(validKey("test.auth." + "x".repeat(300) + "+/=")).toBe(true);
    expect(normalizeKey('  "test.key_123456789"  ')).toBe("test.key_123456789");
    expect(validKey("test key with spaces")).toBe(false);
    expect(validKey("test\r\nkey_12345678")).toBe(false);
  });
  it("lists compatible text models with header-only credentials and origin referrers", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          {
            name: "models/gemini-2.5-flash",
            supportedGenerationMethods: ["generateContent"],
          },
          {
            name: "models/gemini-image",
            supportedGenerationMethods: ["generateContent"],
          },
          {
            name: "models/gemini-embedding",
            supportedGenerationMethods: ["embedContent"],
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetcher);
    expect(await listGeminiModels(key)).toEqual(["gemini-2.5-flash"]);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).not.toContain(key);
    expect(options.headers["x-goog-api-key"]).toBe(key);
    expect(options.referrerPolicy).toBe("strict-origin-when-cross-origin");
    expect(options.body).toBeUndefined();
  });
  it("explains key and website restrictions without exposing upstream errors", async () => {
    for (const [reason, expected] of [
      ["API_KEY_INVALID", "Google rejected this API key"],
      ["API_KEY_HTTP_REFERRER_BLOCKED", "blocks this website"],
      ["API_KEY_SERVICE_BLOCKED", "cannot access the Gemini API"],
    ]) {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          json: async () => ({
            error: { message: key, details: [{ reason }] },
          }),
        }),
      );
      try {
        await listGeminiModels(key);
        throw new Error("Request should fail");
      } catch (error) {
        expect((error as Error).message).toContain(expected);
        expect((error as Error).message).not.toContain(key);
      }
    }
  });
});

describe("automatic model selection", () => {
  const listing = (names: string[]) => ({
    ok: true,
    json: async () => ({
      models: names.map((name) => ({
        name: "models/" + name,
        supportedGenerationMethods: ["generateContent"],
      })),
    }),
  });
  const probe = {
    ok: true,
    json: async () => ({
      candidates: [
        { content: { parts: [{ text: '{"ok":true}' }] }, finishReason: "STOP" },
      ],
    }),
  };
  it("tests a model before connecting and skips one without quota", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const path = String(url);
        calls.push(path);
        if (path.includes("/models?"))
          return listing(["gemini-2.5-flash-lite", "gemini-3.5-flash-lite"]);
        if (path.includes("gemini-3.5")) return { ok: false, status: 429 };
        return probe;
      }),
    );
    expect(await connectAutomaticModel(key)).toBe("gemini-2.5-flash-lite");
    expect(calls).toHaveLength(3);
    expect(calls[1]).toContain("gemini-3.5-flash-lite");
  });
  it("does not retry an invalid or blocked key against other models", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(
        listing(["gemini-3.5-flash-lite", "gemini-2.5-flash"]),
      )
      .mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: { details: [{ reason: "API_KEY_INVALID" }] },
        }),
      });
    vi.stubGlobal("fetch", f);
    await expect(connectAutomaticModel(key)).rejects.toThrow(
      "Google rejected this API key",
    );
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("limits model tests and never reports a connection if all fail", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(
        listing(
          Array.from({ length: 10 }, (_, i) => "gemini-3.0-flash-lite-" + i),
        ),
      )
      .mockResolvedValue({ ok: false, status: 429 });
    vi.stubGlobal("fetch", f);
    await expect(connectAutomaticModel(key)).rejects.toThrow(
      "none of the tested models",
    );
    expect(f).toHaveBeenCalledTimes(5);
  });
  it("rejects a successful HTTP response that cannot produce structured output", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(listing(["gemini-2.5-flash"]))
        .mockResolvedValue({
          ok: true,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: "not json" }] } }],
          }),
        }),
    );
    await expect(connectAutomaticModel(key)).rejects.toThrow(
      "none of the tested models",
    );
  });
  it("switches models during planning if the connected model disappears", async () => {
    const plan = demoEvent(brief).plan;
    const f = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce(listing(["gemini-2.5-flash-lite"]))
      .mockResolvedValueOnce({
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
    vi.stubGlobal("fetch", f);
    expect(
      await generateWithAutomaticModel(key, "gemini-old-flash", brief),
    ).toEqual({ model: "gemini-2.5-flash-lite", plan });
    expect(f).toHaveBeenCalledTimes(3);
  });
});

it("tries Flash as well as Flash-Lite instead of spending every attempt on older variants", async () => {
  const paths: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) => {
      const path = String(url);
      paths.push(path);
      if (path.includes("/models?"))
        return {
          ok: true,
          json: async () => ({
            models: [
              "gemini-3.5-flash-lite",
              "gemini-3.1-flash-lite",
              "gemini-2.5-flash-lite",
              "gemini-3.8-flash",
            ].map((name) => ({
              name: "models/" + name,
              supportedGenerationMethods: ["generateContent"],
            })),
          }),
        };
      if (path.includes("flash-lite")) return { ok: false, status: 429 };
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: { parts: [{ text: '{"ok":true}' }] },
              finishReason: "STOP",
            },
          ],
        }),
      };
    }),
  );
  expect(await connectAutomaticModel(key)).toBe("gemini-3.8-flash");
  expect(paths).toHaveLength(3);
});

describe("generation latency and cancellation", () => {
  const response = (data: unknown) => ({ ok: true, json: async () => data });
  const modelList = response({
    models: ["gemini-2.5-flash-lite", "gemini-3.8-flash"].map((name) => ({
      name: "models/" + name,
      supportedGenerationMethods: ["generateContent"],
    })),
  });
  const planReply = response({
    candidates: [
      {
        content: { parts: [{ text: JSON.stringify(demoEvent(brief).plan) }] },
        finishReason: "STOP",
      },
    ],
  });
  const waitForAbort = (signal: AbortSignal) =>
    new Promise((_resolve, reject) =>
      signal.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        { once: true },
      ),
    );
  it("aborts a slow first model and successfully completes with an alternative", async () => {
    vi.useFakeTimers();
    let attempt = 0;
    const progress: string[] = [];
    const f = vi.fn(async (url, options) => {
      if (String(url).includes("/models?")) return modelList;
      if (++attempt === 1) return waitForAbort(options.signal);
      return planReply;
    });
    vi.stubGlobal("fetch", f);
    const done = expect(
      generateWithAutomaticModel(key, "gemini-3.5-flash", brief, {
        onProgress: (text) => progress.push(text),
      }),
    ).resolves.toEqual({
      model: "gemini-2.5-flash-lite",
      plan: demoEvent(brief).plan,
    });
    await vi.advanceTimersByTimeAsync(40001);
    await done;
    expect(attempt).toBe(2);
    expect(progress.some((text) => text.includes("Trying another model"))).toBe(
      true,
    );
    expect(f.mock.calls[0][1].signal.aborted).toBe(true);
  });
  it("stops after the total deadline instead of retrying indefinitely", async () => {
    vi.useFakeTimers();
    const f = vi.fn(async (url, options) =>
      String(url).includes("/models?")
        ? modelList
        : waitForAbort(options.signal),
    );
    vi.stubGlobal("fetch", f);
    const done = expect(
      generateWithAutomaticModel(key, "gemini-3.5-flash", brief),
    ).rejects.toThrow("Gemini stayed busy");
    await vi.advanceTimersByTimeAsync(120001);
    await done;
    expect(f).toHaveBeenCalledTimes(4);
  });
  it("cancels the active request without trying another model", async () => {
    const controller = new AbortController();
    const f = vi.fn(async (_url, options) => waitForAbort(options.signal));
    vi.stubGlobal("fetch", f);
    const done = expect(
      generateWithAutomaticModel(key, "gemini-3.5-flash", brief, {
        signal: controller.signal,
      }),
    ).rejects.toThrow("cancelled");
    controller.abort();
    await done;
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("uses model-specific low-latency settings and a compact response schema", async () => {
    const f = vi.fn().mockResolvedValue(planReply);
    vi.stubGlobal("fetch", f);
    for (const [model, thinking] of [
      ["gemini-3.5-flash", { thinkingLevel: "low" }],
      ["gemini-3.5-flash-lite", { thinkingLevel: "minimal" }],
      ["gemini-2.5-flash", { thinkingBudget: 0 }],
    ] as const) {
      await generateWithOwnKey(key, model, brief);
      const body = JSON.parse(f.mock.calls.at(-1)![1].body);
      expect(body.generationConfig.thinkingConfig).toEqual(thinking);
      expect(body.generationConfig.maxOutputTokens).toBe(4096);
      expect(
        body.generationConfig.responseJsonSchema.properties.tasks.maxItems,
      ).toBe(10);
    }
  });
});
