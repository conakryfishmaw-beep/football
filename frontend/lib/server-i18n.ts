import { cookies, headers } from "next/headers";
import {
  DEFAULT_LANG,
  LANG_COOKIE,
  dictionaries,
  isLang,
  resolveLang,
  type Dict,
  type Lang,
} from "./i18n";

/**
 * Server-side helper: resolve the active language for the current request.
 * Order of precedence:
 *   1. `lang` cookie (explicit user override)
 *   2. `Accept-Language` header (browser default)
 *   3. DEFAULT_LANG (English)
 */
export function getLang(): Lang {
  const cookieLang = cookies().get(LANG_COOKIE)?.value;
  if (cookieLang && isLang(cookieLang)) return cookieLang;

  const accept = headers().get("accept-language");
  if (accept) return resolveLang(accept.split(",")[0]);

  return DEFAULT_LANG;
}

export function getDict(lang?: Lang): { lang: Lang; dict: Dict } {
  const l = lang ?? getLang();
  return { lang: l, dict: dictionaries[l] };
}

export function t(path: string, params?: Record<string, string | number>): string {
  const { dict } = getDict();
  const parts = path.split(".");
  let node: unknown = dict;
  for (const p of parts) {
    if (node && typeof node === "object" && p in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[p];
    } else {
      return path;
    }
  }
  if (typeof node !== "string") return path;
  if (!params) return node;
  return node.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}
