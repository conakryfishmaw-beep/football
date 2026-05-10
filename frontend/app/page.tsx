import { api, Match } from "@/lib/api";
import { MatchCard } from "@/components/MatchCard";
import { Tabs } from "@/components/Tabs";
import { SummaryStrip } from "@/components/SummaryStrip";
import { getDict } from "@/lib/server-i18n";
import type { Dict, Lang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

async function safeList(scope: "yesterday" | "today" | "upcoming"): Promise<Match[]> {
  try {
    const { matches } = await api.listMatches(scope);
    return matches;
  } catch {
    return [];
  }
}

async function safeSummary() {
  try {
    return await api.summary();
  } catch {
    return { total: 0, wins: 0, losses: 0, pending: 0, success_rate: 0, avg_confidence: 0 };
  }
}

function MatchList({
  matches,
  emptyText,
  dict,
  lang,
}: {
  matches: Match[];
  emptyText: string;
  dict: Dict;
  lang: Lang;
}) {
  if (!matches.length) {
    return (
      <div className="card p-8 text-center text-pitch-300/70">
        {emptyText}
      </div>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {matches.map((m) => <MatchCard key={m.id} match={m} dict={dict} lang={lang} />)}
    </div>
  );
}

export default async function DashboardPage() {
  const { lang, dict } = getDict();

  const [yesterday, today, upcoming, summary] = await Promise.all([
    safeList("yesterday"),
    safeList("today"),
    safeList("upcoming"),
    safeSummary(),
  ]);

  const wonYesterday = yesterday.filter((m) => m.best_prediction?.result === "WON").length;
  const totalGradedYesterday = yesterday.filter(
    (m) => m.best_prediction && m.best_prediction.result !== "PENDING"
  ).length;
  const yesterdayRate = totalGradedYesterday > 0
    ? ((wonYesterday / totalGradedYesterday) * 100).toFixed(1)
    : dict.match.dash;

  const tabs = [
    {
      id: "yesterday",
      label: `${dict.dashboard.tab_yesterday} (${wonYesterday}/${totalGradedYesterday} • %${yesterdayRate})`,
      content: <MatchList matches={yesterday} emptyText={dict.dashboard.empty_yesterday} dict={dict} lang={lang} />,
    },
    {
      id: "today",
      label: `${dict.dashboard.tab_today} (${today.length})`,
      content: <MatchList matches={today} emptyText={dict.dashboard.empty_today} dict={dict} lang={lang} />,
    },
    {
      id: "upcoming",
      label: `${dict.dashboard.tab_upcoming} (${upcoming.length})`,
      content: <MatchList matches={upcoming} emptyText={dict.dashboard.empty_upcoming} dict={dict} lang={lang} />,
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{dict.dashboard.heading}</h1>
        <p className="text-pitch-300/80 text-sm">{dict.dashboard.intro}</p>
      </div>

      <SummaryStrip {...summary} dict={dict} />
      <Tabs tabs={tabs} initial="today" />
    </div>
  );
}
