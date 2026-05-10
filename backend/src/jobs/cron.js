import cron from "node-cron";
import "dotenv/config";
import { generatePredictions } from "./generatePredictions.js";
import { syncResults } from "./syncResults.js";

const PREDICT_CRON = process.env.CRON_GENERATE_PREDICTIONS || "0 6 * * *";   // her gün 06:00
const RESULTS_CRON = process.env.CRON_SYNC_RESULTS || "*/15 * * * *";          // 15 dk'da bir

export function startCron() {
  if (!cron.validate(PREDICT_CRON)) {
    console.error(`[cron] invalid CRON_GENERATE_PREDICTIONS=${PREDICT_CRON}`);
  } else {
    cron.schedule(PREDICT_CRON, async () => {
      console.log("[cron] generatePredictions tetiklendi");
      try { await generatePredictions(); } catch (e) { console.error("[cron] predict error:", e.message); }
    });
    console.log(`[cron] predictions scheduled: ${PREDICT_CRON}`);
  }

  if (!cron.validate(RESULTS_CRON)) {
    console.error(`[cron] invalid CRON_SYNC_RESULTS=${RESULTS_CRON}`);
  } else {
    cron.schedule(RESULTS_CRON, async () => {
      console.log("[cron] syncResults tetiklendi");
      try { await syncResults(); } catch (e) { console.error("[cron] sync error:", e.message); }
    });
    console.log(`[cron] results sync scheduled: ${RESULTS_CRON}`);
  }
}
