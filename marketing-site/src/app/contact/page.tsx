"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { Send, CheckCircle, Mail, Phone, MapPin } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GridBackground } from "@/components/ui/GridBackground";
import { fadeInUp } from "@/lib/animations";

export default function ContactPage() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    salonName: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setStatus("sent");
        setFormData({ name: "", email: "", phone: "", salonName: "", message: "" });
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <>
      {/* Hero */}
      <section className="relative pt-28 pb-16 md:pt-36 md:pb-20 bg-gradient-to-b from-aura-bg to-white overflow-hidden">
        <GridBackground className="opacity-30" />
        <Container className="relative z-10">
          <SectionHeading
            badge="Contact"
            title="Get in Touch"
            subtitle="Have a question, need a demo, or want to discuss enterprise solutions? We'd love to hear from you."
          />
        </Container>
      </section>

      {/* Contact Form + Info */}
      <section className="pb-20 md:pb-28 bg-white">
        <Container>
          <div className="grid md:grid-cols-5 gap-12 max-w-5xl mx-auto">
            {/* Form */}
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="md:col-span-3"
            >
              {status === "sent" ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-12 text-center">
                  <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-aura-text mb-2">Message Sent!</h3>
                  <p className="text-sm text-aura-text-secondary">
                    Thank you for reaching out. We&apos;ll get back to you within 24 hours.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-aura-text mb-1.5">Your Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-aura-border bg-white text-sm text-aura-text placeholder:text-aura-text-muted focus:outline-none focus:ring-2 focus:ring-neon-violet/30 focus:border-neon-violet/50 transition-all"
                        placeholder="Priya Sharma"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-aura-text mb-1.5">Email *</label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-aura-border bg-white text-sm text-aura-text placeholder:text-aura-text-muted focus:outline-none focus:ring-2 focus:ring-neon-violet/30 focus:border-neon-violet/50 transition-all"
                        placeholder="priya@salon.com"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-aura-text mb-1.5">Phone</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-aura-border bg-white text-sm text-aura-text placeholder:text-aura-text-muted focus:outline-none focus:ring-2 focus:ring-neon-violet/30 focus:border-neon-violet/50 transition-all"
                        placeholder="+91 98765 43210"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-aura-text mb-1.5">Salon Name</label>
                      <input
                        type="text"
                        value={formData.salonName}
                        onChange={(e) => setFormData({ ...formData, salonName: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-aura-border bg-white text-sm text-aura-text placeholder:text-aura-text-muted focus:outline-none focus:ring-2 focus:ring-neon-violet/30 focus:border-neon-violet/50 transition-all"
                        placeholder="Glow Studio"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-aura-text mb-1.5">Message *</label>
                    <textarea
                      required
                      rows={5}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-aura-border bg-white text-sm text-aura-text placeholder:text-aura-text-muted focus:outline-none focus:ring-2 focus:ring-neon-violet/30 focus:border-neon-violet/50 transition-all resize-none"
                      placeholder="Tell us about your salon and what you're looking for..."
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-neon-violet via-aura-rose to-aura-amber shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {status === "sending" ? "Sending..." : "Send Message"}
                    <Send className="w-4 h-4" />
                  </button>
                  {status === "error" && (
                    <p className="text-sm text-danger">Something went wrong. Please try again.</p>
                  )}
                </form>
              )}
            </motion.div>

            {/* Contact Info */}
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="md:col-span-2"
            >
              <div className="space-y-6">
                <div className="rounded-2xl border border-aura-border bg-aura-bg-warm p-6">
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-neon-violet mt-0.5" />
                    <div>
                      <div className="text-sm font-semibold text-aura-text">Email</div>
                      <div className="text-sm text-aura-text-secondary">hello@aurasalon.in</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-aura-border bg-aura-bg-warm p-6">
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-neon-violet mt-0.5" />
                    <div>
                      <div className="text-sm font-semibold text-aura-text">Phone</div>
                      <div className="text-sm text-aura-text-secondary">+91 98765 43210</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-aura-border bg-aura-bg-warm p-6">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-neon-violet mt-0.5" />
                    <div>
                      <div className="text-sm font-semibold text-aura-text">Office</div>
                      <div className="text-sm text-aura-text-secondary">
                        Hitech City, Hyderabad<br />
                        Telangana, India 500081
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-aura-border bg-white p-6">
                  <h3 className="text-sm font-bold text-aura-text mb-3">Quick Links</h3>
                  <ul className="space-y-2">
                    <li><a href="#" className="text-sm text-neon-violet hover:underline">Schedule a Demo</a></li>
                    <li><a href="#" className="text-sm text-neon-violet hover:underline">View Documentation</a></li>
                    <li><a href="#" className="text-sm text-neon-violet hover:underline">Check System Status</a></li>
                  </ul>
                </div>
              </div>
            </motion.div>
          </div>
        </Container>
      </section>
    </>
  );
}
