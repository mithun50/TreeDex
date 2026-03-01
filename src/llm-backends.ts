/**
 * LLM backends for TreeDex.
 *
 * Hierarchy:
 *     BaseLLM                     — abstract base, subclass for custom LLMs
 *     ├── GeminiLLM               — Google Gemini (lazy SDK)
 *     ├── OpenAILLM               — OpenAI (lazy SDK)
 *     ├── ClaudeLLM               — Anthropic Claude (lazy SDK)
 *     ├── MistralLLM              — Mistral AI (lazy SDK)
 *     ├── CohereLLM               — Cohere (lazy SDK)
 *     ├── OpenAICompatibleLLM     — Any OpenAI-compatible endpoint (fetch)
 *     │   ├── GroqLLM             — Groq (pre-configured URL)
 *     │   ├── TogetherLLM         — Together AI (pre-configured URL)
 *     │   ├── FireworksLLM        — Fireworks AI (pre-configured URL)
 *     │   ├── OpenRouterLLM       — OpenRouter (pre-configured URL)
 *     │   ├── DeepSeekLLM         — DeepSeek (pre-configured URL)
 *     │   ├── CerebrasLLM         — Cerebras (pre-configured URL)
 *     │   └── SambanovaLLM        — SambaNova (pre-configured URL)
 *     ├── HuggingFaceLLM          — HuggingFace Inference API (fetch)
 *     ├── OllamaLLM               — Ollama native /api/generate (fetch)
 *     ├── LiteLLM                 — litellm wrapper (100+ providers)
 *     └── FunctionLLM             — Wrap any callable(str) -> str
 *
 * Named providers lazy-import their SDKs.
 * OpenAICompatibleLLM, HuggingFaceLLM, OllamaLLM use only fetch.
 */

// ---------------------------------------------------------------------------
// Base
// ---------------------------------------------------------------------------

/** Base class for all LLM backends. Subclass and implement generate(). */
export abstract class BaseLLM {
  abstract generate(prompt: string): Promise<string>;

  toString(): string {
    return `${this.constructor.name}()`;
  }
}

// ---------------------------------------------------------------------------
// Named SDK providers (lazy imports)
// ---------------------------------------------------------------------------

/** Google Gemini via @google/generative-ai SDK. */
export class GeminiLLM extends BaseLLM {
  readonly apiKey: string;
  readonly modelName: string;
  private _client: unknown = null;

  constructor(apiKey: string, model: string = "gemini-2.0-flash") {
    super();
    this.apiKey = apiKey;
    this.modelName = model;
  }

  private async getClient(): Promise<unknown> {
    if (this._client === null) {
      // @ts-expect-error -- optional peer dependency
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genai = new GoogleGenerativeAI(this.apiKey);
      this._client = genai.getGenerativeModel({ model: this.modelName });
    }
    return this._client;
  }

  async generate(prompt: string): Promise<string> {
    const model = await this.getClient() as { generateContent(p: string): Promise<{ response: { text(): string } }> };
    const response = await model.generateContent(prompt);
    return response.response.text();
  }

  toString(): string {
    return `GeminiLLM(model=${JSON.stringify(this.modelName)})`;
  }
}

/** OpenAI via openai SDK. */
export class OpenAILLM extends BaseLLM {
  readonly apiKey: string;
  readonly modelName: string;
  private _client: unknown = null;

  constructor(apiKey: string, model: string = "gpt-4o") {
    super();
    this.apiKey = apiKey;
    this.modelName = model;
  }

  private async getClient(): Promise<unknown> {
    if (this._client === null) {
      // @ts-expect-error -- optional peer dependency
      const { default: OpenAI } = await import("openai");
      this._client = new OpenAI({ apiKey: this.apiKey });
    }
    return this._client;
  }

  async generate(prompt: string): Promise<string> {
    const client = await this.getClient() as {
      chat: {
        completions: {
          create(opts: unknown): Promise<{
            choices: Array<{ message: { content: string } }>;
          }>;
        };
      };
    };
    const response = await client.chat.completions.create({
      model: this.modelName,
      messages: [{ role: "user", content: prompt }],
    });
    return response.choices[0].message.content;
  }

