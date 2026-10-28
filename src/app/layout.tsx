import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toaster";
import { AuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
  title: "CorpSan — Sistema de Gestión Administrativa",
  description:
    "Sistema de gestión administrativa de Corporación Santamaría, C.A. · Talento humano sincronizado con Google Sheets.",
  icons: { icon: "/logo-santamaria.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
