import express from "express";
import cors from "cors";
import "dotenv/config";

import { matchesRouter } from "./routes/matches.js";
import { archiveRouter } from "./routes/archive.js";
import { startCron } from "./jobs/cron.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.use("/matches", matchesRouter);
app.use("/archive", archiveRouter);

// Merkezi hata yakalayıcı
app.use((err, _req, res, _next) => {
  console.error("[api] error:", err);
  res.status(err.status || 500).json({ error: err.message || "internal error" });
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`[api] listening on :${PORT}`);
  if (process.env.ENABLE_CRON !== "false") {
    startCron();
  } else {
    console.log("[cron] disabled via ENABLE_CRON=false");
  }
});
