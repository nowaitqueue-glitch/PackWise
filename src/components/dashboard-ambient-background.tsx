"use client";

const PARTICLES = [
  { size: 48, left: "8%", delay: "0s", duration: "28s" },
  { size: 32, left: "22%", delay: "-6s", duration: "22s" },
  { size: 56, left: "45%", delay: "-12s", duration: "32s" },
  { size: 40, left: "68%", delay: "-4s", duration: "26s" },
  { size: 36, left: "84%", delay: "-18s", duration: "24s" },
  { size: 28, left: "55%", delay: "-9s", duration: "20s" },
] as const;

export function DashboardAmbientBackground() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-repeat text-foreground opacity-5"
        style={{
          backgroundImage: "url('/images/dashboard-travel-pattern.svg')",
          backgroundSize: "128px 128px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 hidden overflow-hidden motion-safe:block"
      >
        {PARTICLES.map((particle, index) => (
          <span
            key={index}
            className="absolute bottom-[-10%] rounded-full bg-primary/10 motion-safe:animate-dashboard-float"
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
    </>
  );
}