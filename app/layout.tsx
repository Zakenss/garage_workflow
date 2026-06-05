import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Garage Workflow",
  description: "Gestion de workflow véhicules — garage",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased text-slate-900">{children}</body>
    </html>
  );
}
