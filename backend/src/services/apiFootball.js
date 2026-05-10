import axios from "axios";
import "dotenv/config";

/**
 * API-Football (v3.football.api-sports.io) ince istemci.
 *
 * Free-plan uyumluluğu
 *   - `last=N` parametresi (fixtures ve head-to-head için) Free plan'da YASAK.
 *   - Bu yüzden "son N maç" sorgularını `team + league + season` kombinasyonu
 *     ile çekip sonucu JS tarafında dilimliyoruz.
 *
 * Rate limit
 *   - Free plan: dakikada 10 istek.
 *   - İstekleri sıraya dizip her biri arasında en az MIN_GAP_MS ms bekliyoruz
 *     (varsayılan 7_500ms → dakikada ~8 istek, güvenli pay var).
 *   - Yanıt 429/"rateLimit" dönerse RETRY_MS kadar bekleyip tekrar deniyoruz.
 */

const HOST = process.env.API_FOOTBALL_HOST || "v3.football.api-sports.io";
const KEY = process.env.API_FOOTBALL_KEY || "";

const MIN_GAP_MS = Number(process.env.API_FOOTBALL_MIN_GAP_MS) || 7_500;
const RETRY_MS = Number(process.env.API_FOOTBALL_RETRY_MS) || 65_000;
const MAX_RETRIES = Number(process.env.API_FOOTBALL_MAX_RETRIES) || 2;

const client = axios.create({
  baseURL: `https://${HOST}`,
  timeout: 20_000,
  headers: {
    "x-apisports-key": KEY,
    "x-rapidapi-key": KEY,
    "x-rapidapi-host": HOST,
  },
});

/* ---------- istek kuyruğu ---------- */

let _lastRequestAt = 0;
let _chain = Promise.resolve();

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/** İstekleri tek bir FIFO kuyruğa alıp aralarında MIN_GAP_MS bırakıyor. */
function enqueue(taskFn) {
  const task = _chain.then(async () => {
    const elapsed = Date.now() - _lastRequestAt;
    const wait = Math.max(0, MIN_GAP_MS - elapsed);
    if (wait > 0) await sleep(wait);
    _lastRequestAt = Date.now();
    return taskFn();
  });
  _chain = task.catch(() => {}); // bir task dusse bile kuyruk aksin
  return task;
}

async function getRaw(path, params) {
  if (!KEY) throw new Error("API_FOOTBALL_KEY is not set");
  const { data } = await client.get(path, { params });
  return data;
}

async function get(path, params) {
  return enqueue(async () => {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const data = await getRaw(path, params);
      const errs = data?.errors;

      // errors bos array ise sorun yok
      const hasError = errs && !Array.isArray(errs) && Object.keys(errs).length > 0;
      if (!hasError) return data?.response ?? [];

      // Rate limit -> bekle ve yeniden dene
      if (errs.rateLimit && attempt < MAX_RETRIES) {
        console.warn(`[api-football] rate limited on ${path}, waiting ${RETRY_MS}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(RETRY_MS);
        continue;
      }

      // Baska hatalar -> yakalanabilir bir Error firlat
      const msg = JSON.stringify(errs);
      throw new Error(`API-Football error: ${msg}`);
    }
    return [];
  });
}

/* ------------ Fixtures ------------ */

/** Belirli tarih araligindaki fiksturler (YYYY-MM-DD). */
export async function getFixturesByDateRange({ from, to, league, season }) {
  return get("/fixtures", { from, to, league, season });
}

/** Tek gunun fiksturleri. */
export async function getFixturesByDate({ date, league, season }) {
  return get("/fixtures", { date, league, season });
}

/** Bitmis fiksturler (status=FT-AET-PEN). */
export async function getFinishedFixtures({ from, to, league, season }) {
  return get("/fixtures", { from, to, league, season, status: "FT-AET-PEN" });
}

/**
 * Bir takimin belirli lig + sezondaki TUM fiksturleri.
 * Free plan buna izin verir; "son 10 mac" hesabi icin client-side'da siralayip dilimliyoruz.
 */
export async function getTeamSeasonFixtures({ team, league, season }) {
  return get("/fixtures", { team, league, season });
}

/* ------------ Team last-N (Free plan uyumlu) ------------ */

/**
 * Bir takimin sezon + lig icindeki son N oynanmis maci.
 * - `last=N` parametresi Free plan'da yasak, onun yerine sezon fiksturlerini cekip
 *   bitmis olanlari tarihe gore azalan siralayip ilk N'i aliyoruz.
 *
 * Caller `cutoffDate` verirse (ISO string) yalnizca o tarihten ONCEKI maclar doner.
 * Bu, gecmis bir maca form uretirken "data leakage"i onler.
 */
export async function getTeamLastMatches({ team, league, season, cutoffDate = null, last = 10 }) {
  const all = await getTeamSeasonFixtures({ team, league, season });
  const finished = all.filter((f) => {
    const s = f.fixture?.status?.short;
    if (!["FT", "AET", "PEN"].includes(s)) return false;
    if (cutoffDate && new Date(f.fixture.date) >= new Date(cutoffDate)) return false;
    return true;
  });
  finished.sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date));
  return finished.slice(0, last);
}

/* ------------ H2H ------------ */

/** Iki takim arasindaki son N mac. Free plan `last` parametresine izin vermeyebilir; fallback var. */
export async function getH2H({ teamA, teamB, last = 5, cutoffDate = null }) {
  let fixtures;
  try {
    fixtures = await get("/fixtures/headtohead", { h2h: `${teamA}-${teamB}`, last });
  } catch (err) {
    // Free plan fallback: last parametresiz cek, client-side dilimle
    if (String(err.message).includes("Last parameter")) {
      fixtures = await get("/fixtures/headtohead", { h2h: `${teamA}-${teamB}` });
    } else {
      throw err;
    }
  }
  let played = fixtures.filter((f) => ["FT", "AET", "PEN"].includes(f.fixture?.status?.short));
  if (cutoffDate) {
    played = played.filter((f) => new Date(f.fixture.date) < new Date(cutoffDate));
  }
  played.sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date));
  return played.slice(0, last);
}

/* ------------ Bonus ------------ */

export async function getTeamSeasonStats({ team, league, season }) {
  return get("/teams/statistics", { team, league, season });
}

export async function getFixtureInjuries({ fixture }) {
  return get("/injuries", { fixture });
}

export default {
  getFixturesByDateRange,
  getFixturesByDate,
  getFinishedFixtures,
  getTeamSeasonFixtures,
  getTeamLastMatches,
  getH2H,
  getTeamSeasonStats,
  getFixtureInjuries,
};
