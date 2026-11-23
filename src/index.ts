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
      try {
        const body = await request.json<{ message?: unknown }>();
        if (typeof body.message !== "string" || !body.message.trim()) {
          return Response.json({ error: "Enter a message before sending." }, { status: 400 });
        }

        this.messages.push({ role: "user", content: body.message.trim() });
        const result = await this.env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
          messages: this.messages,
        });
        const reply = (result as { response?: string }).response || "";
        this.messages.push({ role: "assistant", content: reply });
        await this.state.storage.put("messages", this.messages);
        return Response.json({ reply, history: this.messages });
      } catch {
        return Response.json({ error: "The assistant could not respond. Please try again." }, { status: 500 });
      }
    }
    if (request.method !== "GET") {
      return Response.json({ error: "Method not allowed." }, { status: 405 });
    }
    return Response.json({ history: this.messages });
  }
}

export interface Env {
  AI: Ai;
  CHAT: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/" && request.method === "GET") {
      return new Response(CHAT_PAGE, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    if (url.pathname === "/chat" && request.method === "POST") {
      const id = env.CHAT.idFromName(url.searchParams.get("session") || "default");
      const stub = env.CHAT.get(id);
      return stub.fetch(request);
    }
    if (url.pathname === "/history" && request.method === "GET") {
      const id = env.CHAT.idFromName(url.searchParams.get("session") || "default");
      const stub = env.CHAT.get(id);
      return stub.fetch(request);
    }
    return new Response("Not found", { status: 404 });
  },
};

