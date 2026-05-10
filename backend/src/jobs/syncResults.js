/**
 * syncResults
 * -----------
 * 1) API-Football'dan son 2 günün bitmiş maçlarını çeker → matches tablosunu günceller.
 * 2) status IN (FT,AET,PEN) olan ve henüz 'PENDING' olan tahminleri grader'dan geçirip
 *    WON/LOST olarak işaretler. **Hiçbir tahmin silinmez.**
 */

import "dotenv/config";
import { getFinishedFixtures } from "../services/apiFootball.js";
import {
  upsertMatchFromFixture,
  getPendingPredictionsForFinishedMatches,
  setPredictionResult,
  pool,
} from "../db/repository.js";
import { gradePrediction } from "../engine/grader.js";
import { toISODate, addDays, startOfDayUTC } from "../utils/dates.js";

const LEAGUE_IDS = (process.env.LEAGUE_IDS || "")
  .split(",").map((s) => s.trim()).filter(Boolean).map(Number);
const SEASON = Number(process.env.SEASON) || new Date().getUTCFullYear();
const LOOKBACK_DAYS = Number(process.env.RESULTS_LOOKBACK_DAYS) || 2;

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

export async function syncResults() {
  const today = startOfDayUTC(new Date());
  const from = toISODate(addDays(today, -LOOKBACK_DAYS));
  const to = toISODate(addDays(today, 1));

  let fetched = 0;
  for (const league of LEAGUE_IDS) {
    try {
      const fixtures = await getFinishedFixtures({ from, to, league, season: SEASON });
      for (const fx of fixtures) {
        await upsertMatchFromFixture(fx);
        fetched++;
      }
      await sleep(150);
    } catch (err) {
      console.error(`[sync] league=${league} hata:`, err.message);
    }
  }

  // Şimdi bekleyen tahminleri değerlendir
  const pending = await getPendingPredictionsForFinishedMatches();
  let updated = 0;
  for (const p of pending) {
    const result = gradePrediction(
      { home_goals: p.home_goals, away_goals: p.away_goals, status: p.status },
      { prediction_type: p.prediction_type, predicted_value: p.predicted_value }
    );
    if (result === "WON" || result === "LOST") {
      await setPredictionResult(p.id, result);
      updated++;
    }
  }

  console.log(`[sync] fetched=${fetched} pending=${pending.length} updated=${updated}`);
  return { fetched, pending: pending.length, updated };
}

const isEntry = import.meta.url === `file://${process.argv[1]}`;
if (isEntry) {
  syncResults()
    .then(() => pool.end())
    .catch((e) => { console.error(e); process.exit(1); });
}
