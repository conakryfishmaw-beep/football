/**
 * backfill
 * --------
 * Tek seferlik bir "backtest" / demo aracı.
 *
 * Kullanım:
 *   node src/jobs/backfill.js --from=2024-03-01 --to=2024-03-08 [--leagues=203,140] [--season=2023] [--limit=5]
 *
 * Ne yapar?
 *   Verilen tarih aralığındaki fikstürleri çeker (oynanmış olanlar dahil).
 *   Her maç için o anki form/H2H bilgisiyle tahmin motorunu çalıştırır.
 *   Bitmiş maçlarda sonucu biliyoruz -> grader ile WON/LOST olarak işaretler.
 *   Oynanmamış maçlarda tahmin PENDING kalır.
 *
 * Neden?
 *   1) AI motorumuzun geçmiş verideki "hit rate"ini sitede gösterebilelim.
 *   2) Ücretsiz API planı "cari" sezon verisi sunmadığından (çoğu zaman 2021-2023),
 *      en azından geçmiş sezonun bir haftasıyla site canlı görünsün.
 *
 * Quota uyarısı:
 *   Her maç ~3 istek harcar (iki takımın son 10'u + H2H). --limit ile sınırlayın.
 *
 * NOT: Tahmin motoruna verilen "son 10 maç" her zaman takımın
 * EN SON oynanmış maçlarıdır. Gerçek bir backtest için bu bir basitleştirme —
 * "verilen maç tarihinden önceki son 10" değil, "şu anki son 10"u kullanır.
 * Yine de AI çıktısının nasıl göründüğünü demo etmek için yeterlidir.
 */

import "dotenv/config";
import {
  getFixturesByDateRange,
  getTeamLastMatches,
  getH2H,
} from "../services/apiFootball.js";
import { buildTeamForm, buildH2H } from "../services/statsBuilder.js";
import { buildPredictions } from "../engine/predictor.js";
import { gradePrediction } from "../engine/grader.js";
import {
  upsertMatchFromFixture,
  upsertPrediction,
  upsertTeamStats,
  upsertH2H,
  setPredictionResult,
  getPredictionsForMatch,
  pool,
} from "../db/repository.js";

function parseArgs(argv) {
  const out = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const args = parseArgs(process.argv);

const FROM    = args.from    ?? "2024-03-01";
const TO      = args.to      ?? "2024-03-08";
const LEAGUES = (args.leagues ?? process.env.LEAGUE_IDS ?? "203,140")
  .split(",").map((s) => Number(s.trim())).filter(Boolean);
const SEASON  = Number(args.season ?? process.env.SEASON ?? 2023);
const LIMIT   = Number(args.limit ?? 5);      // lig başına işlenecek maç sayısı
const LEAGUE_AVG_GOALS = Number(process.env.LEAGUE_AVG_GOALS) || 2.7;

const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);
const CLOSED_STATUSES   = new Set(["PST", "CANC"]);

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  console.log(`[backfill] ${FROM} → ${TO}, leagues=${LEAGUES.join(",")}, season=${SEASON}, limit=${LIMIT}/league`);

  let totalFixtures = 0;
  let totalPredicted = 0;
  let totalGraded = 0;

  for (const league of LEAGUES) {
    let fixtures = [];
    try {
      fixtures = await getFixturesByDateRange({ from: FROM, to: TO, league, season: SEASON });
    } catch (err) {
      console.error(`[backfill] league=${league} fetch failed:`, err.message);
      continue;
    }
    console.log(`[backfill] league=${league} fixtures=${fixtures.length} (using first ${LIMIT})`);
    totalFixtures += fixtures.length;

    const slice = fixtures.slice(0, LIMIT);
    for (const fx of slice) {
      try {
        const { predicted, graded } = await processFixture(fx);
        if (predicted) totalPredicted++;
        if (graded)    totalGraded++;
        await sleep(200);                 // API rate-limit için nazik bekleme
      } catch (err) {
        console.error(`[backfill] fixture=${fx.fixture?.id} error:`, err.message);
      }
    }
  }

  console.log(`[backfill] done. fixtures_seen=${totalFixtures} predicted=${totalPredicted} graded=${totalGraded}`);
  await pool.end();
}

