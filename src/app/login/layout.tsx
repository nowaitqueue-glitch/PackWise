import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in or create a PackWise account with email and password, or continue with Google.",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Intentionally no PageTransition — keeps framer-motion off the auth First Load JS.
  return children;
}
