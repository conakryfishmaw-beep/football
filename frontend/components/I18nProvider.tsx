"use client";

import { createContext, useContext, ReactNode } from "react";
import type { Dict, Lang } from "@/lib/i18n";
import { format } from "@/lib/i18n";

interface Ctx {
  lang: Lang;
  dict: Dict;
  t: (path: string, params?: Record<string, string | number>) => string;
}

const I18nCtx = createContext<Ctx | null>(null);

/**
 * Resolve a dotted translation key against a dictionary. Missing keys render the
 * raw key so typos are visible during development.
 */
function lookup(dict: Dict, path: string): string {
  const parts = path.split(".");
  let node: unknown = dict;
  for (const p of parts) {
    if (node && typeof node === "object" && p in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[p];
    } else {
      return path;
    }
  }
  return typeof node === "string" ? node : path;
}

export function I18nProvider({
  lang,
  dict,
  children,
}: {
  lang: Lang;
  dict: Dict;
  children: ReactNode;
}) {
  const t = (path: string, params?: Record<string, string | number>) =>
    format(lookup(dict, path), params);

  return <I18nCtx.Provider value={{ lang, dict, t }}>{children}</I18nCtx.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