async function processFixture(fx) {
  // 1) Maç kaydı
  await upsertMatchFromFixture(fx);
  const status = fx.fixture?.status?.short;

  // İptal/ertelenmişleri atla
  if (CLOSED_STATUSES.has(status)) {
    console.log(`  - skipped (${status}): ${fx.teams.home.name} vs ${fx.teams.away.name}`);
    return { predicted: false, graded: false };
  }

  const homeId = fx.teams.home.id;
  const awayId = fx.teams.away.id;

  // 2) Form + H2H
  const [homeLast, awayLast, h2hList] = await Promise.all([
    getTeamLastMatches({ team: homeId, last: 10 }),
    getTeamLastMatches({ team: awayId, last: 10 }),
    getH2H({ teamA: homeId, teamB: awayId, last: 5 }),
  ]);
  const homeForm = buildTeamForm(homeLast, homeId, 10);
  const awayForm = buildTeamForm(awayLast, awayId, 10);
  const h2h = buildH2H(h2hList, homeId, awayId, 5);

  // 3) Cache
  await upsertTeamStats({
    team_id: homeId,
    team_name: fx.teams.home.name,
    league_id: fx.league.id,
    season: fx.league.season,
    ...homeForm,
    raw: homeLast.slice(0, 10),
  });
  await upsertTeamStats({
    team_id: awayId,
    team_name: fx.teams.away.name,
    league_id: fx.league.id,
    season: fx.league.season,
    ...awayForm,
    raw: awayLast.slice(0, 10),
  });
  await upsertH2H({
    team_a_id: homeId,
    team_b_id: awayId,
    ...h2h,
    raw: h2hList.slice(0, 5),
  });

  // 4) Tahmin üret
  const { predictions, bestPick } = buildPredictions({
    home: homeForm,
    away: awayForm,
    h2h,
    leagueAvgGoals: LEAGUE_AVG_GOALS,
  });

  for (const p of predictions) {
    await upsertPrediction({
      match_id: fx.fixture.id,
      prediction_type: p.prediction_type,
      predicted_value: p.predicted_value,
      confidence: p.confidence,
      reasoning: p.reasoning,
      best_pick: !!p.best_pick,
    });
  }

  console.log(
    `  ✓ ${fx.teams.home.name} vs ${fx.teams.away.name}` +
    ` → best pick: ${bestPick.prediction_type}=${bestPick.predicted_value} (conf ${bestPick.confidence})`
  );

  // 5) Eğer maç bittiyse, tahminleri hemen derecelendir
  let graded = false;
  if (FINISHED_STATUSES.has(status) && fx.goals.home != null && fx.goals.away != null) {
    const storedPreds = await getPredictionsForMatch(fx.fixture.id);
    for (const sp of storedPreds) {
      const result = gradePrediction(
        { home_goals: fx.goals.home, away_goals: fx.goals.away, status },
        { prediction_type: sp.prediction_type, predicted_value: sp.predicted_value }
      );
      if (result === "WON" || result === "LOST") {
        await setPredictionResult(sp.id, result);
      }
    }
    graded = true;
    const best = storedPreds.find((p) => p.best_pick);
    if (best) {
      const bestResult = gradePrediction(
        { home_goals: fx.goals.home, away_goals: fx.goals.away, status },
        { prediction_type: best.prediction_type, predicted_value: best.predicted_value }
      );
      console.log(
        `    score: ${fx.goals.home}-${fx.goals.away}` +
        ` → best pick ${bestResult}`
      );
    }
  }

  return { predicted: true, graded };
}

main().catch((err) => {
  console.error("[backfill] fatal:", err);
  process.exit(1);
});
