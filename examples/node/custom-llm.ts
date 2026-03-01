/**
 * Example: Creating a custom LLM backend (Node.js)
 *
 * Shows three ways to integrate any LLM with TreeDex:
 * 1. FunctionLLM — wrap a function
 * 2. BaseLLM subclass — full control
 * 3. Lambda — simplest
 */

import { BaseLLM, FunctionLLM } from "../../src/index.js";

// --- Method 1: FunctionLLM ---
// Wrap any function that takes string and returns string (or Promise<string>).

async function myApiCall(prompt: string): Promise<string> {
  const resp = await fetch("https://my-api.example.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "my-model",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const body = (await resp.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return body.choices[0].message.content;
}

// const llm = new FunctionLLM(myApiCall);

// --- Method 2: BaseLLM subclass ---
// Full control over initialization and generation.

class MyCustomLLM extends BaseLLM {
  private endpoint: string;
  private token: string;

  constructor(endpoint: string, token: string) {
    super();
    this.endpoint = endpoint;
    this.token = token;
  }

  async generate(prompt: string): Promise<string> {
    const resp = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ prompt }),
    });

    const body = (await resp.json()) as { text: string };
    return body.text;
  }
}

// const llm = new MyCustomLLM("https://...", "token");

// --- Method 3: Lambda (simplest) ---

// const llm = new FunctionLLM((p) => someExistingApi(p));

// --- Usage ---
// const index = await TreeDex.fromFile("doc.pdf", llm);
// const result = await index.query("What is the main argument?");

console.log("See the code for three ways to create custom LLM backends!");
console.log("1. new FunctionLLM(myFunction)");
console.log("2. class MyLLM extends BaseLLM { ... }");
console.log("3. new FunctionLLM((p) => ...)");