  toString(): string {
    return `OpenAILLM(model=${JSON.stringify(this.modelName)})`;
  }
}

/** Anthropic Claude via @anthropic-ai/sdk. */
export class ClaudeLLM extends BaseLLM {
  readonly apiKey: string;
  readonly modelName: string;
  private _client: unknown = null;

  constructor(apiKey: string, model: string = "claude-sonnet-4-20250514") {
    super();
    this.apiKey = apiKey;
    this.modelName = model;
  }

  private async getClient(): Promise<unknown> {
    if (this._client === null) {
      // @ts-expect-error -- optional peer dependency
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      this._client = new Anthropic({ apiKey: this.apiKey });
    }
    return this._client;
  }

  async generate(prompt: string): Promise<string> {
    const client = await this.getClient() as {
      messages: {
        create(opts: unknown): Promise<{
          content: Array<{ text: string }>;
        }>;
      };
    };
    const response = await client.messages.create({
      model: this.modelName,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    return response.content[0].text;
  }

  toString(): string {
    return `ClaudeLLM(model=${JSON.stringify(this.modelName)})`;
  }
}

/** Mistral AI via @mistralai/mistralai SDK. */
export class MistralLLM extends BaseLLM {
  readonly apiKey: string;
  readonly modelName: string;
  private _client: unknown = null;

  constructor(apiKey: string, model: string = "mistral-large-latest") {
    super();
    this.apiKey = apiKey;
    this.modelName = model;
  }

  private async getClient(): Promise<unknown> {
    if (this._client === null) {
      // @ts-expect-error -- optional peer dependency
      const { Mistral } = await import("@mistralai/mistralai");
      this._client = new Mistral({ apiKey: this.apiKey });
    }
    return this._client;
  }

  async generate(prompt: string): Promise<string> {
    const client = await this.getClient() as {
      chat: {
        complete(opts: unknown): Promise<{
          choices: Array<{ message: { content: string } }>;
        }>;
      };
    };
    const response = await client.chat.complete({
      model: this.modelName,
      messages: [{ role: "user", content: prompt }],
    });
    return response.choices[0].message.content;
  }

  toString(): string {
    return `MistralLLM(model=${JSON.stringify(this.modelName)})`;
  }
}

/** Cohere via cohere-ai SDK. */
export class CohereLLM extends BaseLLM {
  readonly apiKey: string;
  readonly modelName: string;
  private _client: unknown = null;

  constructor(apiKey: string, model: string = "command-r-plus") {
    super();
    this.apiKey = apiKey;
    this.modelName = model;
  }

  private async getClient(): Promise<unknown> {
    if (this._client === null) {
      // @ts-expect-error -- optional peer dependency
      const { CohereClientV2 } = await import("cohere-ai");
      this._client = new CohereClientV2({ token: this.apiKey });
    }
    return this._client;
  }

  async generate(prompt: string): Promise<string> {
    const client = await this.getClient() as {
      chat(opts: unknown): Promise<{
        message: { content: Array<{ text: string }> };
      }>;
    };
    const response = await client.chat({
      model: this.modelName,
      messages: [{ role: "user", content: prompt }],
    });
    return response.message.content[0].text;
  }

  toString(): string {
    return `CohereLLM(model=${JSON.stringify(this.modelName)})`;
  }
}

// ---------------------------------------------------------------------------
// OpenAI-compatible (fetch only) + convenience wrappers
// ---------------------------------------------------------------------------

/**
 * Universal backend for any OpenAI-compatible API endpoint.
 *
 * Works with: Groq, Together AI, Fireworks, vLLM, LM Studio,
 * OpenRouter, DeepSeek, Cerebras, SambaNova, Ollama (OpenAI mode),
 * and any other compatible service.
 */
export class OpenAICompatibleLLM extends BaseLLM {
  baseUrl: string;
  readonly model: string;
  readonly apiKey: string | null;
  readonly maxTokens: number;
  readonly temperature: number;
  readonly extraHeaders: Record<string, string>;
  readonly timeout: number;

  constructor(options: {
    baseUrl: string;
    model: string;
    apiKey?: string | null;
    maxTokens?: number;
    temperature?: number;
    extraHeaders?: Record<string, string>;
    timeout?: number;
  }) {
    super();
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.model = options.model;
    this.apiKey = options.apiKey ?? null;
    this.maxTokens = options.maxTokens ?? 4096;
    this.temperature = options.temperature ?? 0.0;
    this.extraHeaders = options.extraHeaders ?? {};
    this.timeout = options.timeout ?? 300_000;
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "TreeDex/0.1",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }
    Object.assign(headers, this.extraHeaders);
    return headers;
  }

  async generate(prompt: string): Promise<string> {
    const url = `${this.baseUrl}/chat/completions`;

    const payload = {
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: this.maxTokens,
      temperature: this.temperature,
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!resp.ok) {
      const errorBody = await resp.text();
      throw new Error(
        `API request failed (${resp.status}): ${errorBody}`,
      );
    }

    const body = (await resp.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    return body.choices[0].message.content;
  }

  toString(): string {
    return `OpenAICompatibleLLM(baseUrl=${JSON.stringify(this.baseUrl)}, model=${JSON.stringify(this.model)})`;
  }
}

/** Groq — fast LLM inference via groq SDK. */
export class GroqLLM extends BaseLLM {
  readonly apiKey: string;
  readonly model: string;
  private _client: unknown = null;

  constructor(apiKey: string, model: string = "llama-3.3-70b-versatile") {
    super();
    this.apiKey = apiKey;
    this.model = model;
  }

  private async getClient(): Promise<unknown> {
    if (this._client === null) {
      // @ts-expect-error -- optional peer dependency
      const { default: Groq } = await import("groq-sdk");
      this._client = new Groq({ apiKey: this.apiKey });
    }
    return this._client;
  }

  async generate(prompt: string): Promise<string> {
    const client = await this.getClient() as {
      chat: {
        completions: {
          create(opts: unknown): Promise<{
            choices: Array<{ message: { content: string } }>;
          }>;
        };
      };
    };
    const response = await client.chat.completions.create({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
    });
    return response.choices[0].message.content;
  }

  toString(): string {
    return `GroqLLM(model=${JSON.stringify(this.model)})`;
  }
}

/** Together AI — open-source models. Zero SDK dependencies. */
export class TogetherLLM extends OpenAICompatibleLLM {
  constructor(
    apiKey: string,
    model: string = "meta-llama/Llama-3-70b-chat-hf",
    options?: { maxTokens?: number; temperature?: number },
  ) {
    super({
      baseUrl: "https://api.together.xyz/v1",
      model,
      apiKey,
      ...options,
    });
  }

  toString(): string {
    return `TogetherLLM(model=${JSON.stringify(this.model)})`;
  }
}

/** Fireworks AI — fast open-source inference. Zero SDK dependencies. */
export class FireworksLLM extends OpenAICompatibleLLM {
  constructor(
    apiKey: string,
    model: string = "accounts/fireworks/models/llama-v3p1-70b-instruct",
    options?: { maxTokens?: number; temperature?: number },
  ) {
    super({
      baseUrl: "https://api.fireworks.ai/inference/v1",
      model,
      apiKey,
      ...options,
    });
  }

  toString(): string {
    return `FireworksLLM(model=${JSON.stringify(this.model)})`;
  }
}

/** OpenRouter — access any model via one API. Zero SDK dependencies. */
export class OpenRouterLLM extends OpenAICompatibleLLM {
  constructor(
    apiKey: string,
    model: string = "anthropic/claude-sonnet-4",
    options?: { maxTokens?: number; temperature?: number },
  ) {
    super({
      baseUrl: "https://openrouter.ai/api/v1",
      model,
      apiKey,
      ...options,
    });
  }

  toString(): string {
    return `OpenRouterLLM(model=${JSON.stringify(this.model)})`;
  }
}

/** DeepSeek — powerful reasoning models. Zero SDK dependencies. */
export class DeepSeekLLM extends OpenAICompatibleLLM {
  constructor(
    apiKey: string,
    model: string = "deepseek-chat",
    options?: { maxTokens?: number; temperature?: number },
  ) {
    super({
      baseUrl: "https://api.deepseek.com/v1",
      model,
      apiKey,
      ...options,
    });
  }

  toString(): string {
    return `DeepSeekLLM(model=${JSON.stringify(this.model)})`;
  }
}

/** Cerebras — ultra-fast inference. Zero SDK dependencies. */
export class CerebrasLLM extends OpenAICompatibleLLM {
  constructor(
    apiKey: string,
    model: string = "llama-3.3-70b",
    options?: { maxTokens?: number; temperature?: number },
  ) {
    super({
      baseUrl: "https://api.cerebras.ai/v1",
      model,
      apiKey,
      ...options,
    });
  }

  toString(): string {
    return `CerebrasLLM(model=${JSON.stringify(this.model)})`;
  }
}

/** SambaNova — fast AI inference. Zero SDK dependencies. */
export class SambanovaLLM extends OpenAICompatibleLLM {
  constructor(
    apiKey: string,
    model: string = "Meta-Llama-3.1-70B-Instruct",
    options?: { maxTokens?: number; temperature?: number },
  ) {
    super({
      baseUrl: "https://api.sambanova.ai/v1",
      model,
      apiKey,
      ...options,
    });
  }

  toString(): string {
    return `SambanovaLLM(model=${JSON.stringify(this.model)})`;
  }
}

// ---------------------------------------------------------------------------
// HuggingFace Inference API (fetch only)
// ---------------------------------------------------------------------------

/** HuggingFace Inference API. Zero SDK dependencies. */
export class HuggingFaceLLM extends BaseLLM {
  readonly apiKey: string;
  readonly model: string;
  readonly maxTokens: number;

  constructor(
    apiKey: string,
    model: string = "mistralai/Mistral-7B-Instruct-v0.3",
    maxTokens: number = 4096,
  ) {
    super();
    this.apiKey = apiKey;
    this.model = model;
    this.maxTokens = maxTokens;
  }

  async generate(prompt: string): Promise<string> {
    const url = `https://api-inference.huggingface.co/models/${this.model}/v1/chat/completions`;

    const payload = {
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: this.maxTokens,
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "TreeDex/0.1",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(300_000),
    });

    if (!resp.ok) {
      const errorBody = await resp.text();
      throw new Error(
        `HuggingFace request failed (${resp.status}): ${errorBody}`,
      );
    }

    const body = (await resp.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    return body.choices[0].message.content;
  }

  toString(): string {
    return `HuggingFaceLLM(model=${JSON.stringify(this.model)})`;
  }
}

// ---------------------------------------------------------------------------
// Ollama native
// ---------------------------------------------------------------------------

/** Ollama native backend using /api/generate endpoint. */
export class OllamaLLM extends BaseLLM {
  readonly model: string;
  baseUrl: string;

  constructor(
    model: string = "llama3",
    baseUrl: string = "http://localhost:11434",
  ) {
    super();
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async generate(prompt: string): Promise<string> {
    const url = `${this.baseUrl}/api/generate`;

    const payload = {
      model: this.model,
      prompt,
      stream: false,
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "TreeDex/0.1",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(300_000),
    });

    if (!resp.ok) {
      const errorBody = await resp.text();
      throw new Error(
        `Ollama request failed (${resp.status}): ${errorBody}`,
      );
    }

    const body = (await resp.json()) as { response: string };
    return body.response;
  }

  toString(): string {
    return `OllamaLLM(model=${JSON.stringify(this.model)})`;
  }
}

// ---------------------------------------------------------------------------
// FunctionLLM — wrap any callable
// ---------------------------------------------------------------------------

/** Wrap any async or sync function as an LLM backend. */
export class FunctionLLM extends BaseLLM {
  private readonly _fn: (prompt: string) => string | Promise<string>;

  constructor(fn: (prompt: string) => string | Promise<string>) {
    super();
    if (typeof fn !== "function") {
      throw new TypeError(`Expected a function, got ${typeof fn}`);
    }
    this._fn = fn;
  }

  async generate(prompt: string): Promise<string> {
    const result = await this._fn(prompt);
    if (typeof result !== "string") {
      throw new TypeError(
        `LLM function must return string, got ${typeof result}`,
      );
    }
    return result;
  }

  toString(): string {
    const name = this._fn.name || "anonymous";
    return `FunctionLLM(fn=${name})`;
  }
}
