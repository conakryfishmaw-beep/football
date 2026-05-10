import Link from "next/link";
import { Match, labelPrediction, resultBadge, formatMatchDate } from "@/lib/api";

export function MatchCard({ match }: { match: Match }) {
  const bp = match.best_prediction;
  const badge = bp ? resultBadge(bp.result) : null;
  const finished = match.home_goals != null && match.away_goals != null;

  return (
    <Link href={`/match/${match.id}`} className="card p-4 block hover:border-pitch-500 transition">
      <div className="flex items-center justify-between text-xs text-pitch-300/80">
        <span>{match.league_name}</span>
        <span>{formatMatchDate(match.match_date)}</span>
      </div>

      <div className="mt-2 grid grid-cols-5 items-center gap-2">
        <div className="col-span-2 text-right font-medium truncate">{match.home_team_name}</div>
        <div className="text-center text-lg font-semibold">
          {finished ? `${match.home_goals} - ${match.away_goals}` : "vs"}
        </div>
        <div className="col-span-2 font-medium truncate">{match.away_team_name}</div>
      </div>

      {bp ? (
        <div className="mt-3 flex items-center justify-between text-sm border-t border-pitch-700 pt-3">
          <div className="flex flex-col">
            <span className="text-pitch-300/80 text-xs">AI seçimi</span>
            <span className="font-semibold">{labelPrediction(bp)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge bg-pitch-500/20 text-pitch-300 border border-pitch-500/40">
              Güven %{Number(bp.confidence).toFixed(1)}
            </span>
            {badge && <span className={`badge ${badge.cls}`}>{badge.text}</span>}
          </div>
        </div>
      ) : (
        <div className="mt-3 text-sm text-pitch-300/60 border-t border-pitch-700 pt-3">
          Tahmin henüz üretilmedi
        </div>
      )}
    </Link>
  );
}
