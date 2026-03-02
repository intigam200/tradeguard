"use client";

import { useState, useEffect, useRef } from "react";
import Pusher from "pusher-js";

type Message = {
  role: "user" | "support" | "system";
  text: string;
  time: Date;
};

type Props = {
  userId:       string;
  blockReason:  string | null;
  blockedUntil: string | null;
  onClose:      () => void;
};

export function UnblockChat({ userId, blockReason, blockedUntil, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "support",
      text: `Hi! I can see your trading was blocked${blockReason ? `: "${blockReason}"` : ""}. How can I help you?`,
      time: new Date(),
    },
  ]);
  const [input,       setInput]       = useState("");
  const [requestSent, setRequestSent] = useState(false);
  const [status, setStatus] = useState<"chatting" | "pending" | "approved" | "denied">("chatting");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const key     = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!key || !cluster) return;

    const pusher  = new Pusher(key, { cluster });
    const channel = pusher.subscribe(`user-${userId}`);

    channel.bind("support-message", (data: { text: string }) => {
      setMessages(prev => [...prev, { role: "support", text: data.text, time: new Date() }]);
    });

    channel.bind("unblock-approved", () => {
      setStatus("approved");
      setMessages(prev => [...prev, {
        role: "support",
        text: "✅ Your trading has been unblocked. Trade carefully!",
        time: new Date(),
      }]);
      setTimeout(() => window.location.reload(), 2000);
    });

    channel.bind("unblock-denied", (data: { reason?: string }) => {
      setStatus("denied");
      setMessages(prev => [...prev, {
        role: "support",
        text: `❌ Unblock request denied. ${data.reason ?? "Your block period must be completed for your own discipline."}`,
        time: new Date(),
      }]);
    });

    return () => { pusher.unsubscribe(`user-${userId}`); };
  }, [userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    setMessages(prev => [...prev, { role: "user", text, time: new Date() }]);
    setInput("");
    await fetch("/api/support/send-message", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ message: text }),
    });
  };

  const requestUnblock = async () => {
    setRequestSent(true);
    setStatus("pending");
    setMessages(prev => [...prev, {
      role: "system",
      text: "⏳ Unblock request sent to support. Usually responds within 1 minute.",
      time: new Date(),
    }]);
    await fetch("/api/support/request-unblock", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ blockReason, blockedUntil }),
    });
  };

  return (
    <div className="flex flex-col h-[520px]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-sm font-bold">
              TG
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#161b27]" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">TradeGuard Support</div>
            <div className="text-xs text-emerald-400">● Online · Responds in ~1 min</div>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">✕</button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "system" ? (
              <div className="text-center text-xs text-slate-500 w-full py-1">{msg.text}</div>
            ) : (
              <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-emerald-600/80 text-white rounded-br-none"
                  : "bg-white/5 text-slate-200 rounded-bl-none border border-white/5"
              }`}>
                {msg.text}
                <div className="text-[10px] opacity-50 mt-1">
                  {msg.time.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Request Unblock Button */}
      {!requestSent && status === "chatting" && (
        <div className="px-4 pb-2">
          <button
            onClick={requestUnblock}
            className="w-full bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 rounded-lg py-2 text-sm font-medium transition"
          >
            🔓 Request Immediate Unblock
          </button>
        </div>
      )}

      {status === "pending" && (
        <div className="px-4 pb-2">
          <div className="w-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 rounded-lg py-2 text-sm text-center">
            ⏳ Waiting for support approval...
          </div>
        </div>
      )}

      {/* Input */}
      {status !== "approved" && (
        <div className="p-4 border-t border-white/5 flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50"
          />
          <button
            onClick={sendMessage}
            className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-4 py-2 text-sm transition"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
