/**
 * backfill
 * --------
 * Tek seferlik bir "backtest" / demo araci.
 *
 * Kullanim:
 *   node src/jobs/backfill.js --from=2025-05-01 --to=2025-05-31 \
 *     [--leagues=203,140] [--season=2024] [--limit=10] [--useCutoff=true]
 *
 * Ne yapar?
 *   Verilen tarih araligindaki fiksturleri ceker (oynanmis olanlar dahil).
 *   Her mac icin o anki form/H2H bilgisiyle tahmin motorunu calistirir.
 *   Bitmis maclarda sonucu biliyoruz -> grader ile WON/LOST olarak isaretler.
 *
 * Free plan optimizasyonlari
 *   - Takim form verilerini `getTeamSeasonFixtures` ile bir kere cekip
 *     RAM'de CACHE ediyoruz -> aynı takim icin ikinci kez istek atilmiyor.
 *   - `apiFootball.js` icindeki kuyruk + throttle zaten 7.5s/1 istek saglar.
 *   - --useCutoff=true verilirse form ve H2H sadece "mac tarihinden ONCE"ki
 *     maclardan olusur -> "data leakage"siz backtest.
 *
 * Quota uyarisi
 *   - Her takim icin 1 sezon-fixtures cagirisi + mac basina 1 H2H = ~ (takim_sayisi + mac_sayisi)
 *   - 2 lig, 10 mac icin tipik harcama: ~25-30 istek.
 */

import "dotenv/config";
import {
  getFixturesByDateRange,
  getTeamLastMatches,
  getH2H,
  getTeamSeasonFixtures,
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

const FROM = args.from ?? "2025-05-01";
const TO = args.to ?? "2025-05-31";
const LEAGUES = (args.leagues ?? process.env.LEAGUE_IDS ?? "203,140")
  .split(",").map((s) => Number(s.trim())).filter(Boolean);
const SEASON = Number(args.season ?? process.env.SEASON ?? 2024);
const LIMIT = Number(args.limit ?? 10);
const USE_CUTOFF = String(args.useCutoff ?? "false").toLowerCase() === "true";
const LEAGUE_AVG_GOALS = Number(process.env.LEAGUE_AVG_GOALS) || 2.7;

const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);
const CLOSED_STATUSES = new Set(["PST", "CANC"]);

/** Team-season fixture listesini RAM'de cache'le (aynı takim icin ikinci istek atmasin) */
const teamFixturesCache = new Map();

async function cachedTeamFixtures(team, league, season) {
  const key = `${team}:${league}:${season}`;
  if (!teamFixturesCache.has(key)) {
    teamFixturesCache.set(key, await getTeamSeasonFixtures({ team, league, season }));
  }
  return teamFixturesCache.get(key);
}

function pickLastFinished(all, teamId, cutoffDate, last = 10) {
  const finished = all.filter((f) => {
    const s = f.fixture?.status?.short;
    if (!["FT", "AET", "PEN"].includes(s)) return false;
    if (cutoffDate && new Date(f.fixture.date) >= new Date(cutoffDate)) return false;
    return true;
  });
  finished.sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date));
  return finished.slice(0, last);
}

async function main() {
  console.log(
    `[backfill] ${FROM} -> ${TO}, leagues=${LEAGUES.join(",")}, season=${SEASON}, ` +
    `limit=${LIMIT}/league, cutoff=${USE_CUTOFF}`
  );

  let totalFixtures = 0;
  let totalPredicted = 0;
  let totalGraded = 0;
  let totalSkipped = 0;

  for (const league of LEAGUES) {
    let fixtures = [];
    try {
      fixtures = await getFixturesByDateRange({ from: FROM, to: TO, league, season: SEASON });
    } catch (err) {
      console.error(`[backfill] league=${league} fetch failed:`, err.message);
      continue;
    }
    console.log(`[backfill] league=${league} fixtures=${fixtures.length} (processing up to ${LIMIT})`);
    totalFixtures += fixtures.length;

    const slice = fixtures.slice(0, LIMIT);
    for (const fx of slice) {
      try {
        const { predicted, graded, skipped } = await processFixture(fx);
        if (predicted) totalPredicted++;
        if (graded) totalGraded++;
        if (skipped) totalSkipped++;
      } catch (err) {
        console.error(`[backfill] fixture=${fx.fixture?.id} error:`, err.message);
      }
    }
  }

  console.log(
    `[backfill] done. fixtures_seen=${totalFixtures} ` +
    `predicted=${totalPredicted} graded=${totalGraded} skipped=${totalSkipped}`
  );
  await pool.end();
}

async function processFixture(fx) {
  await upsertMatchFromFixture(fx);
  const status = fx.fixture?.status?.short;

  if (CLOSED_STATUSES.has(status)) {
    console.log(`  - skipped (${status}): ${fx.teams.home.name} vs ${fx.teams.away.name}`);
    return { predicted: false, graded: false, skipped: true };
  }

  const homeId = fx.teams.home.id;
  const awayId = fx.teams.away.id;
  const leagueId = fx.league.id;
  const season = fx.league.season;
  const cutoff = USE_CUTOFF ? fx.fixture.date : null;

  // Form verileri: once CACHE'den, yoksa tek sezon-fixtures cagirisi
  const [homeAll, awayAll] = await Promise.all([
    cachedTeamFixtures(homeId, leagueId, season),
    cachedTeamFixtures(awayId, leagueId, season),
  ]);
  const homeLast = pickLastFinished(homeAll, homeId, cutoff, 10);
  const awayLast = pickLastFinished(awayAll, awayId, cutoff, 10);

  // H2H: kendi throttle'li isteği
  let h2hList = [];
  try {
    h2hList = await getH2H({ teamA: homeId, teamB: awayId, last: 5, cutoffDate: cutoff });
  } catch (err) {
    console.warn(`  ! H2H failed for ${homeId} vs ${awayId}:`, err.message);
  }

  const homeForm = buildTeamForm(homeLast, homeId, 10);
  const awayForm = buildTeamForm(awayLast, awayId, 10);
  const h2h = buildH2H(h2hList, homeId, awayId, 5);

  await upsertTeamStats({
    team_id: homeId,
    team_name: fx.teams.home.name,
    league_id: leagueId,
    season,
    ...homeForm,
    raw: homeLast.slice(0, 10),
  });
  await upsertTeamStats({
    team_id: awayId,
    team_name: fx.teams.away.name,
    league_id: leagueId,
    season,
    ...awayForm,
    raw: awayLast.slice(0, 10),
  });
  await upsertH2H({
    team_a_id: homeId,
    team_b_id: awayId,
    ...h2h,
    raw: h2hList.slice(0, 5),
  });

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
    `  * ${fx.teams.home.name} vs ${fx.teams.away.name}` +
    ` -> ${bestPick.prediction_type}=${bestPick.predicted_value} (conf ${bestPick.confidence})`
  );

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
      const r = gradePrediction(
        { home_goals: fx.goals.home, away_goals: fx.goals.away, status },
        { prediction_type: best.prediction_type, predicted_value: best.predicted_value }
      );
      console.log(`    score: ${fx.goals.home}-${fx.goals.away} -> best pick ${r}`);
    }
  }

  return { predicted: true, graded, skipped: false };
}

main().catch((err) => {
  console.error("[backfill] fatal:", err);
  process.exit(1);
});
