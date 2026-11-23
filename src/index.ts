export class ChatSession {
  state: DurableObjectState;
  env: Env;
  messages: { role: string; content: string }[] = [];

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.state.blockConcurrencyWhile(async () => {
      this.messages = (await this.state.storage.get("messages")) || [];
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method === "POST") {
      const { message } = await request.json<{ message: string }>();
      this.messages.push({ role: "user", content: message });
      const result = await this.env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        messages: this.messages,
      });
      const reply = (result as any).response || "";
      this.messages.push({ role: "assistant", content: reply });
      await this.state.storage.put("messages", this.messages);
      return new Response(JSON.stringify({ reply, history: this.messages }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ history: this.messages }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}

export interface Env {
  AI: Ai;
  CHAT: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/chat" && request.method === "POST") {
      const id = env.CHAT.idFromName(url.searchParams.get("session") || "default");
      const stub = env.CHAT.get(id);
      return stub.fetch(request);
    }
    if (url.pathname === "/history") {
      const id = env.CHAT.idFromName(url.searchParams.get("session") || "default");
      const stub = env.CHAT.get(id);
      return stub.fetch(request);
    }
    return new Response("cf-ai-app: POST /chat?session=ID {message}", { status: 200 });
  },
};
