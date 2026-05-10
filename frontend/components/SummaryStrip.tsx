import type { Dict } from "@/lib/i18n";

export function SummaryStrip({
  total,
  wins,
  losses,
  pending,
  success_rate,
  avg_confidence,
  dict,
}: {
  total: number;
  wins: number;
  losses: number;
  pending: number;
  success_rate: number;
  avg_confidence: number;
  dict: Dict;
}) {
  const Item = ({ label, value, cls = "" }: { label: string; value: string | number; cls?: string }) => (
    <div className={`card px-4 py-3 ${cls}`}>
      <div className="text-xs text-pitch-300/80">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      <Item label={dict.summary.total} value={total} />
      <Item label={dict.summary.wins} value={wins} cls="text-emerald-300" />
      <Item label={dict.summary.losses} value={losses} cls="text-rose-300" />
      <Item label={dict.summary.pending} value={pending} cls="text-amber-300" />
      <Item
        label={dict.summary.success_avg_confidence}
        value={`%${success_rate} / %${avg_confidence}`}
      />
    </div>
  );
}
