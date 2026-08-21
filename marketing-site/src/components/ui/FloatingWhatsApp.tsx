"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, ChevronLeft, Mail, Mic, Phone, Send, Sparkles, Volume2, X } from "lucide-react";

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
};

const starterMessages: ChatMessage[] = [
  {
    role: "assistant",
    content:
      "Hi, I am Aura AI. I can help with salon CRM, POS billing, booking, staff, inventory, pricing, setup, GST, WhatsApp workflows and demo questions.",
  },
  {
    role: "assistant",
    content:
      "Ask me anything about Aura Salon CRM/POS, or share your mobile number and I can pass your demo request to the team.",
  },
];

const quickPrompts = ["Pricing", "Book demo", "GST billing", "Staff payroll"];

export function FloatingWhatsApp() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const [input, setInput] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [leadStatus, setLeadStatus] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  async function sendMessage(messageText: string) {
    const trimmed = messageText.trim();
    if (!trimmed || isSending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setLeadStatus("");
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          history: nextMessages.slice(-8),
        }),
      });
      const data = await response.json();
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.reply || "I could not process that right now. Please ask again or book a demo from the site.",
        },
      ]);
      if (data.leadCaptured) setLeadStatus("Demo request shared with Aura team.");
    } catch {
      setMessages((current) => [
        ...current,
        { role: "assistant", content: "I am having trouble connecting right now. Please try again in a moment." },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage(input);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group fixed bottom-6 right-6 z-[9990] flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#6C63FF] to-[#5146E8] text-white shadow-[0_18px_42px_rgba(81,70,232,0.38)] transition-all duration-300 hover:-translate-y-1 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#6C63FF]"
        aria-label="Open Aura AI chat"
      >
        <span className="absolute inset-0 rounded-full bg-[#6C63FF]/30 animate-ping" aria-hidden="true" />
        <Bot className="relative z-10 h-8 w-8" aria-hidden="true" />
        <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border-2 border-white bg-emerald-400" aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-white" />
        </span>
      </button>
    );
  }

  return (
    <aside className="fixed inset-x-3 bottom-3 z-[9990] mx-auto max-w-[400px] overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-[0_26px_80px_rgba(42,36,89,0.25)] sm:inset-x-auto sm:right-6 sm:bottom-6" aria-label="Aura AI assistant">
      <div className="relative flex items-center gap-3 bg-gradient-to-r from-[#6C63FF] via-[#625BF4] to-[#5A4FEA] px-4 py-4 text-white">
        <button type="button" className="grid h-8 w-8 place-items-center rounded-full text-white/90 transition hover:bg-white/12" aria-label="Back">
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="relative grid h-12 w-12 place-items-center rounded-full bg-white text-[#5A4FEA] shadow-lg">
          <Bot className="h-7 w-7" aria-hidden="true" />
          <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-400" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold leading-5">Chat with us</p>
          <p className="text-xs font-medium text-white/82">Your AI Assistant</p>
        </div>
        <button type="button" onClick={() => setIsMuted((value) => !value)} className="grid h-8 w-8 place-items-center rounded-full text-white/90 transition hover:bg-white/12" aria-label={isMuted ? "Unmute chat" : "Mute chat"}>
          <Volume2 className={`h-5 w-5 ${isMuted ? "opacity-45" : ""}`} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-full text-white/90 transition hover:bg-white/12" aria-label="Close chat">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="h-[430px] overflow-y-auto bg-[#F7F8FC] px-4 py-5 sm:h-[435px]">
        <div className="mb-4 rounded-2xl border border-[#E7EAF4] bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-[#625BF4]"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Aura product expert</div>
          <p className="text-sm leading-6 text-slate-700">I know Aura features, plans, setup flow, Indian salon operations, GST POS, booking, CRM, staff, inventory and marketing workflows.</p>
        </div>

        <div className="space-y-3">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className={message.role === "user" ? "max-w-[82%] rounded-2xl rounded-br-md bg-[#625BF4] px-4 py-3 text-sm leading-6 text-white shadow-sm" : "max-w-[88%] rounded-2xl rounded-bl-md border border-[#E7EAF4] bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm"}>
                {message.content}
              </div>
            </div>
          ))}
          {isSending && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md border border-[#E7EAF4] bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">Typing...</div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-slate-200 bg-white px-4 py-3">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {quickPrompts.map((prompt) => (
            <button key={prompt} type="button" onClick={() => sendMessage(prompt)} className="shrink-0 rounded-full border border-[#E1E5F2] bg-[#F7F8FC] px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-[#625BF4]/40 hover:text-[#625BF4]">
              {prompt}
            </button>
          ))}
        </div>

        <div className="mb-3 grid grid-cols-[88px_1fr] gap-2">
          <label className="flex h-11 items-center justify-center gap-1 rounded-xl border border-[#E1E5F2] bg-white px-2 text-xs font-semibold text-slate-700">
            <Phone className="h-3.5 w-3.5 text-[#625BF4]" aria-hidden="true" /> IN +91
          </label>
          <input value={phone} onChange={(event) => setPhone(event.target.value)} className="h-11 rounded-xl border border-[#E1E5F2] px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#625BF4] focus:ring-4 focus:ring-[#625BF4]/10" placeholder="Enter your mobile" inputMode="tel" />
        </div>
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-[#E1E5F2] px-3">
          <Mail className="h-4 w-4 text-[#625BF4]" aria-hidden="true" />
          <input value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 min-w-0 flex-1 text-sm text-slate-800 outline-none placeholder:text-slate-400" placeholder="Email optional" type="email" />
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2 rounded-2xl border border-[#E1E5F2] bg-white p-2 shadow-sm">
          <input value={input} onChange={(event) => setInput(event.target.value)} className="min-h-10 min-w-0 flex-1 px-2 text-sm text-slate-800 outline-none placeholder:text-slate-400" placeholder="Message..." aria-label="Chat message" />
          <button type="button" className="grid h-10 w-10 place-items-center rounded-full text-slate-400 transition hover:bg-slate-50" aria-label="Voice input">
            <Mic className="h-5 w-5" aria-hidden="true" />
          </button>
          <button type="submit" disabled={!input.trim() || isSending} className="grid h-10 w-10 place-items-center rounded-full bg-[#625BF4] text-white transition hover:bg-[#5146E8] disabled:bg-slate-100 disabled:text-slate-300" aria-label="Send message">
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>

        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
          <span>{leadStatus || "Chat with us"}</span>
          <span>Powered by <strong className="text-slate-600">Aura AI</strong></span>
        </div>
      </div>
    </aside>
  );
}
