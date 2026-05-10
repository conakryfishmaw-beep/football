import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AI Football Predictor",
  description: "Yapay zeka destekli futbol maç tahmin ve arşiv platformu",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-screen">
        <header className="border-b border-pitch-700 bg-pitch-900/70 backdrop-blur sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
              <span className="inline-block w-8 h-8 rounded-full bg-pitch-500 grid place-items-center">AI</span>
              <span>Football Predictor</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/" className="hover:text-pitch-300">Dashboard</Link>
              <Link href="/archive" className="hover:text-pitch-300">Arşiv</Link>
            </nav>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
        <footer className="max-w-6xl mx-auto px-4 py-10 text-center text-xs text-pitch-300/70">
          Tüm tahminler veritabanında şeffaf biçimde arşivlenir. Kaybeden tahmin silinmez.
        </footer>
      </body>
    </html>
  );
}
