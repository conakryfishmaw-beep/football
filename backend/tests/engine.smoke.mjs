/**
 * Tahmin motoru için saf fonksiyonel smoke test.
 * Herhangi bir ağ veya DB gerektirmez — CI'da `node tests/engine.smoke.mjs` ile koşar.
 */
import assert from "node:assert/strict";
import { buildPredictions } from "../src/engine/predictor.js";
import { matchProbabilities, poissonPmf } from "../src/engine/poisson.js";
import { gradePrediction } from "../src/engine/grader.js";
import { buildTeamForm, buildH2H } from "../src/services/statsBuilder.js";

/* ---------- 1) Poisson sanity ---------- */
assert.ok(Math.abs(poissonPmf(0, 0) - 1) < 1e-9, "P(0 | λ=0) = 1");
const p = matchProbabilities(1.5, 1.1);
const total = p.pHome + p.pDraw + p.pAway;
assert.ok(Math.abs(total - 1) < 0.02, `1X2 olasılıkları ~1 olmalı, got ${total}`);
assert.ok(p.pHome > p.pAway, "güçlü λ ev sahibi kazanma olasılığı > deplasman");

/* ---------- 2) statsBuilder ---------- */
const fakeFixtures = [
  { fixture: { status: { short: "FT" } }, teams: { home: { id: 1 }, away: { id: 2 } }, goals: { home: 3, away: 1 } },
  { fixture: { status: { short: "FT" } }, teams: { home: { id: 3 }, away: { id: 1 } }, goals: { home: 0, away: 2 } },
  { fixture: { status: { short: "FT" } }, teams: { home: { id: 1 }, away: { id: 4 } }, goals: { home: 1, away: 1 } },
];
const form = buildTeamForm(fakeFixtures, 1, 10);
assert.equal(form.last10_played, 3);
assert.equal(form.last10_wins, 2);
assert.equal(form.last10_draws, 1);
assert.equal(form.last10_goals_for, 6);
assert.equal(form.last10_goals_against, 2);
assert.ok(form.form_string.length === 3, "form_string length == played");

const h2h = buildH2H([
  { fixture: { status: { short: "FT" } }, teams: { home: { id: 1 }, away: { id: 2 } }, goals: { home: 2, away: 0 } },
  { fixture: { status: { short: "FT" } }, teams: { home: { id: 2 }, away: { id: 1 } }, goals: { home: 1, away: 1 } },
], 1, 2, 5);
assert.equal(h2h.matches_played, 2);
assert.equal(h2h.team_a_wins, 1);
assert.equal(h2h.draws, 1);

/* ---------- 3) predictor sonuç şekli ---------- */
const home = { avg_gf: 1.8, avg_ga: 1.0, ppg: 2.1, last10_scored_pct: 90, last10_clean_pct: 50, last10_over25_pct: 70, form_string: "WWDWL" };
const away = { avg_gf: 0.9, avg_ga: 1.6, ppg: 0.9, last10_scored_pct: 60, last10_clean_pct: 20, last10_over25_pct: 55, form_string: "LLDWL" };
const h = { matches_played: 5, team_a_wins: 3, team_b_wins: 1, draws: 1, avg_total_goals: 3.2 };

const { predictions, bestPick } = buildPredictions({ home, away, h2h: h, leagueAvgGoals: 2.7 });
assert.equal(predictions.length, 4, "4 market üretilmeli");
const types = new Set(predictions.map((p) => p.prediction_type));
for (const t of ["SIDE", "HOME_SCORES", "AWAY_SCORES", "TOTAL_GOALS"]) {
  assert.ok(types.has(t), `missing market ${t}`);
}
assert.ok(bestPick && bestPick.best_pick === true, "bestPick işaretli olmalı");
const bestCount = predictions.filter((p) => p.best_pick).length;
assert.equal(bestCount, 1, "yalnızca 1 tahmin best_pick olabilir");
for (const p of predictions) {
  assert.ok(p.confidence >= 5 && p.confidence <= 95, `confidence [5,95] dışı: ${p.confidence}`);
}

/* ---------- 4) grader ---------- */
const finished = { home_goals: 2, away_goals: 1, status: "FT" };
assert.equal(gradePrediction(finished, { prediction_type: "SIDE", predicted_value: "1" }), "WON");
assert.equal(gradePrediction(finished, { prediction_type: "SIDE", predicted_value: "2" }), "LOST");
assert.equal(gradePrediction(finished, { prediction_type: "TOTAL_GOALS", predicted_value: "OVER_2_5" }), "WON");
assert.equal(gradePrediction(finished, { prediction_type: "TOTAL_GOALS", predicted_value: "UNDER_2_5" }), "LOST");
assert.equal(gradePrediction(finished, { prediction_type: "HOME_SCORES", predicted_value: "YES" }), "WON");
assert.equal(gradePrediction(finished, { prediction_type: "AWAY_SCORES", predicted_value: "NO" }), "LOST");
assert.equal(gradePrediction({ home_goals: null, away_goals: null, status: "NS" }, { prediction_type: "SIDE", predicted_value: "1" }), "PENDING");

console.log("[smoke] OK — 4 markets, bestPick, grader ve poisson doğrulandı.");
