"use client";

import { useRef, useState, useCallback } from "react";
import { motion, useInView, AnimatePresence } from "motion/react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { GridBackground } from "@/components/ui/GridBackground";

export function VideoDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(false);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  return (
    <section ref={ref} className="relative py-24 md:py-32 bg-deep-navy overflow-hidden">
      <GridBackground className="opacity-10" />

      {/* Floating orbs */}
      <div className="absolute top-20 left-[10%] w-72 h-72 rounded-full bg-neon-violet/10 blur-[120px] animate-float" />
      <div className="absolute bottom-20 right-[10%] w-80 h-80 rounded-full bg-aura-rose/8 blur-[120px] animate-float" style={{ animationDelay: "2s" }} />

      <Container className="relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-neon-violet/20 text-neon-violet mb-4">
            <Play className="w-3 h-3" />
            Product Demo
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight">
            See Aura in Action
          </h2>
          <p className="mt-3 text-base text-white/50 max-w-xl mx-auto">
            Watch how Aura transforms salon operations — from booking to billing to growth analytics.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative max-w-4xl mx-auto"
          onMouseEnter={() => setShowControls(true)}
          onMouseLeave={() => setShowControls(false)}
        >
          {/* Glow */}
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-neon-violet/20 via-aura-rose/15 to-aura-amber/10 blur-2xl" />

          {/* Video frame */}
          <div className="relative rounded-2xl border border-white/10 overflow-hidden bg-black/50 shadow-2xl">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border-b border-white/10">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
              </div>
              <div className="flex-1 mx-4">
                <div className="bg-white/5 rounded-lg px-3 py-1 text-xs text-white/30 border border-white/5">
                  app.aurasalon.in
                </div>
              </div>
            </div>

            {/* Video */}
            <div className="relative aspect-video">
              <video
                ref={videoRef}
                autoPlay
                muted
                loop
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
                aria-label="Aura Salon product demo video"
              >
                <source src="/demo.mp4" type="video/mp4" />
              </video>

              {/* Center play/pause button — visible on hover or when paused */}
              <AnimatePresence>
                {(!isPlaying || showControls) && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                    onClick={togglePlay}
                    className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer"
                    aria-label={isPlaying ? "Pause video" : "Play video"}
                  >
                    <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 hover:bg-white/20 transition-colors">
                      {isPlaying ? (
                        <Pause className="w-8 h-8 text-white" />
                      ) : (
                        <Play className="w-8 h-8 text-white ml-1" />
                      )}
                    </div>
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Bottom controls bar */}
              <AnimatePresence>
                {showControls && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent"
                  >
                    <div className="flex items-center justify-between">
                      <button
                        onClick={togglePlay}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                        aria-label={isPlaying ? "Pause" : "Play"}
                      >
                        {isPlaying ? (
                          <Pause className="w-4 h-4 text-white" />
                        ) : (
                          <Play className="w-4 h-4 text-white" />
                        )}
                      </button>
                      <button
                        onClick={toggleMute}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                        aria-label={isMuted ? "Unmute" : "Mute"}
                      >
                        {isMuted ? (
                          <VolumeX className="w-4 h-4 text-white/60" />
                        ) : (
                          <Volume2 className="w-4 h-4 text-white" />
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Caption */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.8 }}
            className="text-center text-sm text-white/30 mt-4"
          >
            Full product walkthrough — 3 minutes
          </motion.p>
        </motion.div>
      </Container>
    </section>
  );
}
