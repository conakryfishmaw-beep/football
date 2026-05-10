import axios from "axios";
import "dotenv/config";

/**
 * API-Football (v3.football.api-sports.io) ince istemci.
 * https://www.api-football.com/documentation-v3
 *
 * NOT: RapidAPI üzerinden kullanılacaksa baseURL ve header adları değişir
 * (x-rapidapi-key / x-rapidapi-host). Burada doğrudan api-sports endpointi kullanılıyor.
 */

const HOST = process.env.API_FOOTBALL_HOST || "v3.football.api-sports.io";
const KEY = process.env.API_FOOTBALL_KEY || "";

const client = axios.create({
  baseURL: `https://${HOST}`,
  timeout: 15_000,
  headers: {
    "x-apisports-key": KEY,
    "x-rapidapi-key": KEY,
    "x-rapidapi-host": HOST,
  },
});

client.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err.response?.status;
    const data = err.response?.data;
    console.error(`[api-football] ${err.config?.url} -> ${status}`, data || err.message);
    return Promise.reject(err);
  }
);

async function get(path, params) {
  if (!KEY) throw new Error("API_FOOTBALL_KEY is not set");
  const { data } = await client.get(path, { params });
  if (data?.errors && Object.keys(data.errors).length > 0) {
    const msg = JSON.stringify(data.errors);
    throw new Error(`API-Football error: ${msg}`);
  }
  return data?.response ?? [];
}

/* ------------ Fixtures ------------ */

/** Belirli tarih aralığındaki fikstürler (YYYY-MM-DD). */
export async function getFixturesByDateRange({ from, to, league, season }) {
  return get("/fixtures", { from, to, league, season });
}

/** Tek günün fikstürleri. */
export async function getFixturesByDate({ date, league, season }) {
  return get("/fixtures", { date, league, season });
}

/** Durumu FT/AET/PEN olan bitmiş maçları çeker (sonuç senkronu için). */
export async function getFinishedFixtures({ from, to, league, season }) {
  return get("/fixtures", {
    from,
    to,
    league,
    season,
    status: "FT-AET-PEN",
  });
}

/* ------------ H2H ------------ */

/** İki takım arasında son N maç. */
export async function getH2H({ teamA, teamB, last = 5 }) {
  return get("/fixtures/headtohead", { h2h: `${teamA}-${teamB}`, last });
}

/* ------------ Team form (son N maç) ------------ */

/** Bir takımın son N oynanmış maçı. */
export async function getTeamLastMatches({ team, last = 10 }) {
  return get("/fixtures", { team, last });
}

/** Takım sezon istatistikleri (opsiyonel; yardımcı sinyal). */
export async function getTeamSeasonStats({ team, league, season }) {
  return get("/teams/statistics", { team, league, season });
}

/* ------------ Kadro / Sakat-cezalı ------------ */

/** Bir fikstürün kayıp/sakat oyuncuları (varsa). */
export async function getFixtureInjuries({ fixture }) {
  return get("/injuries", { fixture });
}

export default {
  getFixturesByDateRange,
  getFixturesByDate,
  getFinishedFixtures,
  getH2H,
  getTeamLastMatches,
  getTeamSeasonStats,
  getFixtureInjuries,
};
