const LANDING_STYLES = `
@keyframes landing-sky-shift {
  0%, 100% {
    background-position: 0% 0%;
  }
  50% {
    background-position: 100% 100%;
  }
}
@keyframes landing-cloud-drift {
  0%, 100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(28px);
  }
}
@keyframes landing-plane-fly {
  0% {
    transform: translate(8%, 18%) rotate(-8deg);
    opacity: 0.85;
  }
  100% {
    transform: translate(78%, 8%) rotate(-6deg);
    opacity: 1;
  }
}
@keyframes landing-float-up {
  0% {
    transform: translateY(0);
    opacity: 0.45;
  }
  100% {
    transform: translateY(-120%);
    opacity: 0;
  }
}
.landing-sky {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    165deg,
    #ffd6e8 0%,
    #ffb3c6 22%,
    #ffc8a8 38%,
    #9bd4f5 62%,
    #5ba3d9 82%,
    #3d7eb8 100%
  );
  background-size: 220% 220%;
  animation: landing-sky-shift 20s ease-in-out infinite;
}
.dark .landing-sky {
  /* Deep navy dusk so the scene matches the dark palette instead of washing out. */
  background: linear-gradient(
    165deg,
    #1e1b4b 0%,
    #312e81 20%,
    #1e3a8a 42%,
    #155e75 66%,
    #0f2f4a 84%,
    #0b1a2b 100%
  );
  background-size: 220% 220%;
  animation: landing-sky-shift 20s ease-in-out infinite;
}
.landing-scrim {
  position: absolute;
  inset: 0;
  /* Keep the top open so sticky header chrome sits on the sky, not a white wash. */
  background: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0.12) 0%,
    rgba(255, 255, 255, 0.28) 18%,
    rgba(255, 255, 255, 0.55) 42%,
    rgba(255, 255, 255, 0.82) 70%,
    hsl(var(--background) / 0.95) 100%
  );
}
.dark .landing-scrim {
  background: linear-gradient(
    to bottom,
    hsl(var(--background) / 0.25) 0%,
    hsl(var(--background) / 0.4) 28%,
    hsl(var(--background) / 0.65) 55%,
    hsl(var(--background) / 0.85) 78%,
    hsl(var(--background) / 0.98) 100%
  );
}
.landing-scene-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  color: rgba(15, 23, 42, 0.55);
}
.dark .landing-scene-svg {
  color: rgba(226, 232, 240, 0.35);
}
.landing-cloud {
  animation: landing-cloud-drift 18s ease-in-out infinite;
}
.landing-cloud-slow {
  animation: landing-cloud-drift 26s ease-in-out infinite reverse;
}
.landing-plane-group {
  animation: landing-plane-fly 24s ease-in-out infinite alternate;
  transform-origin: center;
}
.landing-particle {
  position: absolute;
  bottom: -5%;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.55);
  animation: landing-float-up linear infinite;
}
.dark .landing-particle {
  background: rgba(255, 255, 255, 0.18);
}
@media (prefers-reduced-motion: reduce) {
  .landing-sky,
  .landing-cloud,
  .landing-cloud-slow,
  .landing-plane-group,
  .landing-particle {
    animation: none !important;
  }
}
`;

const PARTICLES = [
  { size: 6, left: "12%", delay: "0s", duration: "14s" },
  { size: 4, left: "28%", delay: "-4s", duration: "11s" },
  { size: 8, left: "44%", delay: "-8s", duration: "16s" },
  { size: 5, left: "61%", delay: "-2s", duration: "12s" },
  { size: 7, left: "76%", delay: "-10s", duration: "15s" },
  { size: 4, left: "88%", delay: "-6s", duration: "10s" },
] as const;

type LandingBackgroundProps = {
  className?: string;
};

export function LandingBackground({ className }: LandingBackgroundProps) {
  return (
    <div
      aria-hidden
      className={className ?? "pointer-events-none absolute inset-0 -z-0 overflow-hidden"}
    >
      <style dangerouslySetInnerHTML={{ __html: LANDING_STYLES }} />
      <div className="landing-sky" />
      <div className="landing-scrim" />

      <svg
        className="landing-scene-svg"
        viewBox="0 0 1440 520"
        preserveAspectRatio="xMidYMax slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="landing-mountain-far" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id="landing-mountain-near" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.5" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.75" />
          </linearGradient>
        </defs>

        <g className="landing-cloud-slow" opacity="0.9">
          <ellipse cx="220" cy="95" rx="72" ry="28" fill="currentColor" opacity="0.25" />
          <ellipse cx="280" cy="88" rx="54" ry="22" fill="currentColor" opacity="0.22" />
          <ellipse cx="170" cy="102" rx="48" ry="20" fill="currentColor" opacity="0.2" />
        </g>
        <g className="landing-cloud" opacity="0.95">
          <ellipse cx="620" cy="72" rx="86" ry="30" fill="currentColor" opacity="0.28" />
          <ellipse cx="700" cy="64" rx="62" ry="24" fill="currentColor" opacity="0.24" />
          <ellipse cx="560" cy="78" rx="52" ry="20" fill="currentColor" opacity="0.22" />
        </g>
        <g className="landing-cloud-slow" opacity="0.85">
          <ellipse cx="1080" cy="110" rx="78" ry="26" fill="currentColor" opacity="0.22" />
          <ellipse cx="1150" cy="102" rx="58" ry="22" fill="currentColor" opacity="0.2" />
        </g>

        <path
          d="M0 380 L180 280 L320 340 L480 240 L640 300 L820 220 L980 290 L1140 250 L1320 310 L1440 270 L1440 520 L0 520 Z"
          fill="url(#landing-mountain-far)"
        />
        <path
          d="M0 420 L240 340 L420 390 L600 320 L780 380 L960 330 L1180 400 L1440 360 L1440 520 L0 520 Z"
          fill="url(#landing-mountain-near)"
        />

        <path
          d="M120 140 Q420 200 720 120 T1320 100"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="6 10"
          strokeLinecap="round"
          opacity="0.45"
        />

        <g className="landing-plane-group">
          <g transform="translate(720, 120)">
            <path
              d="M-18 0 L14 -6 L18 0 L14 6 Z"
              fill="currentColor"
              opacity="0.85"
            />
            <path
              d="M-8 0 H10 M0 -4 V4"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              opacity="0.7"
            />
          </g>
        </g>
      </svg>

      <div className="absolute inset-0">
        {PARTICLES.map((particle, index) => (
          <span
            key={index}
            className="landing-particle"
            style={{
              width: particle.size,
              height: particle.size,
              left: particle.left,
              animationDelay: particle.delay,
              animationDuration: particle.duration,
            }}
          />
        ))}
      </div>
    </div>
  );
}
