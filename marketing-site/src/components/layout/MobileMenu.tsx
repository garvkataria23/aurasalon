"use client";

import { useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight } from "lucide-react";
import type { NavLink } from "@/lib/types";

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  links: NavLink[];
  ctaLinks: { login: string; trial: string };
}

export function MobileMenu({ open, onClose, links, ctaLinks }: MobileMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const firstFocusable = useRef<HTMLAnchorElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // Focus trap
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;

    const focusables = panelRef.current.querySelectorAll<HTMLElement>(
      'a[href], button, [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, [onClose]);

  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement as HTMLElement;
      // Focus first link after animation
      setTimeout(() => firstFocusable.current?.focus(), 400);
      document.addEventListener("keydown", handleKeyDown);
    } else {
      document.removeEventListener("keydown", handleKeyDown);
      // Restore focus
      previousFocus.current?.focus();
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-40 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

          {/* Menu Panel */}
          <motion.div
            ref={panelRef}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-white shadow-xl"
          >
            <div className="flex flex-col h-full pt-20 pb-8 px-6">
              {/* Navigation Links */}
              <nav className="flex flex-col gap-1" aria-label="Main navigation">
                {links.map((link, i) => (
                  <motion.div
                    key={link.href}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.05, duration: 0.3 }}
                  >
                    <Link
                      ref={i === 0 ? firstFocusable : undefined}
                      href={link.href}
                      onClick={onClose}
                      className="flex items-center justify-between px-4 py-3.5 text-lg font-medium text-aura-text hover:bg-aura-bg-warm rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-neon-violet focus-visible:outline-offset-2"
                    >
                      {link.label}
                      <ChevronRight className="w-4 h-4 text-aura-text-muted" />
                    </Link>
                  </motion.div>
                ))}
              </nav>

              {/* Divider */}
              <div className="my-6 h-px bg-aura-border" />

              {/* CTA Buttons */}
              <div className="flex flex-col gap-3 mt-auto">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.3 }}
                >
                  <a
                    href={ctaLinks.login}
                    className="flex items-center justify-center w-full px-5 py-3.5 text-sm font-semibold text-aura-text border border-aura-border rounded-xl hover:bg-aura-bg-warm transition-colors focus-visible:outline-2 focus-visible:outline-neon-violet focus-visible:outline-offset-2"
                  >
                    Log in
                  </a>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45, duration: 0.3 }}
                >
                  <a
                    href={ctaLinks.trial}
                    className="flex items-center justify-center w-full px-5 py-3.5 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-neon-violet via-aura-rose to-aura-amber focus-visible:outline-2 focus-visible:outline-neon-violet focus-visible:outline-offset-2"
                  >
                    Start Free Trial
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </a>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
