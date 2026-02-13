import { createError, ErrorCode } from "../../lib/errors";
import type { CompletionParams, CompletionResult, LLMProvider } from "../types";

export interface ZAIConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

interface ZAIResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
      reasoning_content?: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class ZAIProvider implements LLMProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config: ZAIConfig) {
    this.apiKey = config.apiKey;
    // If model looks like an OpenAI/other provider model, use Z.AI default
    const providedModel = config.model?.toLowerCase() ?? "";
    const isNonZAIModel =
      providedModel.includes("gpt") || providedModel.includes("claude") || providedModel.includes("gemini");
    this.model = isNonZAIModel ? "GLM-4.7" : (config.model ?? "GLM-4.7");
    this.baseUrl = (config.baseUrl ?? "https://api.z.ai/api/coding/paas/v4").trim().replace(/\/+$/, "");
  }

  private normalizeModel(model?: string): string {
    if (!model) return this.model;
    const lower = model.toLowerCase();
    const isNonZAIModel = lower.includes("gpt") || lower.includes("claude") || lower.includes("gemini");
    return isNonZAIModel ? this.model : model;
  }

  async complete(params: CompletionParams): Promise<CompletionResult> {
    const body: Record<string, unknown> = {
      model: this.normalizeModel(params.model),
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.max_tokens ?? 1024,
    };

    if (params.response_format) {
      body.response_format = params.response_format;
    }

    console.log(`[Z.AI] Request:`, {
      model: body.model,
      hasResponseFormat: !!params.response_format,
      responseFormat: params.response_format,
      maxTokens: body.max_tokens,
      messagesCount: params.messages.length,
    });

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Z.AI] API Error:`, {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText,
      });
      throw createError(ErrorCode.PROVIDER_ERROR, `Z.AI API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as ZAIResponse;

    console.log(`[Z.AI] Response:`, {
      id: data.id,
      choicesCount: data.choices.length,
      hasContent: !!data.choices[0]?.message?.content,
      contentLength: data.choices[0]?.message?.content?.length || 0,
      contentPreview: data.choices[0]?.message?.content?.substring(0, 200) || "EMPTY",
      finishReason: data.choices[0]?.finish_reason,
      usage: data.usage,
    });

    let content = data.choices[0]?.message?.content ?? "";
    const reasoningContent = data.choices[0]?.message?.reasoning_content;

    if (!content || content.trim() === "") {
      if (reasoningContent && data.choices[0]?.finish_reason === "length") {
        console.warn(
          `[Z.AI] Content empty due to token limit, reasoning model used all tokens on chain-of-thought. Consider increasing max_tokens.`
        );
      }
      console.error(`[Z.AI] Empty Response Detected:`, {
        fullResponse: JSON.stringify(data, null, 2),
        requestBody: JSON.stringify(body, null, 2),
      });
    }

    return {
      content,
      usage: {
        prompt_tokens: data.usage.prompt_tokens,
        completion_tokens: data.usage.completion_tokens,
        total_tokens: data.usage.total_tokens,
      },
    };
  }
}

export function createZAIProvider(config: ZAIConfig): ZAIProvider {
  return new ZAIProvider(config);
}
