import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/app-shell";
import { getServerRoleFromHeaders } from "@/lib/auth/server-role";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sentura Dashboard",
  description: "Enterprise AI Employee Management Platform",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Resolve the role at the server so SSR renders the correct sidebar on
  // first paint. Client mount effect re-syncs with `?as=<role>` URL overrides.
  const initialRole = await getServerRoleFromHeaders();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full">
        <TooltipProvider delay={0}>
          <AppShell initialRole={initialRole}>{children}</AppShell>
        </TooltipProvider>
      </body>
    </html>
  );
}
