/**
 * generatePredictions
 * -------------------
 * Önümüzdeki N gün için fikstürleri çeker, her maç için:
 *   1) iki takımın son 10 maçını getirir → form istatistikleri üretir
 *   2) H2H son 5 maçı getirir
 *   3) tahmin motorunu çalıştırır
 *   4) matches + predictions + team_stats + h2h_stats tablolarını upsert eder
 *
 * Tahminler `best_pick=TRUE` olan satırla AI'nin en iyi seçimini işaretler,
 * diğer 3 alternatif tahmin de arşive yazılır.
 */

import "dotenv/config";
import {
  getFixturesByDateRange,
  getTeamLastMatches,
  getH2H,
} from "../services/apiFootball.js";
import { buildTeamForm, buildH2H } from "../services/statsBuilder.js";
import { buildPredictions } from "../engine/predictor.js";
import {
  upsertMatchFromFixture,
  upsertPrediction,
  upsertTeamStats,
  upsertH2H,
  pool,
} from "../db/repository.js";
import { toISODate, addDays, startOfDayUTC } from "../utils/dates.js";

const LEAGUE_IDS = (process.env.LEAGUE_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map(Number);

const SEASON = Number(process.env.SEASON) || new Date().getUTCFullYear();
const DAYS_AHEAD = Number(process.env.PREDICT_DAYS_AHEAD) || 7;
const LEAGUE_AVG = Number(process.env.LEAGUE_AVG_GOALS) || 2.7;

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

export async function generatePredictions({ daysAhead = DAYS_AHEAD } = {}) {
  if (!LEAGUE_IDS.length) {
    console.warn("[predict] LEAGUE_IDS boş — .env dosyanızı kontrol edin");
    return { processed: 0 };
  }

  const today = startOfDayUTC(new Date());
  const from = toISODate(today);
  const to = toISODate(addDays(today, daysAhead));
  console.log(`[predict] ${from} → ${to}, ligler: ${LEAGUE_IDS.join(",")}`);

  let processed = 0;

  for (const league of LEAGUE_IDS) {
    let fixtures = [];
    try {
      fixtures = await getFixturesByDateRange({ from, to, league, season: SEASON });
    } catch (err) {
      console.error(`[predict] league=${league} fikstür çekilemedi:`, err.message);
      continue;
    }
    console.log(`[predict] league=${league} fixtures=${fixtures.length}`);

    for (const fx of fixtures) {
      try {
        await processFixture(fx, LEAGUE_AVG);
        processed++;
        await sleep(150); // API rate-limit için nazik bekleme
      } catch (err) {
        console.error(`[predict] fixture ${fx.fixture?.id} hatası:`, err.message);
      }
    }
  }

  console.log(`[predict] done. processed=${processed}`);
  return { processed };
}

async function processFixture(fx, leagueAvg) {
  // 1) Maçın kendisini yaz
  await upsertMatchFromFixture(fx);

  // Eğer maç zaten oynandıysa tahmin üretmeyiz
  const status = fx.fixture?.status?.short;
  if (["FT", "AET", "PEN", "PST", "CANC"].includes(status)) return;

  const homeId = fx.teams.home.id;
  const awayId = fx.teams.away.id;

  // 2) Form verileri (son 10 maç)
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

  // 4) Tahmin motoru
  const { predictions } = buildPredictions({
    home: homeForm,
    away: awayForm,
    h2h,
    leagueAvgGoals: leagueAvg,
  });

  // 5) 4 tahmini de yaz (ikisi bile yanlışsa arşivde görünür)
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
}

// Standalone çalıştırma: `npm run predict:run`
const isEntry = import.meta.url === `file://${process.argv[1]}`;
if (isEntry) {
  generatePredictions()
    .then(() => pool.end())
    .catch((e) => { console.error(e); process.exit(1); });
}
