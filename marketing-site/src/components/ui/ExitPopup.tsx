"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ArrowRight } from "lucide-react";

export function ExitPopup() {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      if (e.clientY < 10 && !sessionStorage.getItem("exitPopupDismissed")) {
        setShow(true);
      }
    };
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!sessionStorage.getItem("exitPopupDismissed")) {
        setShow(true);
      }
    };

    document.addEventListener("mouseleave", handleMouse);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      document.removeEventListener("mouseleave", handleMouse);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const dismiss = useCallback(() => {
    setShow(false);
    sessionStorage.setItem("exitPopupDismissed", "true");
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
    sessionStorage.setItem("exitPopupDismissed", "true");
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={dismiss}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={dismiss}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center text-aura-text-muted hover:text-aura-text transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Gradient top */}
            <div className="h-2 bg-gradient-to-r from-neon-violet via-aura-rose to-aura-amber" />

            <div className="p-8 text-center">
              {submitted ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">🎉</span>
                  </div>
                  <h3 className="text-xl font-bold text-aura-text mb-2">You&apos;re In!</h3>
                  <p className="text-sm text-aura-text-secondary">
                    Check your email for an exclusive launch offer. We&apos;ll also send you a free salon growth guide.
                  </p>
                </motion.div>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-neon-violet/15 to-aura-rose/15 flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">🎁</span>
                  </div>
                  <h3 className="text-xl font-bold text-aura-text mb-2">
                    Wait — Don&apos;t Miss This!
                  </h3>
                  <p className="text-sm text-aura-text-secondary mb-6">
                    Get <strong className="text-aura-text">20% off your first 3 months</strong> + a free salon growth guide when you start your trial today.
                  </p>
                  <form onSubmit={handleSubmit} className="space-y-3">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full px-4 py-3 rounded-xl border border-aura-border bg-white text-sm text-aura-text placeholder:text-aura-text-muted focus:outline-none focus:ring-2 focus:ring-neon-violet/30 focus:border-neon-violet/50 transition-all"
                    />
                    <button
                      type="submit"
                      className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-neon-violet via-aura-rose to-aura-amber shadow-md hover:shadow-lg transition-all duration-300"
                    >
                      Claim 20% Off
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                  <p className="text-xs text-aura-text-muted mt-4">
                    No spam. Unsubscribe anytime.
                  </p>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
