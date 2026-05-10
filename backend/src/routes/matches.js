import express from "express";
import {
  getMatchById,
  getMatchesInRange,
  getPredictionsForMatch,
  getBestPickForMatches,
  getTeamStats,
  getH2HStats,
} from "../db/repository.js";
import { addDays, dayWindow, startOfDayUTC } from "../utils/dates.js";

export const matchesRouter = express.Router();

/** Yardımcı: maç listesi üzerine best_pick tahminini ekle. */
async function attachBestPicks(matches) {
  if (!matches.length) return matches;
  const picks = await getBestPickForMatches(matches.map((m) => m.id));
  const byMatch = new Map(picks.map((p) => [String(p.match_id), p]));
  return matches.map((m) => ({ ...m, best_prediction: byMatch.get(String(m.id)) || null }));
}

/**
 * GET /matches
 *   ?scope=yesterday|today|upcoming  (upcoming = bugün + 7 gün)
 *   veya ?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
matchesRouter.get("/", async (req, res, next) => {
  try {
    const { scope, from, to, status } = req.query;
    let fromDate, toDate;

    if (scope === "yesterday") {
      const y = addDays(startOfDayUTC(new Date()), -1);
      ({ from: fromDate, to: toDate } = dayWindow(y));
    } else if (scope === "today") {
      ({ from: fromDate, to: toDate } = dayWindow(new Date()));
    } else if (scope === "upcoming") {
      fromDate = startOfDayUTC(new Date());
      toDate = addDays(fromDate, 8); // bugün + 7 gün
    } else if (from && to) {
      fromDate = new Date(from);
      toDate = new Date(to);
    } else {
      return res.status(400).json({ error: "scope (yesterday|today|upcoming) veya from&to gerekli" });
    }

    const rows = await getMatchesInRange({ from: fromDate, to: toDate, status });
    const withPicks = await attachBestPicks(rows);
    res.json({ from: fromDate, to: toDate, count: withPicks.length, matches: withPicks });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /matches/:id
 * Maç detayı + 4 tahmin + takım son 10 form + H2H özeti.
 */
matchesRouter.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });

    const match = await getMatchById(id);
    if (!match) return res.status(404).json({ error: "match not found" });

    const [predictions, homeStats, awayStats, h2h] = await Promise.all([
      getPredictionsForMatch(id),
      getTeamStats(match.home_team_id, match.league_id, match.season),
      getTeamStats(match.away_team_id, match.league_id, match.season),
      getH2HStats(match.home_team_id, match.away_team_id),
    ]);

    res.json({
      match,
      predictions,
      form: {
        home: homeStats,
        away: awayStats,
      },
      h2h,
    });
  } catch (err) {
    next(err);
  }
});
