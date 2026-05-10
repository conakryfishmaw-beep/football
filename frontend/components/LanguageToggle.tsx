"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Lang } from "@/lib/i18n";
import { LANG_COOKIE } from "@/lib/i18n";

/**
 * Simple EN/TR toggle: writes a cookie and refreshes the route so server
 * components re-render with the new dictionary.
 */
export function LanguageToggle({ current }: { current: Lang }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const switchTo = (next: Lang) => {
    if (next === current) return;
    // 1 year cookie, root path
    document.cookie = `${LANG_COOKIE}=${next}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    start(() => router.refresh());
  };

  const btn = (lang: Lang, label: string) => {
    const active = lang === current;
    return (
      <button
        type="button"
        onClick={() => switchTo(lang)}
        disabled={pending}
        aria-pressed={active}
        className={`px-2 py-1 text-xs font-medium rounded transition ${
          active
            ? "bg-pitch-500 text-white"
            : "text-pitch-300 hover:bg-pitch-800"
        } disabled:opacity-60`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex items-center gap-1 border border-pitch-700 rounded-md p-0.5">
      {btn("en", "EN")}
      {btn("tr", "TR")}
    </div>
  );
}
