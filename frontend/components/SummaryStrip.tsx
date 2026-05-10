export function SummaryStrip({
  total,
  wins,
  losses,
  pending,
  success_rate,
  avg_confidence,
}: {
  total: number;
  wins: number;
  losses: number;
  pending: number;
  success_rate: number;
  avg_confidence: number;
}) {
  const Item = ({ label, value, cls = "" }: { label: string; value: string | number; cls?: string }) => (
    <div className={`card px-4 py-3 ${cls}`}>
      <div className="text-xs text-pitch-300/80">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      <Item label="Toplam tahmin" value={total} />
      <Item label="Kazanan" value={wins} cls="text-emerald-300" />
      <Item label="Kaybeden" value={losses} cls="text-rose-300" />
      <Item label="Bekleyen" value={pending} cls="text-amber-300" />
      <Item label="Başarı / Ort. güven" value={`%${success_rate} / %${avg_confidence}`} />
    </div>
  );
}
