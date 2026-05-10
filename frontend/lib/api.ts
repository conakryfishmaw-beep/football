import type { Dict } from "./i18n";

/**
 * API base URL resolution
 *
 * - Server side (SSR/RSC): calls happen from the Node process, so relative
 *   URLs like "/api" are invalid (no host). We read INTERNAL_API_URL first
 *   (direct backend on localhost:4000, no Nginx hop) and fall back to the
 *   public URL. Build-time env vars are fine here because Next inlines them.
 *
 * - Client side (browser): the fetch runs on the user's machine, so a
 *   relative URL "/api" is exactly what we want — the browser hits the same
 *   origin and Nginx proxies to the backend. This avoids CORS and works
 *   regardless of the public hostname/IP/domain.
 */
const INTERNAL_BASE =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:4000";

const PUBLIC_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";

function resolveUrl(path: string): string {
  // `typeof window` is "undefined" on the server, "object" in the browser.
  const base = typeof window === "undefined" ? INTERNAL_BASE : PUBLIC_BASE;

  // If the chosen base is a relative path (e.g. "/api"), only the browser
  // can use it — the server would produce an invalid URL. In practice the
  // server branch always uses INTERNAL_BASE (absolute) so this is a safety
  // net for accidental misconfiguration.
  if (base.startsWith("/") && typeof window === "undefined") {
    return `http://127.0.0.1:4000${path}`;
  }
  return `${base}${path}`;
}

export type PredictionType = "SIDE" | "HOME_SCORES" | "AWAY_SCORES" | "TOTAL_GOALS";
export type PredictionResult = "PENDING" | "WON" | "LOST" | "VOID";

export interface Prediction {
  id: number;
  match_id: number;
  prediction_type: PredictionType;
  predicted_value: string;
  confidence: number;
  reasoning: string;
  best_pick: boolean;
  result: PredictionResult;
  created_at: string;
  resolved_at: string | null;
}

export interface Match {
  id: number;
  league_id: number;
  league_name: string;
  season: number;
  match_date: string;
  home_team_id: number;
  home_team_name: string;
  away_team_id: number;
  away_team_name: string;
  home_goals: number | null;
  away_goals: number | null;
  status: string;
  venue: string | null;
  best_prediction?: Prediction | null;
}

export interface TeamStats {
  team_id: number;
  team_name: string;
  last10_played: number;
  last10_wins: number;
  last10_draws: number;
  last10_losses: number;
  last10_goals_for: number;
  last10_goals_against: number;
  last10_scored_pct: number;
  last10_clean_pct: number;
  last10_over25_pct: number;
  form_string: string;
}

export interface H2H {
  matches_played: number;
  team_a_wins: number;
  team_b_wins: number;
  draws: number;
  avg_total_goals: number;
}

export interface MatchDetail {
  match: Match;
  predictions: Prediction[];
  form: { home: TeamStats | null; away: TeamStats | null };
  h2h: H2H | null;
}

async function http<T>(path: string, revalidate = 0): Promise<T> {
  const res = await fetch(resolveUrl(path), { next: { revalidate } });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  listMatches: (scope: "yesterday" | "today" | "upcoming") =>
    http<{ matches: Match[]; count: number }>(`/matches?scope=${scope}`),
  matchDetail: (id: number | string) => http<MatchDetail>(`/matches/${id}`),
  archive: (params: Record<string, string | undefined>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
    return http<{ items: Match[]; count: number; limit: number; offset: number }>(
      `/archive?${qs.toString()}`
    );
  },
  summary: () =>
    http<{
      total: number;
      wins: number;
      losses: number;
      pending: number;
      success_rate: number;
      avg_confidence: number;
    }>(`/archive/summary`),
};

/* ---------- i18n-aware formatters ---------- */

export function labelPrediction(p: Prediction, dict: Dict): string {
  const L = dict.prediction_labels;
  switch (p.prediction_type) {
    case "SIDE":
      return p.predicted_value === "1"
        ? L.side_home
        : p.predicted_value === "2"
        ? L.side_away
        : L.side_draw;
    case "HOME_SCORES":
      return p.predicted_value === "YES" ? L.home_scores_yes : L.home_scores_no;
    case "AWAY_SCORES":
      return p.predicted_value === "YES" ? L.away_scores_yes : L.away_scores_no;
    case "TOTAL_GOALS":
      return p.predicted_value === "OVER_2_5" ? L.total_over : L.total_under;
    default:
      return p.predicted_value;
  }
}

export function resultBadge(result: PredictionResult, dict: Dict) {
  switch (result) {
    case "WON":
      return { text: dict.result.won, cls: "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30" };
    case "LOST":
      return { text: dict.result.lost, cls: "bg-rose-500/20 text-rose-300 border border-rose-400/30" };
    case "VOID":
      return { text: dict.result.void, cls: "bg-zinc-500/20 text-zinc-300 border border-zinc-400/30" };
    default:
      return { text: dict.result.pending, cls: "bg-amber-500/20 text-amber-300 border border-amber-400/30" };
  }
}

/** Locale-aware date formatter. `tr-TR` for Turkish, `en-GB` otherwise. */
export function formatMatchDate(iso: string, lang: "en" | "tr" = "en"): string {
  const d = new Date(iso);
  const locale = lang === "tr" ? "tr-TR" : "en-GB";
  return d.toLocaleString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
