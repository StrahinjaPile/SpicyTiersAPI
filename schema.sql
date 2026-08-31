CREATE TABLE IF NOT EXISTS players (
    uuid TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS player_stats (
    uuid TEXT NOT NULL,
    mode TEXT NOT NULL,

    elo INTEGER NOT NULL DEFAULT 1000,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    games_played INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (uuid, mode),

    FOREIGN KEY (uuid)
        REFERENCES players(uuid)
);

CREATE INDEX IF NOT EXISTS idx_player_stats_mode_elo
ON player_stats(mode, elo DESC);
