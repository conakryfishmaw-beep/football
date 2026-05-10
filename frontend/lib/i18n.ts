/**
 * Lightweight, dependency-free i18n for Next.js (App Router).
 *
 * - Default language: English.
 * - User can override via a cookie ("lang=tr" or "lang=en") through the LanguageToggle.
 * - Server components read the cookie to pick the dictionary; client components
 *   use the same dictionary passed down through a React context.
 */

export type Lang = "en" | "tr";

export const SUPPORTED_LANGS: Lang[] = ["en", "tr"];
export const DEFAULT_LANG: Lang = "en";
export const LANG_COOKIE = "lang";

export interface Dict {
  site: { title: string; tagline: string; footer: string };
  nav: { dashboard: string; archive: string };
  dashboard: {
    heading: string;
    intro: string;
    tab_yesterday: string;
    tab_today: string;
    tab_upcoming: string;
    yesterday_hit_rate: string;
    empty_yesterday: string;
    empty_today: string;
    empty_upcoming: string;
  };
  summary: {
    total: string;
    wins: string;
    losses: string;
    pending: string;
    success_avg_confidence: string;
  };
  archive: {
    heading: string;
    intro: string;
    placeholder_team: string;
    button_search: string;
    label_from: string;
    label_to: string;
    count_suffix: string;
    empty: string;
    clear_filters: string;
  };
  match: {
    back_to_dashboard: string;
    versus: string;
    ai_best_pick: string;
    confidence: string;
    four_alternatives: string;
    last10_form_home: string;
    last10_form_away: string;
    no_form: string;
    h2h_heading: string;
    h2h_matches: string;
    h2h_home_wins: string;
    h2h_draws: string;
    h2h_away_wins: string;
    h2h_avg_goals: string;
    h2h_empty: string;
    dash: string;
    stat_played: string;
    stat_wdl: string;
    stat_for_against: string;
    stat_scored_pct: string;
    stat_clean_pct: string;
    stat_over25_pct: string;
  };
  prediction_labels: {
    side_home: string;
    side_draw: string;
    side_away: string;
    home_scores_yes: string;
    home_scores_no: string;
    away_scores_yes: string;
    away_scores_no: string;
    total_over: string;
    total_under: string;
  };
  result: { won: string; lost: string; pending: string; void: string };
  pick_card: { ai_choice: string; no_prediction: string };
  language: { label: string; en: string; tr: string };
}

type DeepRecord = { [k: string]: string | DeepRecord };

