import { api, Match } from "@/lib/api";
import { MatchCard } from "@/components/MatchCard";
import Link from "next/link";
import { getDict } from "@/lib/server-i18n";

export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  from?: string;
  to?: string;
  leagueId?: string;
}

export default async function ArchivePage({ searchParams }: { searchParams: SearchParams }) {
  const { lang, dict } = getDict();
  const { q = "", from = "", to = "", leagueId = "" } = searchParams;

  let items: Match[] = [];
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
        <h1 className="text-2xl font-semibold">{dict.archive.heading}</h1>
        <p className="text-pitch-300/80 text-sm">{dict.archive.intro}</p>
      </div>

      <form method="get" className="card p-4 grid md:grid-cols-5 gap-3">
        <input
          className="input md:col-span-2"
          name="q"
          defaultValue={q}
          placeholder={dict.archive.placeholder_team}
        />
        <input className="input" name="from" type="date" defaultValue={from} aria-label={dict.archive.label_from} />
        <input className="input" name="to" type="date" defaultValue={to} aria-label={dict.archive.label_to} />
        <button className="btn btn-primary justify-center" type="submit">
          {dict.archive.button_search}
        </button>
      </form>

      <div className="text-sm text-pitch-300/80">{count} {dict.archive.count_suffix}</div>

      {items.length === 0 ? (
        <div className="card p-8 text-center text-pitch-300/70">
          {dict.archive.empty}{" "}
          <Link className="underline" href="/archive">{dict.archive.clear_filters}</Link>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((m) => <MatchCard key={m.id} match={m} dict={dict} lang={lang} />)}
        </div>
      )}
    </div>
  );
}
