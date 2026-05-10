/**
 * API-Football fixture listesinden takım/H2H özet metriklerini üretir.
 * Tamamen saf (DB/ağ erişimi yok) — birim test kolaylığı için.
 */

/** Bir maç (fixture) için "goals_for / goals_against / outcome" türet. */
function perspectivize(fx, teamId) {
  const homeId = fx.teams?.home?.id;
  const awayId = fx.teams?.away?.id;
  const homeG = fx.goals?.home ?? 0;
  const awayG = fx.goals?.away ?? 0;
  const isHome = homeId === teamId;
  const gf = isHome ? homeG : awayG;
  const ga = isHome ? awayG : homeG;
  let outcome = "D";
  if (gf > ga) outcome = "W";
  else if (gf < ga) outcome = "L";
  return { gf, ga, outcome, total: homeG + awayG };
}

export function buildTeamForm(fixtures, teamId, limit = 10) {
  const played = fixtures
    .filter((f) => f.fixture?.status?.short === "FT" || f.fixture?.status?.short === "AET" || f.fixture?.status?.short === "PEN")
    .slice(0, limit);

  let wins = 0, draws = 0, losses = 0;
  let gf = 0, ga = 0;
  let scoredMatches = 0, cleanSheets = 0, over25 = 0;
  const formChars = [];

  for (const fx of played) {
    const p = perspectivize(fx, teamId);
    gf += p.gf;
    ga += p.ga;
    if (p.outcome === "W") wins++;
    else if (p.outcome === "D") draws++;
    else losses++;
    if (p.gf > 0) scoredMatches++;
    if (p.ga === 0) cleanSheets++;
    if (p.total > 2.5) over25++;
    formChars.push(p.outcome);
  }

  const n = played.length || 1;
  return {
    last10_played: played.length,
    last10_wins: wins,
    last10_draws: draws,
    last10_losses: losses,
    last10_goals_for: gf,
    last10_goals_against: ga,
    last10_scored_pct: +((scoredMatches / n) * 100).toFixed(2),
    last10_clean_pct: +((cleanSheets / n) * 100).toFixed(2),
    last10_over25_pct: +((over25 / n) * 100).toFixed(2),
    form_string: formChars.join(""),

    // motor için ham ortalamalar:
    avg_gf: +(gf / n).toFixed(3),
    avg_ga: +(ga / n).toFixed(3),
    ppg: +((wins * 3 + draws) / n).toFixed(3),
  };
}

export function buildH2H(fixtures, teamAId, teamBId, limit = 5) {
  const played = fixtures
    .filter((f) => f.fixture?.status?.short === "FT" || f.fixture?.status?.short === "AET" || f.fixture?.status?.short === "PEN")
    .slice(0, limit);

  let aWins = 0, bWins = 0, draws = 0, totalGoals = 0;
  for (const fx of played) {
    const hG = fx.goals?.home ?? 0;
    const aG = fx.goals?.away ?? 0;
    totalGoals += hG + aG;
    const homeId = fx.teams?.home?.id;
    if (hG === aG) draws++;
    else if ((hG > aG && homeId === teamAId) || (aG > hG && homeId !== teamAId && fx.teams?.away?.id === teamAId)) aWins++;
    else bWins++;
  }

  const n = played.length || 1;
  return {
    matches_played: played.length,
    team_a_wins: aWins,
    team_b_wins: bWins,
    draws,
    avg_total_goals: +(totalGoals / n).toFixed(2),
  };
}
