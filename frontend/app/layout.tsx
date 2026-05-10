import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { getDict } from "@/lib/server-i18n";
import { I18nProvider } from "@/components/I18nProvider";
import { LanguageToggle } from "@/components/LanguageToggle";

export const metadata: Metadata = {
  title: "AI Football Predictor",
  description: "AI-powered football match prediction and transparent archive platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { lang, dict } = getDict();

  return (
    <html lang={lang}>
      <body className="min-h-screen">
        <I18nProvider lang={lang} dict={dict}>
          <header className="border-b border-pitch-700 bg-pitch-900/70 backdrop-blur sticky top-0 z-10">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
                <span className="inline-block w-8 h-8 rounded-full bg-pitch-500 grid place-items-center">AI</span>
                <span>{dict.site.title}</span>
              </Link>
              <nav className="flex items-center gap-4 text-sm">
                <Link href="/" className="hover:text-pitch-300">{dict.nav.dashboard}</Link>
                <Link href="/archive" className="hover:text-pitch-300">{dict.nav.archive}</Link>
                <LanguageToggle current={lang} />
              </nav>
            </div>
          </header>
          <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
          <footer className="max-w-6xl mx-auto px-4 py-10 text-center text-xs text-pitch-300/70">
            {dict.site.footer}
          </footer>
        </I18nProvider>
      </body>
    </html>
  );
}
