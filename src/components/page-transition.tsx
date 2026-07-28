"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Particle = {
  id: number;
  size: number;
  endX: number;
  endY: number;
};

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      const fromAttr =
        document.documentElement.getAttribute("data-reduced-motion") === "true";
      const fromStorage =
        localStorage.getItem("packwise-reduced-motion") === "1";
      setReduced(mq.matches || fromAttr || fromStorage);
    };
    sync();
    mq.addEventListener("change", sync);
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-reduced-motion"],
    });
    window.addEventListener("storage", sync);
    return () => {
      mq.removeEventListener("change", sync);
      observer.disconnect();
      window.removeEventListener("storage", sync);
    };
  }, []);

  return reduced;
}

function createParticles(): Particle[] {
  const count = 5 + Math.floor(Math.random() * 6); // 5–10
  return Array.from({ length: count }, (_, id) => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 40 + Math.random() * 80;
    return {
      id,
      size: 4 + Math.random() * 6,
      endX: Math.cos(angle) * distance,
      endY: Math.sin(angle) * distance,
    };
  });
}

function TransitionParticles({ burstKey }: { burstKey: string }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    setParticles(createParticles());
  }, [burstKey]);

  if (particles.length === 0) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
    >
      <AnimatePresence>
        {particles.map((particle) => (
          <motion.div
            key={`${burstKey}-${particle.id}`}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            initial={{ x: 0, y: 0, opacity: 0.7 }}
            animate={{
              x: particle.endX,
              y: particle.endY,
              opacity: 0,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            onAnimationComplete={() => {
              setParticles((prev) => prev.filter((p) => p.id !== particle.id));
            }}
          >
            <svg
              width={particle.size}
              height={particle.size}
              viewBox={`0 0 ${particle.size} ${particle.size}`}
              fill="none"
            >
              <circle
                cx={particle.size / 2}
                cy={particle.size / 2}
                r={particle.size / 2}
                className="fill-foreground/40"
              />
            </svg>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reducedMotion = usePrefersReducedMotion();

  if (reducedMotion) {
    return <div className="relative">{children}</div>;
  }

  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={pathname}
        className="relative"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
      >
        <TransitionParticles burstKey={pathname} />
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