const CHAT_PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#f7f8f7">
  <title>Fieldnotes AI</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #252a26;
      --muted: #6d746f;
      --line: #e0e5e1;
      --green: #286247;
      font-family: "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100svh;
      color: var(--ink);
      background: #f7f8f7;
    }
    button, textarea { font: inherit; }
    .app { display: flex; min-height: 100svh; flex-direction: column; }
    header { display: flex; height: 60px; flex: 0 0 60px; align-items: center; justify-content: space-between; padding: 0 max(20px, calc((100% - 760px) / 2)); border-bottom: 1px solid var(--line); background: #fff; }
    .brand { font-size: 15px; font-weight: 600; }
    .header-actions { display: flex; align-items: center; gap: 16px; }
    .model-label { color: var(--muted); font-size: 12px; }
    .new-chat { padding: 7px 10px; border: 1px solid var(--line); border-radius: 4px; background: #fff; cursor: pointer; font-size: 12px; }
    .new-chat:hover { background: #f2f5f2; }
    main { display: flex; width: min(760px, 100%); flex: 1; flex-direction: column; align-self: center; padding: 34px 24px 0; }
    .welcome { margin: 35px 0 28px; }
    h1 { margin: 0 0 8px; font-size: 28px; font-weight: 600; }
    .intro { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.5; }
    .messages { display: flex; flex-direction: column; gap: 18px; margin-top: auto; padding-bottom: 24px; }
    .message { display: flex; flex-direction: column; align-items: flex-start; gap: 5px; }
    .message.user { align-items: flex-end; }
    .speaker { color: var(--muted); font-size: 11px; }
    .bubble { max-width: min(85%, 620px); padding: 11px 13px; border-radius: 7px; background: #eef1ef; font-size: 14px; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; }
    .message.user .bubble { background: #e4eee7; }
    .bubble.pending { color: var(--muted); }
    .composer-wrap { position: sticky; bottom: 0; padding: 12px 24px 16px; border-top: 1px solid var(--line); background: #fff; }
    .notice { width: min(712px, 100%); min-height: 16px; margin: 0 auto 4px; color: #a33e36; font-size: 12px; }
    .composer { display: flex; align-items: flex-end; gap: 10px; width: min(712px, 100%); margin: 0 auto; padding: 8px; border: 1px solid #cfd7d1; border-radius: 5px; background: #fff; }
    .composer:focus-within { border-color: var(--green); }
    textarea { width: 100%; min-height: 24px; max-height: 150px; resize: none; border: 0; outline: 0; background: transparent; color: var(--ink); font-size: 14px; line-height: 1.5; }
    textarea::placeholder { color: #858d87; }
    .send { display: grid; width: 34px; height: 34px; flex: 0 0 34px; place-items: center; border: 0; border-radius: 4px; background: var(--green); color: #fff; cursor: pointer; }
    .send:hover { background: #204e39; }
    .send:disabled { cursor: wait; opacity: .55; }
    .send svg { width: 16px; height: 16px; }
    .hint { margin: 7px 0 0; color: var(--muted); text-align: center; font-size: 11px; }
    @media (max-width: 520px) {
      header { height: 56px; flex-basis: 56px; padding: 0 16px; }
      .header-actions { gap: 10px; }
      .model-label { display: none; }
      main { padding: 24px 16px 0; }
      .welcome { margin-top: 24px; }
      .composer-wrap { padding: 10px 12px 14px; }
    }
  </style>
</head>
<body>
  <div class="app">
    <header>
      <div class="brand">Fieldnotes AI</div>
      <div class="header-actions">
        <span class="model-label">Llama 3.3</span>
        <button class="new-chat" id="newChat" type="button">New chat</button>
      </div>
    </header>
    <main>
      <section class="welcome" id="welcome" aria-label="Welcome">
        <h1>How can I help?</h1>
        <p class="intro">Ask a question or share an idea to get started.</p>
      </section>
      <section class="messages" id="messages" aria-label="Conversation" aria-live="polite"></section>
    </main>
    <div class="composer-wrap">
      <p class="notice" id="notice" role="status"></p>
      <form class="composer" id="form">
        <textarea id="input" rows="1" aria-label="Message" placeholder="Type a message..." required></textarea>
        <button class="send" id="send" type="submit" aria-label="Send message" title="Send message">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4Z"/></svg>
        </button>
      </form>
      <p class="hint">Enter to send. Shift + Enter for a new line.</p>
    </div>
  </div>
  <script>
    const messages = document.querySelector('#messages');
    const welcome = document.querySelector('#welcome');
    const input = document.querySelector('#input');
    const send = document.querySelector('#send');
    const notice = document.querySelector('#notice');
    const sessionKey = 'fieldnotes-session';
    let session = sessionStorage.getItem(sessionKey) || crypto.randomUUID();
    let busy = false;
    sessionStorage.setItem(sessionKey, session);

    function showMessage(role, content, pending = false) {
      const row = document.createElement('div');
      row.className = 'message ' + (role === 'user' ? 'user' : 'assistant');
      const speaker = document.createElement('div');
      speaker.className = 'speaker';
      speaker.textContent = role === 'user' ? 'You' : 'Assistant';
      const bubble = document.createElement('div');
      bubble.className = 'bubble' + (pending ? ' pending' : '');
      bubble.textContent = content;
      row.append(speaker, bubble);
      messages.append(row);
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return row;
    }

    function updateView() {
      const hasMessages = messages.childElementCount > 0;
      welcome.hidden = hasMessages;
    }

    async function loadHistory() {
      try {
        const response = await fetch('/history?session=' + encodeURIComponent(session));
        if (!response.ok) throw new Error('Could not load conversation history.');
        const data = await response.json();
        for (const message of data.history || []) showMessage(message.role, message.content);
        updateView();
      } catch {
        notice.textContent = 'Could not load saved conversation. You can still start a new one.';
      }
    }

    async function submitMessage(text) {
      const content = text.trim();
      if (!content || busy) return;
      busy = true;
      send.disabled = true;
      notice.textContent = '';
      showMessage('user', content);
      updateView();
      input.value = '';
      input.style.height = 'auto';
      const pending = showMessage('assistant', 'Thinking…', true);
      try {
        const response = await fetch('/chat?session=' + encodeURIComponent(session), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: content })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
        pending.querySelector('.bubble').textContent = data.reply || 'I wasn’t able to form a response. Please try again.';
        pending.querySelector('.bubble').classList.remove('pending');
      } catch (error) {
        pending.remove();
        notice.textContent = error.message || 'The assistant could not respond. Please try again.';
      } finally {
        busy = false;
        send.disabled = false;
        input.focus();
      }
    }

    document.querySelector('#form').addEventListener('submit', event => {
      event.preventDefault();
      submitMessage(input.value);
    });
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 150) + 'px';
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        document.querySelector('#form').requestSubmit();
      }
    });
    document.querySelector('#newChat').addEventListener('click', () => {
      session = crypto.randomUUID();
      sessionStorage.setItem(sessionKey, session);
      messages.replaceChildren();
      notice.textContent = '';
      updateView();
      input.focus();
    });
    loadHistory();
  </script>
</body>
</html>`;
