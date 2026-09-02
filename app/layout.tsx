import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DB Studio",
  description: "Explorador de schema, ERD y datos para estudiar la base",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
