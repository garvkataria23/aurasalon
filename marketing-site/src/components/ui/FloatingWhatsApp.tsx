"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, ChevronDown, ChevronUp, Mail, MessageCircle, Mic, Phone, Send, Sparkles, Volume2, VolumeX, X } from "lucide-react";

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
};

const WHATSAPP_NUMBER = "917208283341";
const WHATSAPP_MESSAGE = encodeURIComponent(
  "Hi Aura Team! I am interested in Aura Salon CRM & POS software and would like to learn more."
);
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`;

const starterMessages: ChatMessage[] = [
  {
    role: "assistant",
    content:
      "Hi! I'm Aura AI. How can I help you today? Ask me anything about salon billing, GST, booking, staff commissions, or WhatsApp marketing.",
  },
];

const quickPrompts = [
  { label: "Continue on WhatsApp", isWhatsApp: true },
  { label: "Pricing & Plans", prompt: "What are the pricing plans for Aura Salon POS?" },
  { label: "Book a Demo", prompt: "I would like to schedule a product demo." },
  { label: "GST Billing & POS", prompt: "How does GST billing and split payment work?" },
  { label: "Staff & Payroll", prompt: "How does staff attendance and commission calculation work?" },
];

export function FloatingWhatsApp() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const [input, setInput] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [showContactForm, setShowContactForm] = useState(false);
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
          content: data.reply || "I could not process that right now. Please ask again or connect with us on WhatsApp.",
        },
      ]);
      if (data.leadCaptured) setLeadStatus("Demo request shared with Aura team.");
    } catch {
      setMessages((current) => [
        ...current,
        { role: "assistant", content: "I am having trouble connecting right now. Please try again or chat directly on WhatsApp." },
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
      <div className="fixed bottom-6 right-6 z-[9990] flex items-center gap-3">
        {/* Small quick WhatsApp floating badge */}
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-2 rounded-full border border-emerald-500/20 bg-white/95 px-3.5 py-2 text-xs font-semibold text-emerald-700 shadow-[0_8px_24px_rgba(16,185,129,0.22)] backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-emerald-50 hover:shadow-[0_12px_28px_rgba(16,185,129,0.3)] focus-visible:outline-2 focus-visible:outline-emerald-500"
          aria-label="Chat on WhatsApp +91 7208283341"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#25D366] text-white">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
          </span>
          <span className="hidden sm:inline">WhatsApp</span>
        </a>

        {/* AI Chat Button */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-[#6366F1] via-[#4F46E5] to-[#7C3AED] text-white shadow-[0_14px_36px_rgba(79,70,229,0.38)] transition-all duration-300 hover:-translate-y-1 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#4F46E5]"
          aria-label="Open Aura AI chat"
        >
          <Bot className="h-7 w-7 transition-transform duration-200 group-hover:scale-110" aria-hidden="true" />
          <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full border-2 border-white bg-emerald-500" aria-hidden="true">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
          </span>
        </button>
      </div>
    );
  }

  return (
    <aside
      className="fixed inset-x-3 bottom-3 z-[9990] mx-auto flex h-[690px] max-h-[94vh] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_28px_80px_-10px_rgba(15,23,42,0.38)] backdrop-blur-xl transition-all duration-300 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:h-[760px]"
      aria-label="Aura AI assistant"
    >
      {/* Header */}
      <div className="relative flex items-center justify-between border-b border-indigo-500/20 bg-gradient-to-r from-[#5B50EA] via-[#4F46E5] to-[#7C3AED] px-4 py-3.5 text-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-white/15 text-white shadow-inner backdrop-blur-md">
            <Bot className="h-6 w-6" aria-hidden="true" />
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#4F46E5] bg-emerald-400" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-bold tracking-tight">Aura AI</h2>
              <span className="inline-flex items-center rounded-full bg-emerald-400/20 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-200">Online</span>
            </div>
            <p className="text-[11px] text-white/80">Salon OS &amp; Product Expert</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Quick WhatsApp Header Link */}
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Chat with us on WhatsApp (+91 7208283341)"
            className="flex h-8 items-center gap-1.5 rounded-lg bg-emerald-500/20 px-2 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/30 hover:text-white"
            aria-label="Chat on WhatsApp"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
            <span className="hidden xs:inline">WhatsApp</span>
          </a>

          <button
            type="button"
            onClick={() => setIsMuted((v) => !v)}
            className="grid h-8 w-8 place-items-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={isMuted ? "Unmute sound" : "Mute sound"}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid h-8 w-8 place-items-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close chat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area - Expanded height with ultra-thin sleek scrollbar */}
      <div className="flex-1 overflow-y-auto bg-slate-50/70 p-4 space-y-3 min-h-0 [scrollbar-width:thin] [scrollbar-color:#CBD5E1_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300/70 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-400">
        {/* Intro badge */}
        <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 to-purple-50/80 p-3 text-xs text-slate-600 shadow-2xs">
          <div className="flex items-center gap-1.5 font-semibold text-indigo-700 mb-1">
            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
            <span>Aura Product Assistant</span>
          </div>
          <p className="text-xs leading-relaxed text-slate-600">
            Ask about POS, GST billing, multi-branch, staff payroll, online booking or WhatsApp features.
          </p>
        </div>

        {/* Message bubbles */}
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[86%] rounded-2xl px-4 py-3 text-xs sm:text-[13px] leading-relaxed shadow-2xs ${
                message.role === "user"
                  ? "bg-gradient-to-r from-[#5B50EA] to-[#4F46E5] text-white rounded-br-xs"
                  : "border border-slate-200/90 bg-white text-slate-800 rounded-bl-xs"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-xs border border-slate-200/90 bg-white px-4 py-3 text-xs text-slate-400 shadow-2xs">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Quick Prompts Bar - Hidden scrollbar for sleek horizontal scrolling */}
      <div className="border-t border-slate-100 bg-white px-3 py-2 shrink-0">
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pb-0.5">
          {quickPrompts.map((item, i) =>
            item.isWhatsApp ? (
              <a
                key={i}
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-300/80 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100 hover:border-emerald-400 shadow-2xs"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 text-[#25D366]" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
                {item.label}
              </a>
            ) : (
              <button
                key={i}
                type="button"
                onClick={() => sendMessage(item.prompt || item.label)}
                className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-700 shadow-2xs"
              >
                {item.label}
              </button>
            )
          )}
        </div>
      </div>

      {/* Collapsible Callback / Lead Form */}
      <div className="border-t border-slate-100 bg-slate-50/50 px-3 py-1.5">
        <button
          type="button"
          onClick={() => setShowContactForm((v) => !v)}
          className="flex w-full items-center justify-between text-[11px] font-semibold text-slate-600 hover:text-indigo-600 transition"
        >
          <span className="flex items-center gap-1">
            <Phone className="h-3 w-3 text-indigo-600" />
            <span>Request Instant Callback</span>
          </span>
          {showContactForm ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {showContactForm && (
          <div className="mt-2 space-y-2 pb-1 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="grid grid-cols-[80px_1fr] gap-1.5">
              <span className="flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-700">
                🇮🇳 +91
              </span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Mobile number"
                type="tel"
                className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2">
              <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email (optional)"
                type="email"
                className="h-8 min-w-0 flex-1 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Input Message Form */}
      <div className="border-t border-slate-200/80 bg-white p-2.5">
        <form onSubmit={handleSubmit} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/50 p-1 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="min-h-8 min-w-0 flex-1 bg-transparent px-2 text-xs text-slate-800 outline-none placeholder:text-slate-400"
            placeholder="Type your question..."
            aria-label="Chat message"
          />
          <button
            type="submit"
            disabled={!input.trim() || isSending}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-tr from-[#5B50EA] to-[#4F46E5] text-white shadow-sm transition hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Send message"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </form>

        {/* Footer Subtext with WhatsApp link */}
        <div className="mt-2 flex items-center justify-between px-0.5 text-[10px] text-slate-400">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-emerald-600 hover:text-emerald-700 transition"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            WhatsApp: +91 7208283341
          </a>
          <span>
            Powered by <strong className="font-semibold text-slate-600">Aura OS</strong>
          </span>
        </div>
      </div>
    </aside>
  );
}

