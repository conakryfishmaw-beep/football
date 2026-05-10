-- AI Football Predictor schema
-- Tüm tablolar şeffaflık için append-only mantığıyla kurgulanmıştır:
-- tahminler asla silinmez, sadece sonuç kolonu güncellenir.

CREATE TABLE IF NOT EXISTS matches (
    id              BIGINT PRIMARY KEY,                -- API-Football fixture.id
    league_id       INTEGER      NOT NULL,
    league_name     TEXT         NOT NULL,
    season          INTEGER      NOT NULL,
    match_date      TIMESTAMPTZ  NOT NULL,
    home_team_id    INTEGER      NOT NULL,
    home_team_name  TEXT         NOT NULL,
    away_team_id    INTEGER      NOT NULL,
    away_team_name  TEXT         NOT NULL,
    home_goals      INTEGER,
    away_goals      INTEGER,
    status          TEXT         NOT NULL DEFAULT 'NS',   -- NS=Not Started, LIVE, FT=Finished, PST=Postponed, CANC
    venue           TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_date        ON matches (match_date);
CREATE INDEX IF NOT EXISTS idx_matches_status      ON matches (status);
CREATE INDEX IF NOT EXISTS idx_matches_league_date ON matches (league_id, match_date);
CREATE INDEX IF NOT EXISTS idx_matches_home_team   ON matches (home_team_id);
CREATE INDEX IF NOT EXISTS idx_matches_away_team   ON matches (away_team_id);


-- Her maç için 4 tahmin kaydedilir (side / home_scores / away_scores / total_goals).
-- AI bunlardan "best_pick=true" olanı önerir, fakat diğer üçü de arşivde kalır.
CREATE TABLE IF NOT EXISTS predictions (
    id               BIGSERIAL PRIMARY KEY,
    match_id         BIGINT      NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    prediction_type  TEXT        NOT NULL,   -- 'SIDE' | 'HOME_SCORES' | 'AWAY_SCORES' | 'TOTAL_GOALS'
    predicted_value  TEXT        NOT NULL,   -- '1' | 'X' | '2' | 'YES' | 'NO' | 'OVER_2_5' | 'UNDER_2_5'
    confidence       NUMERIC(5,2) NOT NULL,  -- 0-100
    reasoning        TEXT        NOT NULL,
    best_pick        BOOLEAN     NOT NULL DEFAULT FALSE,
    result           TEXT        NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'WON' | 'LOST' | 'VOID'
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at      TIMESTAMPTZ,
    UNIQUE (match_id, prediction_type)
);

CREATE INDEX IF NOT EXISTS idx_predictions_match    ON predictions (match_id);
CREATE INDEX IF NOT EXISTS idx_predictions_result   ON predictions (result);
CREATE INDEX IF NOT EXISTS idx_predictions_best     ON predictions (best_pick) WHERE best_pick = TRUE;


-- Bir takımın anlık form fotoğrafı: son 10 maç özetleri + H2H özet.
-- (Kaynak veri olarak matches tablosundan da türetilebilir; burada cache amaçlıdır.)
CREATE TABLE IF NOT EXISTS team_stats (
    id                 BIGSERIAL PRIMARY KEY,
    team_id            INTEGER      NOT NULL,
    team_name          TEXT         NOT NULL,
    league_id          INTEGER      NOT NULL,
    season             INTEGER      NOT NULL,
    last10_played      INTEGER      NOT NULL DEFAULT 0,
    last10_wins        INTEGER      NOT NULL DEFAULT 0,
    last10_draws       INTEGER      NOT NULL DEFAULT 0,
    last10_losses      INTEGER      NOT NULL DEFAULT 0,
    last10_goals_for   INTEGER      NOT NULL DEFAULT 0,
    last10_goals_against INTEGER    NOT NULL DEFAULT 0,
    last10_scored_pct  NUMERIC(5,2) NOT NULL DEFAULT 0,   -- gol attığı maç yüzdesi
    last10_clean_pct   NUMERIC(5,2) NOT NULL DEFAULT 0,   -- gol yemediği maç yüzdesi
    last10_over25_pct  NUMERIC(5,2) NOT NULL DEFAULT 0,
    form_string        TEXT         NOT NULL DEFAULT '',  -- ör: 'WWDLW'
    raw                JSONB,
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (team_id, league_id, season)
);

CREATE INDEX IF NOT EXISTS idx_team_stats_team ON team_stats (team_id);


-- H2H özet tablosu (iki takım arasındaki son 5 maç)
CREATE TABLE IF NOT EXISTS h2h_stats (
    id               BIGSERIAL PRIMARY KEY,
    team_a_id        INTEGER      NOT NULL,
    team_b_id        INTEGER      NOT NULL,
    matches_played   INTEGER      NOT NULL DEFAULT 0,
    team_a_wins      INTEGER      NOT NULL DEFAULT 0,
    team_b_wins      INTEGER      NOT NULL DEFAULT 0,
    draws            INTEGER      NOT NULL DEFAULT 0,
    avg_total_goals  NUMERIC(5,2) NOT NULL DEFAULT 0,
    raw              JSONB,
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (team_a_id, team_b_id)
);


-- updated_at tetikleyicisi
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_matches_updated ON matches;
CREATE TRIGGER trg_matches_updated BEFORE UPDATE ON matches
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_team_stats_updated ON team_stats;
CREATE TRIGGER trg_team_stats_updated BEFORE UPDATE ON team_stats
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_h2h_updated ON h2h_stats;
CREATE TRIGGER trg_h2h_updated BEFORE UPDATE ON h2h_stats
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
