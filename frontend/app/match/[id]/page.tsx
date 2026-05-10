import { api, labelPrediction, resultBadge, formatMatchDate, TeamStats } from "@/lib/api";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict } from "@/lib/server-i18n";
import type { Dict } from "@/lib/i18n";

export const dynamic = "force-dynamic";

function FormBar({ s, dict }: { s: TeamStats | null; dict: Dict }) {
  if (!s) return <div className="text-pitch-300/70 text-sm">{dict.match.no_form}</div>;
  const chars = (s.form_string || "").split("").slice(0, 10);
  return (
    <div>
      <div className="flex gap-1">
        {chars.length === 0 && <span className="text-pitch-300/70 text-sm">{dict.match.dash}</span>}
        {chars.map((c, i) => {
          const cls =
            c === "W" ? "bg-emerald-500 text-emerald-950"
            : c === "D" ? "bg-amber-500 text-amber-950"
            : "bg-rose-500 text-rose-950";
          return (
            <span key={i} className={`w-7 h-7 grid place-items-center rounded font-bold text-xs ${cls}`}>
              {c}
            </span>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
        <span className="text-pitch-300/80">{dict.match.stat_played}</span><span>{s.last10_played}</span>
        <span className="text-pitch-300/80">{dict.match.stat_wdl}</span><span>{s.last10_wins} / {s.last10_draws} / {s.last10_losses}</span>
        <span className="text-pitch-300/80">{dict.match.stat_for_against}</span><span>{s.last10_goals_for} / {s.last10_goals_against}</span>
        <span className="text-pitch-300/80">{dict.match.stat_scored_pct}</span><span>%{s.last10_scored_pct}</span>
        <span className="text-pitch-300/80">{dict.match.stat_clean_pct}</span><span>%{s.last10_clean_pct}</span>
        <span className="text-pitch-300/80">{dict.match.stat_over25_pct}</span><span>%{s.last10_over25_pct}</span>
      </div>
    </div>
  );
}

export default async function MatchDetailPage({ params }: { params: { id: string } }) {
  const { lang, dict } = getDict();
  let data;
  try {
    data = await api.matchDetail(params.id);
  } catch {
    return notFound();
  }

  const { match, predictions, form, h2h } = data;
  const best = predictions.find((p) => p.best_pick) ?? predictions[0];
  const finished = match.home_goals != null && match.away_goals != null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-pitch-300 hover:underline">
          {dict.match.back_to_dashboard}
        </Link>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between text-xs text-pitch-300/80">
          <span>{match.league_name}</span>
          <span>{formatMatchDate(match.match_date, lang)}</span>
        </div>
        <div className="mt-4 grid grid-cols-5 items-center gap-4">
          <div className="col-span-2 text-right">
            <div className="text-lg md:text-2xl font-semibold">{match.home_team_name}</div>
          </div>
          <div className="text-center text-3xl font-bold">
            {finished ? `${match.home_goals} - ${match.away_goals}` : dict.match.versus}
          </div>
          <div className="col-span-2">
            <div className="text-lg md:text-2xl font-semibold">{match.away_team_name}</div>
          </div>
        </div>
        {match.venue && <div className="mt-3 text-xs text-pitch-300/70 text-center">{match.venue}</div>}
      </div>

      {best && (
        <div className="card p-6">
          <div className="text-sm text-pitch-300/80">{dict.match.ai_best_pick}</div>
          <div className="mt-1 flex items-center flex-wrap gap-3">
            <div className="text-xl font-semibold">{labelPrediction(best, dict)}</div>
            <span className="badge bg-pitch-500/20 text-pitch-300 border border-pitch-500/40">
              {dict.match.confidence} %{Number(best.confidence).toFixed(1)}
            </span>
            <span className={`badge ${resultBadge(best.result, dict).cls}`}>
              {resultBadge(best.result, dict).text}
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-pitch-300/90">{best.reasoning}</p>
        </div>
      )}

      <div className="card p-6">
        <div className="text-sm text-pitch-300/80 mb-3">{dict.match.four_alternatives}</div>
        <div className="grid gap-3 md:grid-cols-2">
          {predictions.map((p) => {
            const b = resultBadge(p.result, dict);
            return (
              <div
                key={p.id}
                className={`border rounded-lg p-3 ${p.best_pick ? "border-pitch-500 bg-pitch-500/5" : "border-pitch-700"}`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium">{labelPrediction(p, dict)}</div>
                  <span className={`badge ${b.cls}`}>{b.text}</span>
                </div>
                <div className="mt-1 text-xs text-pitch-300/70">
                  {p.prediction_type} • {dict.match.confidence} %{Number(p.confidence).toFixed(1)}
                </div>
                <p className="mt-2 text-xs text-pitch-300/80">{p.reasoning}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-6">
          <div className="text-sm text-pitch-300/80 mb-3">
            {dict.match.last10_form_home.replace("{team}", match.home_team_name)}
          </div>
          <FormBar s={form.home} dict={dict} />
        </div>
        <div className="card p-6">
          <div className="text-sm text-pitch-300/80 mb-3">
            {dict.match.last10_form_away.replace("{team}", match.away_team_name)}
          </div>
          <FormBar s={form.away} dict={dict} />
        </div>
      </div>

      <div className="card p-6">
        <div className="text-sm text-pitch-300/80 mb-3">{dict.match.h2h_heading}</div>
        {h2h && h2h.matches_played > 0 ? (
          <div className="grid grid-cols-4 gap-3 text-center">
            <div><div className="text-2xl font-bold">{h2h.matches_played}</div><div className="text-xs text-pitch-300/70">{dict.match.h2h_matches}</div></div>
            <div><div className="text-2xl font-bold text-emerald-300">{h2h.team_a_wins}</div><div className="text-xs text-pitch-300/70">{dict.match.h2h_home_wins}</div></div>
            <div><div className="text-2xl font-bold text-amber-300">{h2h.draws}</div><div className="text-xs text-pitch-300/70">{dict.match.h2h_draws}</div></div>
            <div><div className="text-2xl font-bold text-rose-300">{h2h.team_b_wins}</div><div className="text-xs text-pitch-300/70">{dict.match.h2h_away_wins}</div></div>
            <div className="col-span-4 text-xs text-pitch-300/70">
              {dict.match.h2h_avg_goals.replace("{avg}", String(h2h.avg_total_goals))}
            </div>
          </div>
        ) : (
          <div className="text-pitch-300/70 text-sm">{dict.match.h2h_empty}</div>
        )}
      </div>
    </div>
  );
}
