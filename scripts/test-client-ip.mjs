/**
 * Unit checks for getClientIp production vs spoofed XFF behavior.
 * Mirrors src/lib/client-ip.ts (no TS loader required).
 * Run: node scripts/test-client-ip.mjs
 */
function getClientIp(request, nodeEnv) {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  try {
    const realIp = request.headers.get("x-real-ip");
    if (realIp && process.env.NODE_ENV === "production") return realIp.trim();
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    return "127.0.0.1";
  } finally {
    process.env.NODE_ENV = prev;
  }
}

function req(headers) {
  return {
    headers: {
      get: (k) => headers[String(k).toLowerCase()] ?? null,
    },
  };
}

const cases = [
  {
    name: "prod prefers x-real-ip over spoofed XFF",
    env: "production",
    headers: {
      "x-real-ip": "203.0.113.10",
      "x-forwarded-for": "198.51.100.1, 203.0.113.10",
    },
    expect: "203.0.113.10",
  },
  {
    name: "prod with only XFF uses first hop",
    env: "production",
    headers: { "x-forwarded-for": "198.51.100.9, 203.0.113.10" },
    expect: "198.51.100.9",
  },
  {
    name: "dev uses XFF even if x-real-ip present",
    env: "development",
    headers: {
      "x-real-ip": "203.0.113.10",
      "x-forwarded-for": "198.51.100.1",
    },
    expect: "198.51.100.1",
  },
  {
    name: "fallback localhost",
    env: "development",
    headers: {},
    expect: "127.0.0.1",
  },
];

let failed = 0;
for (const c of cases) {
  const got = getClientIp(req(c.headers), c.env);
  const ok = got === c.expect;
  console.log(`${ok ? "PASS" : "FAIL"} ${c.name} => ${got}`);
  if (!ok) {
    console.log("  expected", c.expect);
    failed += 1;
  }
}
process.exit(failed ? 1 : 0);
