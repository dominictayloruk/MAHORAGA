import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCode } from "../../lib/errors";
import { createZAIProvider, ZAIProvider } from "./z-ai";

describe("Z.AI Provider", () => {
  const mockFetch = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("createZAIProvider", () => {
    it("creates provider with required config", () => {
      const provider = createZAIProvider({ apiKey: "zai-test" });
      expect(provider).toBeInstanceOf(ZAIProvider);
    });

    it("creates provider with custom model", () => {
      const provider = createZAIProvider({
        apiKey: "zai-test",
        model: "zai-gpt-4",
      });
      expect(provider).toBeInstanceOf(ZAIProvider);
    });

    it("creates provider with custom base URL", () => {
      const provider = createZAIProvider({
        apiKey: "zai-test",
        baseUrl: "https://custom-zai.example.com",
      });
      expect(provider).toBeInstanceOf(ZAIProvider);
    });
  });

  describe("complete", () => {
    it("sends correct request to Z.AI API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "zai-chatcmpl-123",
          choices: [{ message: { role: "assistant", content: "Hello from Z.AI!" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      });

      const provider = createZAIProvider({ apiKey: "zai-test" });
      await provider.complete({
        messages: [{ role: "user", content: "Hi" }],
      });

      expect(mockFetch).toHaveBeenCalledOnce();
      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      const [url, options] = call;
      expect(url).toBe("https://api.z.ai/api/coding/paas/v4/chat/completions");
      expect(options.method).toBe("POST");
      expect(options.headers).toMatchObject({
        "Content-Type": "application/json",
        Authorization: "Bearer zai-test",
      });

      const body = JSON.parse(options.body as string);
      expect(body.messages).toEqual([{ role: "user", content: "Hi" }]);
    });

    it("returns completion result with content and usage", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "zai-chatcmpl-456",
          choices: [{ message: { role: "assistant", content: "Z.AI response" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
        }),
      });

      const provider = createZAIProvider({ apiKey: "zai-test" });
      const result = await provider.complete({
        messages: [{ role: "user", content: "Test" }],
      });

      expect(result.content).toBe("Z.AI response");
      expect(result.usage).toEqual({
        prompt_tokens: 20,
        completion_tokens: 10,
        total_tokens: 30,
      });
    });

    it("uses custom model when provided in params", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "zai-chatcmpl-789",
          choices: [{ message: { content: "Response" } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      });

      const provider = createZAIProvider({ apiKey: "zai-test", model: "zai-default" });
      await provider.complete({
        model: "zai-gpt-4",
        messages: [{ role: "user", content: "Test" }],
      });

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(call[1].body as string);
      expect(body.model).toBe("zai-gpt-4");
    });

    it("includes response_format when provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "zai-chatcmpl-999",
          choices: [{ message: { content: '{"key": "value"}' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      });

      const provider = createZAIProvider({ apiKey: "zai-test" });
      await provider.complete({
        messages: [{ role: "user", content: "Test" }],
        response_format: { type: "json_object" },
      });

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(call[1].body as string);
      expect(body.response_format).toEqual({ type: "json_object" });
    });

    it("uses default temperature and max_tokens", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "zai-chatcmpl-111",
          choices: [{ message: { content: "Response" } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      });

      const provider = createZAIProvider({ apiKey: "zai-test" });
      await provider.complete({
        messages: [{ role: "user", content: "Test" }],
      });

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(call[1].body as string);
      expect(body.temperature).toBe(0.7);
      expect(body.max_tokens).toBe(1024);
    });

    it("throws PROVIDER_ERROR on API failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      const provider = createZAIProvider({ apiKey: "zai-test" });

      await expect(provider.complete({ messages: [{ role: "user", content: "Test" }] })).rejects.toMatchObject({
        code: ErrorCode.PROVIDER_ERROR,
      });
    });

    it("throws PROVIDER_ERROR on 401 unauthorized", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Invalid API key",
      });

      const provider = createZAIProvider({ apiKey: "invalid-key" });

      await expect(provider.complete({ messages: [{ role: "user", content: "Test" }] })).rejects.toMatchObject({
        code: ErrorCode.PROVIDER_ERROR,
        message: expect.stringContaining("401"),
      });
    });

    it("handles empty content in response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "zai-chatcmpl-222",
          choices: [{ message: { role: "assistant" } }],
          usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
        }),
      });

      const provider = createZAIProvider({ apiKey: "zai-test" });
      const result = await provider.complete({
        messages: [{ role: "user", content: "Test" }],
      });

      expect(result.content).toBe("");
    });

    it("uses custom base URL when provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "zai-chatcmpl-333",
          choices: [{ message: { content: "Response" } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      });

      const provider = createZAIProvider({
        apiKey: "zai-test",
        baseUrl: "https://custom-zai.example.com",
      });
      await provider.complete({
        messages: [{ role: "user", content: "Test" }],
      });

      const call = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(call[0]).toBe("https://custom-zai.example.com/chat/completions");
    });
  });
});
