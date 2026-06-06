import { Suspense } from "react";
import { LoadingPage } from "@/components/LoadingPage";

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<LoadingPage label="Chargement de la page de connexion…" />}>
      {children}
    </Suspense>
  );
}
