import { api, Match } from "@/lib/api";
import { MatchCard } from "@/components/MatchCard";
import { Tabs } from "@/components/Tabs";
import { SummaryStrip } from "@/components/SummaryStrip";

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

function MatchList({ matches, emptyText }: { matches: Match[]; emptyText: string }) {
  if (!matches.length) {
    return (
      <div className="card p-8 text-center text-pitch-300/70">
        {emptyText}
      </div>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {matches.map((m) => <MatchCard key={m.id} match={m} />)}
    </div>
  );
}

export default async function DashboardPage() {
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
    : "—";

  const tabs = [
    {
      id: "yesterday",
      label: `Dün (${wonYesterday}/${totalGradedYesterday} • %${yesterdayRate})`,
      content: <MatchList matches={yesterday} emptyText="Dün için tahmin kaydı bulunamadı." />,
    },
    {
      id: "today",
      label: `Bugün (${today.length})`,
      content: <MatchList matches={today} emptyText="Bugün programında maç yok." />,
    },
    {
      id: "upcoming",
      label: `Gelecek 7 Gün (${upcoming.length})`,
      content: <MatchList matches={upcoming} emptyText="Önümüzdeki hafta için fikstür yok." />,
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-pitch-300/80 text-sm">
          AI, her maç için 4 farklı tahmin üretir; en yüksek güven skorlu olan öne çıkarılır.
          Tüm tahminler arşivlenir — kaybeden de silinmez.
        </p>
      </div>

      <SummaryStrip {...summary} />
      <Tabs tabs={tabs} initial="today" />
    </div>
  );
}
