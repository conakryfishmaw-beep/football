import express from "express";
import { searchMatches, getBestPickForMatches } from "../db/repository.js";
import { query } from "../db/pool.js";

export const archiveRouter = express.Router();

/**
 * GET /archive
 *   ?q=<takım adı>
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD
 *   ?leagueId=123
 *   ?limit=100&offset=0
 *
 * Her satır: maç + en iyi tahmin + tahminin sonucu (WON/LOST/PENDING).
 */
archiveRouter.get("/", async (req, res, next) => {
  try {
    const { q, from, to, leagueId } = req.query;
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const matches = await searchMatches({
      q: q?.trim() || null,
      from: from ? new Date(from) : null,
      to: to ? new Date(to) : null,
      leagueId: leagueId ? Number(leagueId) : null,
      limit,
      offset,
    });

    const picks = await getBestPickForMatches(matches.map((m) => m.id));
    const byMatch = new Map(picks.map((p) => [String(p.match_id), p]));

    res.json({
      count: matches.length,
      limit,
      offset,
      items: matches.map((m) => ({ ...m, best_prediction: byMatch.get(String(m.id)) || null })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /archive/summary
 * Genel istatistik: toplam, kazanan, kaybeden, başarı oranı (ve isteğe bağlı tarih aralığı).
 */
archiveRouter.get("/summary", async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const params = [];
    const where = ["p.best_pick = TRUE", "p.result IN ('WON','LOST')"];
    if (from) { params.push(new Date(from)); where.push(`m.match_date >= $${params.length}`); }
    if (to)   { params.push(new Date(to));   where.push(`m.match_date <  $${params.length}`); }

    const { rows } = await query(
      `SELECT
         COUNT(*)                                        AS total,
         COUNT(*) FILTER (WHERE p.result = 'WON')        AS wins,
         COUNT(*) FILTER (WHERE p.result = 'LOST')       AS losses,
         COUNT(*) FILTER (WHERE p.result = 'PENDING')    AS pending,
         ROUND(AVG(p.confidence)::numeric, 2)            AS avg_confidence
       FROM predictions p
       JOIN matches m ON m.id = p.match_id
       ${where.length ? "WHERE " + where.join(" AND ") : ""}`,
      params
    );
    const r = rows[0];
    const total = Number(r.total || 0);
    const wins = Number(r.wins || 0);
    const success = total > 0 ? +((wins / total) * 100).toFixed(2) : 0;
    res.json({
      total,
      wins,
      losses: Number(r.losses || 0),
      pending: Number(r.pending || 0),
      success_rate: success,
      avg_confidence: Number(r.avg_confidence || 0),
    });
  } catch (err) {
    next(err);
  }
});
