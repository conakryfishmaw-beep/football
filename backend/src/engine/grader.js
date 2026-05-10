/**
 * Bir tahmin kaydını nihai skorla karşılaştırıp 'WON' | 'LOST' | 'VOID' döndürür.
 *
 * match: { home_goals, away_goals, status }
 * prediction: { prediction_type, predicted_value }
 */
export function gradePrediction(match, prediction) {
  if (match.home_goals == null || match.away_goals == null) return "PENDING";
  if (!["FT", "AET", "PEN"].includes(match.status)) return "PENDING";

  const hg = match.home_goals;
  const ag = match.away_goals;

  switch (prediction.prediction_type) {
    case "SIDE": {
      const actual = hg > ag ? "1" : hg < ag ? "2" : "X";
      return prediction.predicted_value === actual ? "WON" : "LOST";
    }
    case "HOME_SCORES": {
      const actual = hg > 0 ? "YES" : "NO";
      return prediction.predicted_value === actual ? "WON" : "LOST";
    }
    case "AWAY_SCORES": {
      const actual = ag > 0 ? "YES" : "NO";
      return prediction.predicted_value === actual ? "WON" : "LOST";
    }
    case "TOTAL_GOALS": {
      const total = hg + ag;
      const actual = total > 2.5 ? "OVER_2_5" : "UNDER_2_5";
      return prediction.predicted_value === actual ? "WON" : "LOST";
    }
    default:
      return "VOID";
  }
}
