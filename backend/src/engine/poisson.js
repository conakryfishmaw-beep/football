/**
 * Poisson olasılık yardımcıları.
 * Bu motor, beklenen gol sayısından (λ) skor dağılımı türetir.
 */

export function factorial(n) {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

export function poissonPmf(k, lambda) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

/** P(X = 0) — takım 0 gol atma olasılığı. */
export function pZero(lambda) {
  return Math.exp(-Math.max(lambda, 0));
}

/**
 * İki bağımsız Poisson takımdan maç olasılıkları.
 * Döndürür: pHome (1), pDraw (X), pAway (2), pOver25, pUnder25, pHomeScores, pAwayScores, pBTTS
 */
export function matchProbabilities(lambdaHome, lambdaAway, maxGoals = 8) {
  let pHome = 0, pDraw = 0, pAway = 0;
  let pOver25 = 0, pUnder25 = 0;
  let pHomeZero = 0, pAwayZero = 0;

  for (let h = 0; h <= maxGoals; h++) {
    const ph = poissonPmf(h, lambdaHome);
    for (let a = 0; a <= maxGoals; a++) {
      const pa = poissonPmf(a, lambdaAway);
      const p = ph * pa;
      if (h > a) pHome += p;
      else if (h === a) pDraw += p;
      else pAway += p;
      if (h + a > 2.5) pOver25 += p; else pUnder25 += p;
    }
  }
  pHomeZero = poissonPmf(0, lambdaHome);
  pAwayZero = poissonPmf(0, lambdaAway);

  return {
    pHome,
    pDraw,
    pAway,
    pOver25,
    pUnder25,
    pHomeScores: 1 - pHomeZero,
    pAwayScores: 1 - pAwayZero,
    pBTTS: (1 - pHomeZero) * (1 - pAwayZero),
  };
}
