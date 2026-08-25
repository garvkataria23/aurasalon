"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, CheckCheck, Clock, User, ShieldCheck } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { LandingDecor } from "./LandingDecor";

type Message = {
  id: string;
  sender: "user" | "bot";
  text: string;
  time: string;
  options?: string[];
  card?: {
    service: string;
    stylist: string;
    slot: string;
    price: string;
  };
};

export function WhatsAppSimulator() {
  const bookingMessages: Message[] = [
    {
      id: "1",
      sender: "user",
      text: "Hi Aura! Need to book a Hair Spa & Cut for tomorrow evening.",
      time: "04:15 PM",
    },
    {
      id: "2",
      sender: "bot",
      text: "Namaste Priya! I found 3 open slots for Hair Spa & Cut with Senior Stylist Ananya at Bandra West tomorrow:",
      time: "04:15 PM",
      options: ["Book 04:30 PM", "Book 06:00 PM", "Book 07:15 PM"],
    },
  ];
  const reminderMessages: Message[] = [
    {
      id: "r1",
      sender: "bot",
      text: "Hi Priya, reminder for your Signature Hair Spa + Haircut appointment tomorrow at 06:00 PM with Ananya K. at Aura Bandra West.",
      time: "09:00 AM",
      options: ["Confirm visit", "Reschedule", "Need directions"],
    },
    {
      id: "r2",
      sender: "bot",
      text: "Please arrive 10 minutes early. Your estimated bill is ₹2,800. Reply Confirm to lock the slot.",
      time: "09:00 AM",
    },
  ];
  const [activeMode, setActiveMode] = useState<"booking" | "reminder">("booking");
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const messageIdRef = useRef(3);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "user",
      text: "Hi Aura! Need to book a Hair Spa & Cut for tomorrow evening.",
      time: "04:15 PM",
    },
    {
      id: "2",
      sender: "bot",
      text: "Namaste Priya! 🙏 I found 3 open slots for Hair Spa & Cut with Senior Stylist Ananya at Bandra West tomorrow:",
      time: "04:15 PM",
      options: ["Book 04:30 PM", "Book 06:00 PM", "Book 07:15 PM"],
    },
  ]);

  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  useEffect(() => {
    const chatBody = chatBodyRef.current;
    if (!chatBody) return;

    requestAnimationFrame(() => {
      chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
    });
  }, [messages]);

  const showBookingFlow = () => {
    setActiveMode("booking");
    setBookingConfirmed(false);
    setMessages(bookingMessages);
  };

  const showReminderFlow = () => {
    setActiveMode("reminder");
    setBookingConfirmed(false);
    setMessages(reminderMessages);
  };

  const handleOptionClick = (option: string) => {
    const timeStr = option.replace("Book ", "");
    const nextMessageId = () => String(messageIdRef.current++);

    const userMsg: Message = {
      id: nextMessageId(),
      sender: "user",
      text: option,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    if (option === "Need directions") {
      setMessages((prev) => [...prev, userMsg, {
        id: nextMessageId(),
        sender: "bot",
        text: "Here is the Aura Bandra West location pin. Parking is available near the main entrance.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }]);
      return;
    }

    const botMsg: Message = {
      id: nextMessageId(),
      sender: "bot",
      text: activeMode === "reminder" ? "Confirmed. Your visit is locked for tomorrow at 06:00 PM. See you soon!" : `Awesome! Your booking is confirmed. We've reserved Senior Stylist Ananya for you.`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      card: {
        service: activeMode === "reminder" ? "Visit Reminder Confirmed" : "Signature Hair Spa + Haircut",
        stylist: "Ananya K. (Senior Stylist)",
        slot: activeMode === "reminder" && option === "Confirm visit" ? "Tomorrow at 06:00 PM" : `Tomorrow at ${timeStr}`,
        price: "₹2,800 (Pay at salon)",
      },
    };

    if (option === "Reschedule") {
      setMessages((prev) => [...prev, userMsg, { ...botMsg, text: "No problem. Here are alternate slots for tomorrow:", options: ["Book 04:30 PM", "Book 07:15 PM"], card: undefined }]);
      return;
    }

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setBookingConfirmed(true);
  };

  const handleReset = () => {
    setBookingConfirmed(false);
    setMessages(activeMode === "reminder" ? reminderMessages : bookingMessages);
  };

  return (
    <section className="relative bg-gradient-to-br from-[#F1E9FF] via-[#E5D8FF] to-[#D7C3FF] py-20 md:py-28 overflow-hidden border-t border-[var(--aura-border)]">
      <LandingDecor variant="warm" />
      <Container className="relative z-10">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          {/* Left Description */}
          <div>
            <span className="inline-block text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-3">
              Automated Messaging
            </span>
            <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
              24/7 WhatsApp AI Booking Concierge
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[var(--aura-body)]">
              Let your clients book, reschedule, and receive GST receipts via WhatsApp automatically — without a single manual phone call or missed lead.
            </p>

            <div className="mt-8 space-y-3">
              <button type="button" onClick={showBookingFlow} className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left shadow-xs backdrop-blur-md transition-all hover:-translate-y-0.5 hover:shadow-md ${activeMode === "booking" ? "border-emerald-200 bg-emerald-50/80" : "border-white/50 bg-white/30 hover:bg-white/45"}`}>
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[var(--aura-heading)]">Real-Time Slot Availability</h4>
                  <p className="mt-0.5 text-xs text-[var(--aura-body)]">
                    Directly reads available calendar slots from your appointment calendar and lets clients pick their stylist.
                  </p>
                </div>
              </button>

              <button type="button" onClick={showReminderFlow} className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left shadow-xs backdrop-blur-md transition-all hover:-translate-y-0.5 hover:shadow-md ${activeMode === "reminder" ? "border-[var(--aura-purple)]/30 bg-white/40 ring-1 ring-white/35" : "border-white/50 bg-white/30 hover:bg-white/45"}`}>
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--aura-lavender)] text-[var(--aura-purple)]">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[var(--aura-heading)]">Automated Visit Reminders</h4>
                  <p className="mt-0.5 text-xs text-[var(--aura-body)]">
                    Auto-sends WhatsApp reminders with 1-tap confirmation or reschedule buttons to virtually eliminate no-shows.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Right Simulated WhatsApp Phone Window */}
          <div className="mx-auto w-full max-w-md">
            <div className="overflow-hidden rounded-[2rem] border-4 border-gray-900/90 bg-white/30 shadow-[0_24px_80px_rgba(109,63,209,0.16)] backdrop-blur-xl ring-1 ring-white/35">
              {/* WhatsApp Header */}
              <div className="flex items-center gap-3 bg-[#075e54] p-4 text-white">
                <div className="relative">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-emerald-700 text-xs font-bold">
                    A
                  </div>
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#075e54] bg-emerald-400" />
                </div>
                <div>
                  <h3 className="text-xs font-bold leading-tight">Aura Salon AI Concierge</h3>
                  <p className="text-[10px] text-emerald-200">Official WhatsApp Business &bull; Online</p>
                </div>
              </div>

              {/* WhatsApp Chat Body */}
              <div ref={chatBodyRef} className="h-[360px] overflow-y-auto bg-[#e5ddd5] p-4 space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl p-3 text-xs leading-relaxed shadow-xs ${
                        msg.sender === "user"
                          ? "rounded-tr-none bg-[#dcf8c6] text-gray-900"
                          : "rounded-tl-none bg-white text-gray-900"
                      }`}
                    >
                      <p>{msg.text}</p>

                      {/* Options interactive buttons */}
                      {msg.options && !bookingConfirmed && (
                        <div className="mt-3 flex flex-col gap-1.5 border-t border-gray-100 pt-2">
                          {msg.options.map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => handleOptionClick(opt)}
                              className="rounded-xl border border-[var(--aura-purple)]/40 bg-[var(--aura-lavender)]/50 px-3 py-2 text-center text-xs font-bold text-[var(--aura-purple)] transition-colors hover:bg-[var(--aura-purple)] hover:text-white"
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Booking confirmation card */}
                      {msg.card && (
                        <div className="mt-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 space-y-1 text-[11px] text-emerald-950">
                          <p className="font-bold text-emerald-900 text-xs">{msg.card.service}</p>
                          <p className="flex items-center gap-1"><User className="h-3 w-3" /> {msg.card.stylist}</p>
                          <p className="flex items-center gap-1"><Clock className="h-3 w-3" /> {msg.card.slot}</p>
                          <p className="font-bold text-emerald-800 pt-1">{msg.card.price}</p>
                        </div>
                      )}

                      <div className="mt-1 flex items-center justify-end gap-1 text-[9px] text-gray-500">
                        <span>{msg.time}</span>
                        <CheckCheck className="h-3 w-3 text-sky-500" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Chat Input Bar */}
              <div className="flex items-center gap-2 border-t border-gray-200 bg-gray-100 px-4 py-2.5">
                <input
                  type="text"
                  disabled
                  placeholder="Simulated WhatsApp Interface"
                  className="flex-1 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-500 outline-none"
                />
                {bookingConfirmed && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="rounded-full bg-[var(--aura-purple)] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[var(--aura-purple-hover)]"
                  >
                    Reset Chat
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
