CREATE TABLE IF NOT EXISTS players (
    uuid TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS player_stats (
    uuid TEXT NOT NULL,
    gamemode TEXT NOT NULL,

    elo INTEGER NOT NULL DEFAULT 0,
    tier TEXT NOT NULL DEFAULT 'UNRANKED',

    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (uuid, gamemode),

    FOREIGN KEY (uuid)
        REFERENCES players(uuid)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_player_stats_gamemode_elo
ON player_stats(gamemode, elo DESC);

CREATE INDEX IF NOT EXISTS idx_players_username
ON players(username);