export const dictionaries: Record<Lang, Dict> = {
  en: {
    site: {
      title: "AI Football Predictor",
      tagline:
        "AI-powered football match prediction and transparent archive platform.",
      footer:
        "Every prediction is transparently archived in the database. Losing picks are never deleted.",
    },
    nav: {
      dashboard: "Dashboard",
      archive: "Archive",
    },
    dashboard: {
      heading: "Dashboard",
      intro:
        "AI generates 4 distinct predictions per match; the one with the highest confidence is highlighted. All predictions are archived — losing picks are kept, too.",
      tab_yesterday: "Yesterday",
      tab_today: "Today",
      tab_upcoming: "Next 7 Days",
      yesterday_hit_rate: "Hit rate",
      empty_yesterday: "No predictions recorded for yesterday.",
      empty_today: "No matches scheduled for today.",
      empty_upcoming: "No fixtures for the next week.",
    },
    summary: {
      total: "Total predictions",
      wins: "Winning",
      losses: "Losing",
      pending: "Pending",
      success_avg_confidence: "Success / Avg. confidence",
    },
    archive: {
      heading: "Archive & Search",
      intro:
        "Every past prediction — the winners and the losers. Filter by team name or date range.",
      placeholder_team: "Team name…",
      button_search: "Search",
      label_from: "From",
      label_to: "To",
      count_suffix: "result(s)",
      empty: "No results.",
      clear_filters: "Clear filters",
    },
    match: {
      back_to_dashboard: "← Dashboard",
      versus: "VS",
      ai_best_pick: "AI Best Pick",
      confidence: "Confidence",
      four_alternatives: "All 4 Predictions",
      last10_form_home: "{team} – Last 10 form",
      last10_form_away: "{team} – Last 10 form",
      no_form: "No form data",
      h2h_heading: "Head-to-Head (last 5)",
      h2h_matches: "Matches",
      h2h_home_wins: "Home wins",
      h2h_draws: "Draws",
      h2h_away_wins: "Away wins",
      h2h_avg_goals: "Average total goals: {avg}",
      h2h_empty: "No H2H data available.",
      dash: "—",
      stat_played: "Played",
      stat_wdl: "W / D / L",
      stat_for_against: "Scored / Conceded",
      stat_scored_pct: "Matches scored in",
      stat_clean_pct: "Clean sheet matches",
      stat_over25_pct: "Over 2.5",
    },
    prediction_labels: {
      side_home: "Home team wins",
      side_draw: "Draw",
      side_away: "Away team wins",
      home_scores_yes: "Home team scores",
      home_scores_no: "Home team fails to score",
      away_scores_yes: "Away team scores",
      away_scores_no: "Away team fails to score",
      total_over: "Over 2.5",
      total_under: "Under 2.5",
    },
    result: {
      won: "Won",
      lost: "Lost",
      pending: "Pending",
      void: "Void",
    },
    pick_card: {
      ai_choice: "AI pick",
      no_prediction: "No prediction yet",
    },
    language: {
      label: "Language",
      en: "English",
      tr: "Türkçe",
    },
  },

  tr: {
    site: {
      title: "AI Football Predictor",
      tagline:
        "Yapay zeka destekli futbol maç tahmin ve şeffaf arşiv platformu.",
      footer:
        "Tüm tahminler veritabanında şeffaf biçimde arşivlenir. Kaybeden tahmin silinmez.",
    },
    nav: {
      dashboard: "Panel",
      archive: "Arşiv",
    },
    dashboard: {
      heading: "Panel",
      intro:
        "Yapay zeka her maç için 4 farklı tahmin üretir; en yüksek güvenli olan öne çıkarılır. Tüm tahminler arşivlenir — kaybeden de silinmez.",
      tab_yesterday: "Dün",
      tab_today: "Bugün",
      tab_upcoming: "Gelecek 7 Gün",
      yesterday_hit_rate: "Başarı",
      empty_yesterday: "Dün için tahmin kaydı bulunamadı.",
      empty_today: "Bugün programında maç yok.",
      empty_upcoming: "Önümüzdeki hafta için fikstür yok.",
    },
    summary: {
      total: "Toplam tahmin",
      wins: "Kazanan",
      losses: "Kaybeden",
      pending: "Bekleyen",
      success_avg_confidence: "Başarı / Ort. güven",
    },
    archive: {
      heading: "Arşiv & Arama",
      intro:
        "Geçmiş tüm tahminler — başarılı da, başarısız da. Takım adı veya tarih aralığı ile filtreleyin.",
      placeholder_team: "Takım adı…",
      button_search: "Ara",
      label_from: "Başlangıç",
      label_to: "Bitiş",
      count_suffix: "sonuç",
      empty: "Sonuç bulunamadı.",
      clear_filters: "Filtreleri temizle",
    },
    match: {
      back_to_dashboard: "← Panele dön",
      versus: "VS",
      ai_best_pick: "AI En İyi Tahmin",
      confidence: "Güven",
      four_alternatives: "4 Alternatif Tahmin",
      last10_form_home: "{team} – Son 10 Form",
      last10_form_away: "{team} – Son 10 Form",
      no_form: "Form verisi yok",
      h2h_heading: "İkili Rekabet (son 5)",
      h2h_matches: "Maç",
      h2h_home_wins: "Ev galibiyeti",
      h2h_draws: "Beraberlik",
      h2h_away_wins: "Dep galibiyeti",
      h2h_avg_goals: "Ortalama toplam gol: {avg}",
      h2h_empty: "H2H verisi bulunamadı.",
      dash: "—",
      stat_played: "Oynanan",
      stat_wdl: "G / B / M",
      stat_for_against: "Gol AT / Gol YE",
      stat_scored_pct: "Gol attığı maç",
      stat_clean_pct: "Gol yemediği maç",
      stat_over25_pct: "2.5 üstü",
    },
    prediction_labels: {
      side_home: "Ev sahibi kazanır",
      side_draw: "Beraberlik",
      side_away: "Deplasman kazanır",
      home_scores_yes: "Ev sahibi gol atar",
      home_scores_no: "Ev sahibi gol atamaz",
      away_scores_yes: "Deplasman gol atar",
      away_scores_no: "Deplasman gol atamaz",
      total_over: "2.5 Üst",
      total_under: "2.5 Alt",
    },
    result: {
      won: "Kazandı",
      lost: "Kaybetti",
      pending: "Beklemede",
      void: "İptal",
    },
    pick_card: {
      ai_choice: "AI seçimi",
      no_prediction: "Tahmin henüz üretilmedi",
    },
    language: {
      label: "Dil",
      en: "English",
      tr: "Türkçe",
    },
  },
};

/** Replace `{key}` placeholders in a translation string. */
export function format(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}

export function isLang(x: unknown): x is Lang {
  return x === "en" || x === "tr";
}

/** Pick a supported language from a free-form string (e.g. cookie or Accept-Language). */
export function resolveLang(value: string | undefined | null): Lang {
  if (!value) return DEFAULT_LANG;
  const v = value.toLowerCase();
  if (v.startsWith("tr")) return "tr";
  if (v.startsWith("en")) return "en";
  return DEFAULT_LANG;
}
