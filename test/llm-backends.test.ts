import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import {
  BaseLLM,
  FunctionLLM,
  OpenAICompatibleLLM,
  TogetherLLM,
  FireworksLLM,
  OpenRouterLLM,
  DeepSeekLLM,
  CerebrasLLM,
  SambanovaLLM,
  OllamaLLM,
  GroqLLM,
} from "../src/llm-backends.js";

// ---------------------------------------------------------------------------
// Mock HTTP server
// ---------------------------------------------------------------------------

let server: Server;
let mockUrl: string;

beforeAll(async () => {
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      const parsed = body ? JSON.parse(body) : {};

      if (req.url?.includes("/chat/completions")) {
        const response = {
          choices: [
            {
              message: {
                content: `mock response for: ${parsed.model ?? "unknown"}`,
              },
            },
          ],
        };
        const payload = JSON.stringify(response);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(payload);
      } else if (req.url?.includes("/api/generate")) {
        const response = {
          response: `ollama mock for: ${parsed.model ?? "unknown"}`,
        };
        const payload = JSON.stringify(response);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(payload);
      } else {
        res.writeHead(404);
        res.end();
      }
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr && typeof addr !== "string") {
        mockUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

afterAll(() => {
  server.close();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BaseLLM", () => {
  it("should not have generate on base prototype", () => {
    // In TypeScript, abstract methods don't exist at runtime on the base class
    // @ts-expect-error — abstract class
    const llm = new BaseLLM();
    expect(typeof llm.generate).not.toBe("function");
  });

  it("should work as subclass", async () => {
    class MyLLM extends BaseLLM {
      async generate(prompt: string): Promise<string> {
        return `echo: ${prompt}`;
      }
    }

    const llm = new MyLLM();
    expect(await llm.generate("hello")).toBe("echo: hello");
    expect(llm.toString()).toContain("MyLLM");
  });
});

describe("FunctionLLM", () => {
  it("should work with basic function", async () => {
    const llm = new FunctionLLM((p) => p.toUpperCase());
    expect(await llm.generate("hello")).toBe("HELLO");
  });

  it("should reject non-function", () => {
    // @ts-expect-error — testing runtime check
    expect(() => new FunctionLLM("not a function")).toThrow(
      "Expected a function",
    );
  });

  it("should reject non-string return", async () => {
    // @ts-expect-error — testing runtime check
    const llm = new FunctionLLM(() => 42);
    await expect(llm.generate("test")).rejects.toThrow("must return string");
  });

  it("should show function name in toString", () => {
    function myFunc(p: string) {
      return p;
    }
    const llm = new FunctionLLM(myFunc);
    expect(llm.toString()).toContain("myFunc");
  });
});

describe("OpenAICompatibleLLM", () => {
  it("should generate via mock server", async () => {
    const llm = new OpenAICompatibleLLM({
      baseUrl: `${mockUrl}/v1`,
      model: "test-model",
    });
    const result = await llm.generate("test prompt");
    expect(result).toContain("test-model");
  });

  it("should work with api key", async () => {
    const llm = new OpenAICompatibleLLM({
      baseUrl: `${mockUrl}/v1`,
      model: "test-model",
      apiKey: "sk-test",
    });
    const result = await llm.generate("test");
    expect(result).toContain("mock response");
  });

  it("should show details in toString", () => {
    const llm = new OpenAICompatibleLLM({
      baseUrl: "https://api.example.com/v1",
      model: "my-model",
    });
    expect(llm.toString()).toContain("api.example.com");
    expect(llm.toString()).toContain("my-model");
  });
});

describe("convenience wrappers", () => {
  it("GroqLLM should initialize with api key", () => {
    const llm = new GroqLLM("test");
    expect(llm.apiKey).toBe("test");
    expect(llm.model).toContain("llama");
  });

  it("TogetherLLM should have correct URL", () => {
    const llm = new TogetherLLM("test");
    expect(llm.baseUrl).toContain("together.xyz");
  });

  it("FireworksLLM should have correct URL", () => {
    const llm = new FireworksLLM("test");
    expect(llm.baseUrl).toContain("fireworks.ai");
  });

  it("OpenRouterLLM should have correct URL", () => {
    const llm = new OpenRouterLLM("test");
    expect(llm.baseUrl).toContain("openrouter.ai");
  });

  it("DeepSeekLLM should have correct URL", () => {
    const llm = new DeepSeekLLM("test");
    expect(llm.baseUrl).toContain("deepseek.com");
  });

  it("CerebrasLLM should have correct URL", () => {
    const llm = new CerebrasLLM("test");
    expect(llm.baseUrl).toContain("cerebras.ai");
  });

  it("SambanovaLLM should have correct URL", () => {
    const llm = new SambanovaLLM("test");
    expect(llm.baseUrl).toContain("sambanova.ai");
  });

  it("wrapper should inherit generate", async () => {
    const llm = new TogetherLLM("test");
    llm.baseUrl = `${mockUrl}/v1`;
    const result = await llm.generate("test");
    expect(result).toContain("mock response");
  });
});

describe("OllamaLLM", () => {
  it("should generate via mock server", async () => {
    const llm = new OllamaLLM("test-model", mockUrl);
    const result = await llm.generate("test prompt");
    expect(result).toContain("test-model");
  });

  it("should show model in toString", () => {
    const llm = new OllamaLLM("llama3");
    expect(llm.toString()).toContain("llama3");
  });
});
