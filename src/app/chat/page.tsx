"use client";
import { api } from "@/lib/api";
import { useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import CrisisLockout from "@/components/CrisisLockout";

interface Msg { id?: string; role: "USER" | "ASSISTANT"; content: string }

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [locked, setLocked] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Load most recent conversation, if any.
  useEffect(() => {
    (async () => {
      const list = await api("/chat").then((r) => r.json());
      const first = (list.conversations ?? [])[0];
      if (first) {
        const c = await api(`/chat?conversationId=${first.id}`).then((r) => r.json());
        setConversationId(c.id);
        setMessages(c.messages ?? []);
      }
    })();
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setMessages((m) => [...m, { role: "USER", content: text }]);
    setSending(true);
    const res = await api("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, message: text }),
    });
    setSending(false);
    if (res.status === 423) { setLocked(true); return; }
    if (res.ok) {
      const d = await res.json();
      setConversationId(d.conversationId);
      setMessages((m) => [...m, { role: "ASSISTANT", content: d.reply }]);
    }
  }

  if (locked) return <CrisisLockout onResolve={() => setLocked(false)} />;

  return (
    <div className="flex h-[74vh] w-full flex-col">
      <Header title="Companion" subtitle="Warm, private, and here to listen." />

      <div className="flex-1 space-y-3 overflow-y-auto px-1 pb-4">
        {messages.length === 0 && (
          <div className="card text-sm text-muted">
            Hi — I&apos;m here whenever you want to talk. No judgment, no rush.
            What&apos;s present for you right now?
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={m.id ?? i}
            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
              m.role === "USER"
                ? "ml-auto bg-primary text-white"
                : "mr-auto bg-white/15 backdrop-blur border border-white/20"
            }`}
          >
            {m.content}
          </div>
        ))}
        {sending && <div className="mr-auto rounded-2xl border border-white/20 bg-white/15 px-4 py-2.5 text-sm backdrop-blur">…</div>}
        <div ref={endRef} />
      </div>

      <div className="rounded-2xl border border-white/60 bg-white/60 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-end gap-2">
          <textarea
            className="input max-h-32 min-h-[44px] flex-1 resize-none"
            placeholder="Type a message…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          <button onClick={send} disabled={sending || !input.trim()} className="btn-primary px-4 py-3">
            Send
          </button>
        </div>
        <p className="mt-1.5 text-center text-[11px] text-muted">
          Not a substitute for professional care. In crisis, call your local emergency number.
        </p>
      </div>
    </div>
  );
}
