import type { Metadata } from "next";
import "./globals.css";
import { getServerSession } from "@/lib/session";
import { SessionProvider } from "@/lib/session-context";

export const metadata: Metadata = {
  title: "Garage Workflow",
  description: "Gestion de workflow véhicules — garage",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getServerSession();
  return (
    <html lang="fr">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <SessionProvider value={user}>{children}</SessionProvider>
      </body>
    </html>
  );
}
