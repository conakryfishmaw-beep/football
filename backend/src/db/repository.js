import { pool, query } from "./pool.js";

/* ---------- matches ---------- */

export async function upsertMatchFromFixture(fx) {
  const row = {
    id: fx.fixture.id,
    league_id: fx.league.id,
    league_name: fx.league.name,
    season: fx.league.season,
    match_date: fx.fixture.date,
    home_team_id: fx.teams.home.id,
    home_team_name: fx.teams.home.name,
    away_team_id: fx.teams.away.id,
    away_team_name: fx.teams.away.name,
    home_goals: fx.goals?.home ?? null,
    away_goals: fx.goals?.away ?? null,
    status: fx.fixture.status?.short ?? "NS",
    venue: fx.fixture.venue?.name ?? null,
  };

  await query(
    `INSERT INTO matches (
       id, league_id, league_name, season, match_date,
       home_team_id, home_team_name, away_team_id, away_team_name,
       home_goals, away_goals, status, venue
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (id) DO UPDATE SET
       home_goals = EXCLUDED.home_goals,
       away_goals = EXCLUDED.away_goals,
       status     = EXCLUDED.status,
       match_date = EXCLUDED.match_date,
       venue      = EXCLUDED.venue`,
    [
      row.id, row.league_id, row.league_name, row.season, row.match_date,
      row.home_team_id, row.home_team_name, row.away_team_id, row.away_team_name,
      row.home_goals, row.away_goals, row.status, row.venue,
    ]
  );
  return row;
}

export async function getMatchById(id) {
  const { rows } = await query("SELECT * FROM matches WHERE id = $1", [id]);
  return rows[0] || null;
}

export async function getMatchesInRange({ from, to, status }) {
  const params = [from, to];
  let sql = `SELECT * FROM matches WHERE match_date >= $1 AND match_date < $2`;
  if (status) {
    params.push(status);
    sql += ` AND status = $${params.length}`;
  }
  sql += ` ORDER BY match_date ASC`;
  const { rows } = await query(sql, params);
  return rows;
}

export async function searchMatches({ q, from, to, leagueId, limit = 100, offset = 0 }) {
  const params = [];
  const where = [];
  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    where.push(`(LOWER(home_team_name) LIKE $${params.length} OR LOWER(away_team_name) LIKE $${params.length})`);
  }
  if (from) { params.push(from); where.push(`match_date >= $${params.length}`); }
  if (to)   { params.push(to);   where.push(`match_date <  $${params.length}`); }
  if (leagueId) { params.push(leagueId); where.push(`league_id = $${params.length}`); }

  params.push(limit);  const limitIdx  = params.length;
  params.push(offset); const offsetIdx = params.length;

  const sql = `
    SELECT * FROM matches
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY match_date DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;
  const { rows } = await query(sql, params);
  return rows;
}

/* ---------- predictions ---------- */

export async function upsertPrediction(p) {
  await query(
    `INSERT INTO predictions
       (match_id, prediction_type, predicted_value, confidence, reasoning, best_pick)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (match_id, prediction_type) DO UPDATE SET
       predicted_value = EXCLUDED.predicted_value,
       confidence      = EXCLUDED.confidence,
       reasoning       = EXCLUDED.reasoning,
       best_pick       = EXCLUDED.best_pick`,
    [p.match_id, p.prediction_type, p.predicted_value, p.confidence, p.reasoning, !!p.best_pick]
  );
}

export async function getPredictionsForMatch(matchId) {
  const { rows } = await query(
    "SELECT * FROM predictions WHERE match_id = $1 ORDER BY best_pick DESC, confidence DESC",
    [matchId]
  );
  return rows;
}

export async function getBestPickForMatches(matchIds) {
  if (!matchIds?.length) return [];
  const { rows } = await query(
    `SELECT * FROM predictions
       WHERE match_id = ANY($1::bigint[]) AND best_pick = TRUE`,
    [matchIds]
  );
  return rows;
}

export async function setPredictionResult(id, result) {
  await query(
    `UPDATE predictions SET result = $2, resolved_at = NOW()
       WHERE id = $1 AND result = 'PENDING'`,
    [id, result]
  );
}

export async function getPendingPredictionsForFinishedMatches() {
  const { rows } = await query(`
    SELECT p.*, m.home_goals, m.away_goals, m.status, m.home_team_id, m.away_team_id
      FROM predictions p
      JOIN matches m ON m.id = p.match_id
     WHERE p.result = 'PENDING'
       AND m.status IN ('FT','AET','PEN')
       AND m.home_goals IS NOT NULL
       AND m.away_goals IS NOT NULL
  `);
  return rows;
}

/* ---------- team_stats / h2h ---------- */

export async function upsertTeamStats(row) {
  await query(
    `INSERT INTO team_stats (
       team_id, team_name, league_id, season,
       last10_played, last10_wins, last10_draws, last10_losses,
       last10_goals_for, last10_goals_against,
       last10_scored_pct, last10_clean_pct, last10_over25_pct,
       form_string, raw
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (team_id, league_id, season) DO UPDATE SET
       last10_played        = EXCLUDED.last10_played,
       last10_wins          = EXCLUDED.last10_wins,
       last10_draws         = EXCLUDED.last10_draws,
       last10_losses        = EXCLUDED.last10_losses,
       last10_goals_for     = EXCLUDED.last10_goals_for,
       last10_goals_against = EXCLUDED.last10_goals_against,
       last10_scored_pct    = EXCLUDED.last10_scored_pct,
       last10_clean_pct     = EXCLUDED.last10_clean_pct,
       last10_over25_pct    = EXCLUDED.last10_over25_pct,
       form_string          = EXCLUDED.form_string,
       raw                  = EXCLUDED.raw`,
    [
      row.team_id, row.team_name, row.league_id, row.season,
      row.last10_played, row.last10_wins, row.last10_draws, row.last10_losses,
      row.last10_goals_for, row.last10_goals_against,
      row.last10_scored_pct, row.last10_clean_pct, row.last10_over25_pct,
      row.form_string, row.raw ?? null,
    ]
  );
}

export async function upsertH2H(row) {
  const [a, b] = [row.team_a_id, row.team_b_id].sort((x, y) => x - y);
  await query(
    `INSERT INTO h2h_stats (
       team_a_id, team_b_id, matches_played, team_a_wins, team_b_wins, draws, avg_total_goals, raw
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (team_a_id, team_b_id) DO UPDATE SET
       matches_played  = EXCLUDED.matches_played,
       team_a_wins     = EXCLUDED.team_a_wins,
       team_b_wins     = EXCLUDED.team_b_wins,
       draws           = EXCLUDED.draws,
       avg_total_goals = EXCLUDED.avg_total_goals,
       raw             = EXCLUDED.raw`,
    [a, b, row.matches_played, row.team_a_wins, row.team_b_wins, row.draws, row.avg_total_goals, row.raw ?? null]
  );
}

export async function getTeamStats(teamId, leagueId, season) {
  const { rows } = await query(
    "SELECT * FROM team_stats WHERE team_id = $1 AND league_id = $2 AND season = $3",
    [teamId, leagueId, season]
  );
  return rows[0] || null;
}

export async function getH2HStats(teamAId, teamBId) {
  const [a, b] = [teamAId, teamBId].sort((x, y) => x - y);
  const { rows } = await query(
    "SELECT * FROM h2h_stats WHERE team_a_id = $1 AND team_b_id = $2",
    [a, b]
  );
  return rows[0] || null;
}

export { pool };
