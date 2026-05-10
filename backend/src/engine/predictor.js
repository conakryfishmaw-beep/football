import { matchProbabilities } from "./poisson.js";

/**
 * AI Tahmin Motoru
 * ----------------
 * Girdi:
 *   - home: { avg_gf, avg_ga, ppg, last10_scored_pct, last10_clean_pct, last10_over25_pct, form_string }
 *   - away: aynı şekil
 *   - h2h:  { matches_played, team_a_wins, team_b_wins, draws, avg_total_goals }  (team_a = home)
 *   - leagueAvgGoals: lig ortalaması (bilinmiyorsa 2.7 varsayılan)
 *
 * Çıktı:
 *   predictions: [{type, value, confidence, reasoning}] (4 adet)
 *   bestPick:    confidence'ı en yüksek olan kayıt
 *
 * Ağırlıklandırma: Form (son 10) %60, H2H %40.
 */

const FORM_W = 0.6;
const H2H_W = 0.4;
const LEAGUE_DEFAULT = 2.7;
const HOME_ADV = 1.10;

function safeNum(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

/** Son form dizisinden (WWDLW...) yeni maçları daha ağırlıklı sayan ppg. */
function weightedPpg(formString = "") {
  if (!formString) return null;
  const chars = formString.split("").slice(0, 10);
  let wSum = 0, pts = 0;
  chars.forEach((c, i) => {
    const w = 10 - i; // son maç en ağırlıklı
    wSum += w;
    if (c === "W") pts += 3 * w;
    else if (c === "D") pts += 1 * w;
  });
  return wSum ? pts / wSum : null;
}

/**
 * Takımın beklenen gol (λ) hesabı:
 *   λ_form = avg_gf  *  (rakibin avg_ga / leagueAvg)
 *   λ_h2h  = h2h ortalaması üzerinden pay
 *   λ      = 0.6 * λ_form + 0.4 * λ_h2h   (H2H yoksa tamamen form)
 */
function expectedGoals({ attackAvgGF, defenseAvgGA, leagueAvg, h2hAvgGoals, h2hShare }) {
  const base = Math.max(0.05, safeNum(attackAvgGF, leagueAvg / 2));
  const oppFactor = Math.max(0.4, safeNum(defenseAvgGA, leagueAvg / 2) / (leagueAvg / 2));
  const lambdaForm = base * oppFactor;

  if (!h2hAvgGoals || !h2hShare) return lambdaForm;
  const lambdaH2H = h2hAvgGoals * h2hShare;
  return FORM_W * lambdaForm + H2H_W * lambdaH2H;
}

export function buildPredictions({ home, away, h2h, leagueAvgGoals }) {
  const leagueAvg = safeNum(leagueAvgGoals, LEAGUE_DEFAULT);

  // Her takımın kendi "payı" — h2h ortalama gol içinde ne kadar skor ettiği.
  const h2hTotal = safeNum(h2h?.avg_total_goals, 0);
  const h2hShareHome = h2hTotal > 0 ? 0.55 : null; // ev sahibi payı ~%55 varsayım, veri yoksa null
  const h2hShareAway = h2hTotal > 0 ? 0.45 : null;

  const lambdaHomeRaw = expectedGoals({
    attackAvgGF: home.avg_gf,
    defenseAvgGA: away.avg_ga,
    leagueAvg,
    h2hAvgGoals: h2hTotal,
    h2hShare: h2hShareHome,
  });
  const lambdaAwayRaw = expectedGoals({
    attackAvgGF: away.avg_gf,
    defenseAvgGA: home.avg_ga,
    leagueAvg,
    h2hAvgGoals: h2hTotal,
    h2hShare: h2hShareAway,
  });

  // Ev sahibi avantajı
  const lambdaHome = lambdaHomeRaw * HOME_ADV;
  const lambdaAway = lambdaAwayRaw / HOME_ADV;

  const probs = matchProbabilities(lambdaHome, lambdaAway);

  // ---- Form düzeltmesi (confidence'a etki eder, olasılıklara değil)
  const homePpg = weightedPpg(home.form_string) ?? home.ppg ?? 1.3;
  const awayPpg = weightedPpg(away.form_string) ?? away.ppg ?? 1.3;
  const ppgEdge = (homePpg - awayPpg) / 3; // -1..+1 arası

  // H2H "güven şişirme" faktörü (sadece rakip avantajı belirginse)
  const h2hEdge = (() => {
    const n = safeNum(h2h?.matches_played, 0);
    if (n < 3) return 0;
    const pts = safeNum(h2h.team_a_wins) - safeNum(h2h.team_b_wins);
    return pts / (n * 2); // -0.5..+0.5 arası
  })();

  /* ----------- 1) SIDE (1 / X / 2) ----------- */
  const sideOptions = [
    { value: "1", p: probs.pHome, label: "Ev sahibi galibiyeti" },
    { value: "X", p: probs.pDraw, label: "Beraberlik" },
    { value: "2", p: probs.pAway, label: "Deplasman galibiyeti" },
  ].sort((a, b) => b.p - a.p);
  const side = sideOptions[0];
  const sideConf = clamp(
    side.p * 100 +
      (side.value === "1" ? +(ppgEdge + h2hEdge) * 10 : 0) +
      (side.value === "2" ? -(ppgEdge + h2hEdge) * 10 : 0),
    5,
    95
  );

  /* ----------- 2) HOME_SCORES ----------- */
  const homeScoresP = probs.pHomeScores;
  const homeScoresValue = homeScoresP >= 0.5 ? "YES" : "NO";
  const homeScoresConf = clamp(
    (homeScoresValue === "YES" ? homeScoresP : 1 - homeScoresP) * 100 +
      (home.last10_scored_pct - 50) * 0.2,
    5,
    95
  );

  /* ----------- 3) AWAY_SCORES ----------- */
  const awayScoresP = probs.pAwayScores;
  const awayScoresValue = awayScoresP >= 0.5 ? "YES" : "NO";
  const awayScoresConf = clamp(
    (awayScoresValue === "YES" ? awayScoresP : 1 - awayScoresP) * 100 +
      (away.last10_scored_pct - 50) * 0.2,
    5,
    95
  );

  /* ----------- 4) TOTAL_GOALS (2.5 üst/alt) ----------- */
  const overP = probs.pOver25;
  const totalValue = overP >= 0.5 ? "OVER_2_5" : "UNDER_2_5";
  const totalConf = clamp(
    (totalValue === "OVER_2_5" ? overP : 1 - overP) * 100 +
      ((home.last10_over25_pct + away.last10_over25_pct) / 2 - 50) * 0.2,
    5,
    95
  );

  const predictions = [
    {
      prediction_type: "SIDE",
      predicted_value: side.value,
      confidence: round2(sideConf),
      reasoning:
        `${side.label} (model p=${pct(side.p)}). ` +
        `λ_ev=${lambdaHome.toFixed(2)}, λ_dep=${lambdaAway.toFixed(2)}. ` +
        `Form ppg farkı: ${homePpg.toFixed(2)} vs ${awayPpg.toFixed(2)}.` +
        (h2h?.matches_played ? ` H2H ${h2h.matches_played} maç: ${h2h.team_a_wins}-${h2h.draws}-${h2h.team_b_wins}.` : " H2H verisi yok."),
    },
    {
      prediction_type: "HOME_SCORES",
      predicted_value: homeScoresValue,
      confidence: round2(homeScoresConf),
      reasoning:
        `Ev sahibi gol atar mı? ${homeScoresValue === "YES" ? "Evet" : "Hayır"} ` +
        `(p=${pct(homeScoresP)}). Son 10’da gol attığı maç: %${home.last10_scored_pct}. ` +
        `Deplasmanın kalesi kapalı maç: %${away.last10_clean_pct}.`,
    },
    {
      prediction_type: "AWAY_SCORES",
      predicted_value: awayScoresValue,
      confidence: round2(awayScoresConf),
      reasoning:
        `Deplasman gol atar mı? ${awayScoresValue === "YES" ? "Evet" : "Hayır"} ` +
        `(p=${pct(awayScoresP)}). Son 10’da gol attığı maç: %${away.last10_scored_pct}. ` +
        `Ev sahibinin kalesi kapalı maç: %${home.last10_clean_pct}.`,
    },
    {
      prediction_type: "TOTAL_GOALS",
      predicted_value: totalValue,
      confidence: round2(totalConf),
      reasoning:
        `Toplam gol ${totalValue === "OVER_2_5" ? "2.5 üstü" : "2.5 altı"} ` +
        `(p_over=${pct(overP)}). Beklenen toplam: ${(lambdaHome + lambdaAway).toFixed(2)}. ` +
        `Son 10’larında 2.5 üstü oranı: ev %${home.last10_over25_pct}, dep %${away.last10_over25_pct}.` +
        (h2h?.avg_total_goals ? ` H2H ort gol: ${h2h.avg_total_goals}.` : ""),
    },
  ];

  // En yüksek confidence best_pick
  let best = predictions[0];
  for (const p of predictions) if (p.confidence > best.confidence) best = p;
  best.best_pick = true;
  for (const p of predictions) if (p !== best) p.best_pick = false;

  return {
    predictions,
    bestPick: best,
    debug: { lambdaHome, lambdaAway, probs, homePpg, awayPpg, h2hEdge },
  };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function round2(v) { return Math.round(v * 100) / 100; }
function pct(p) { return `${(p * 100).toFixed(1)}%`; }
