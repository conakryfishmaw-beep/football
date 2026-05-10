import { api } from "@/lib/api";
import { MatchCard } from "@/components/MatchCard";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  from?: string;
  to?: string;
  leagueId?: string;
}

export default async function ArchivePage({ searchParams }: { searchParams: SearchParams }) {
  const { q = "", from = "", to = "", leagueId = "" } = searchParams;

  let items: any[] = [];
  let count = 0;
  try {
    const r = await api.archive({ q, from, to, leagueId });
    items = r.items;
    count = r.count;
  } catch {
    items = [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Arşiv & Arama</h1>
        <p className="text-pitch-300/80 text-sm">
          Geçmiş tüm tahminler — başarılı da, başarısız da. Takım adı veya tarih aralığı ile filtreleyin.
        </p>
      </div>

      <form method="get" className="card p-4 grid md:grid-cols-5 gap-3">
        <input className="input md:col-span-2" name="q" defaultValue={q} placeholder="Takım adı..." />
        <input className="input" name="from" type="date" defaultValue={from} />
        <input className="input" name="to" type="date" defaultValue={to} />
        <button className="btn btn-primary justify-center" type="submit">Ara</button>
      </form>

      <div className="text-sm text-pitch-300/80">{count} sonuç</div>

      {items.length === 0 ? (
        <div className="card p-8 text-center text-pitch-300/70">
          Sonuç bulunamadı.{" "}
          <Link className="underline" href="/archive">Filtreleri temizle</Link>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((m) => <MatchCard key={m.id} match={m} />)}
        </div>
      )}
    </div>
  );
}
