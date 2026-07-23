"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MapPin } from "lucide-react";

const EVENTS = [
  { name: "Priya M.", city: "Mumbai", action: "started a free trial" },
  { name: "Rohit K.", city: "Delhi", action: "upgraded to Growth plan" },
  { name: "Anjali S.", city: "Bangalore", action: "booked a demo" },
  { name: "Vikram R.", city: "Hyderabad", action: "joined Aura Salon" },
  { name: "Sneha P.", city: "Pune", action: "started a free trial" },
  { name: "Amit T.", city: "Chennai", action: "upgraded to Growth plan" },
  { name: "Kavita D.", city: "Ahmedabad", action: "booked a demo" },
  { name: "Rajesh N.", city: "Jaipur", action: "joined Aura Salon" },
];

export function SocialProofToast() {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show first toast after 8 seconds, then cycle
    const showTimer = setTimeout(() => setVisible(true), 8000);

    const interval = setInterval(() => {
      setVisible(true);
      setCurrent((prev) => (prev + 1) % EVENTS.length);

      // Hide after 5 seconds
      setTimeout(() => setVisible(false), 5000);
    }, 15000);

    return () => {
      clearTimeout(showTimer);
      clearInterval(interval);
    };
  }, []);

  const event = EVENTS[current];

  return (
    <div className="fixed bottom-6 left-6 z-[9990] pointer-events-none">
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, x: -10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/90 backdrop-blur-xl border border-aura-border shadow-xl max-w-xs"
          >
            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-neon-violet to-aura-rose flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {event.name.charAt(0)}
            </div>

            {/* Text */}
            <div className="min-w-0">
              <div className="text-sm font-semibold text-aura-text truncate">
                {event.name}
              </div>
              <div className="flex items-center gap-1 text-xs text-aura-text-muted">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{event.city} · {event.action}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
