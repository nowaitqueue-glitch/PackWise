import { PageTransition } from "@/components/page-transition";

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageTransition>{children}</PageTransition>;
}
