const MODES = [
    "sword",
    "axe",
    "mace",
    "pot",
    "uhc",
    "vanilla",
    "smp",
    "nethop"
];

function json(data, status = 200) {
    return new Response(
        JSON.stringify(data, null, 2),
        {
            status,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type"
            }
        }
    );
}

function getTierFromElo(elo) {

    if (elo >= 2250) return "HT1";
    if (elo >= 2000) return "LT1";

    if (elo >= 1900) return "HT2";
    if (elo >= 1800) return "LT2";

    if (elo >= 1650) return "HT3";
    if (elo >= 1500) return "LT3";

    if (elo >= 1300) return "HT4";
    if (elo >= 1200) return "LT4";

    if (elo >= 1100) return "HT5";
    if (elo >= 1000) return "LT5";

    return "UNRANKED";
}

function validMode(mode) {
    return MODES.includes(mode);
}

export default {

    async fetch(request, env) {

        /*
        =========================
        CORS
        =========================
        */

        if (request.method === "OPTIONS") {

            return new Response(null, {
                status: 204,

                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type"
                }
            });
        }

        const url = new URL(request.url);

        const path = url.pathname;

        const method = request.method;


        /*
        =========================
        HEALTH
        =========================
        */

        if (
            method === "GET" &&
            path === "/health"
        ) {

            return json({
                success: true,
                message: "SpicyTiers API is online",
                version: "2.1.0",
                database: "D1"
            });
        }


        /*
        =========================
        OVERALL LEADERBOARD
        =========================

        Supports BOTH:

        /leaderboard

        /leaderboard/overall

        =========================
        */

        if (
            method === "GET" &&
            (
                path === "/leaderboard" ||
                path === "/leaderboard/overall"
            )
        ) {

            const result = await env.DB.prepare(`
                SELECT
                    p.uuid,
                    p.username,
                    s.mode,
                    s.elo
                FROM players p
                INNER JOIN player_stats s
                    ON p.uuid = s.uuid
                ORDER BY s.elo DESC
            `).all();


            /*
            =========================
            GROUP PLAYERS
            =========================
            */

            const playerMap = new Map();


            for (const row of result.results) {

                const uuid =
                    row.uuid;

                const username =
                    row.username;

                const mode =
                    row.mode;

                const elo =
                    Number(row.elo) || 0;


                if (!playerMap.has(uuid)) {

                    playerMap.set(
                        uuid,
                        {
                            username,
                            uuid,

                            modes: {},

                            totalElo: 0,
                            modeCount: 0
                        }
                    );
                }


                const player =
                    playerMap.get(uuid);


                player.modes[mode] = {

                    elo,

                    tier:
                        getTierFromElo(elo)
                };


                /*
                =========================
                OVERALL ELO
                =========================
                */

                if (elo > 0) {

                    player.totalElo += elo;

                    player.modeCount++;
                }
            }


            /*
            =========================
            CREATE OVERALL PLAYERS
            =========================
            */

            const players =
                Array.from(
                    playerMap.values()
                )
                .map(player => {

                    const overallElo =
                        player.modeCount > 0
                            ? Math.round(
                                player.totalElo /
                                player.modeCount
                            )
                            : 0;


                    /*
                    Make sure every mode exists.
                    */

                    for (const mode of MODES) {

                        if (
                            !player.modes[mode]
                        ) {

                            player.modes[mode] = {

                                elo: 0,

                                tier: "UNRANKED"
                            };
                        }
                    }


                    return {

                        username:
                            player.username,

                        uuid:
                            player.uuid,

                        tier:
                            getTierFromElo(
                                overallElo
                            ),

                        elo:
                            overallElo,

                        modes:
                            player.modes
                    };
                })
                .filter(
                    player =>
                        player.elo > 0
                )
                .sort(
                    (a, b) =>
                        b.elo - a.elo
                );


            return json({

                success: true,

                mode: "overall",

                players
            });
        }


        /*
        =========================
        GAMEMODE LEADERBOARD
        =========================
        */

        if (
            method === "GET" &&
            path.startsWith("/leaderboard/")
        ) {

            const mode =
                path
                    .replace(
                        "/leaderboard/",
                        ""
                    )
                    .toLowerCase();


            if (!validMode(mode)) {

                return json({

                    success: false,

                    error:
                        "Invalid gamemode",

                    mode

                }, 400);
            }


            const result =
                await env.DB.prepare(`
                    SELECT
                        p.uuid,
                        p.username,
                        s.elo
                    FROM players p
                    INNER JOIN player_stats s
                        ON p.uuid = s.uuid
                    WHERE s.mode = ?
                    ORDER BY s.elo DESC
                `)
                .bind(mode)
                .all();


            const players =
                result.results.map(
                    player => {

                        const elo =
                            Number(
                                player.elo
                            ) || 0;


                        return {

                            username:
                                player.username,

                            uuid:
                                player.uuid,

                            tier:
                                getTierFromElo(
                                    elo
                                ),

                            elo
                        };
                    }
                );


            return json({

                success: true,

                mode,

                players
            });
        }


        /*
        =========================
        PLAYER SYNC
        =========================
        */

        if (
            method === "POST" &&
            path === "/player/sync"
        ) {

            try {

                const body =
                    await request.json();


                const uuid =
                    body.uuid;

                const username =
                    body.username;


                if (
                    !uuid ||
                    !username
                ) {

                    return json({

                        success: false,

                        error:
                            "UUID and username are required"

                    }, 400);
                }


                /*
                =========================
                CREATE / UPDATE PLAYER
                =========================
                */

                await env.DB.prepare(`
                    INSERT INTO players (
                        uuid,
                        username
                    )
                    VALUES (?, ?)
                    ON CONFLICT(uuid)
                    DO UPDATE SET
                        username =
                            excluded.username,
                        updated_at =
                            CURRENT_TIMESTAMP
                `)
                .bind(
                    uuid,
                    username
                )
                .run();


                /*
                =========================
                CREATE DEFAULT STATS
                =========================
                */

                for (
                    const mode of MODES
                ) {

                    await env.DB.prepare(`
                        INSERT OR IGNORE INTO player_stats (
                            uuid,
                            mode,
                            elo,
                            wins,
                            losses,
                            games_played
                        )
                        VALUES (?, ?, 1000, 0, 0, 0)
                    `)
                    .bind(
                        uuid,
                        mode
                    )
                    .run();
                }


                /*
                =========================
                GET PLAYER
                =========================
                */

                const player =
                    await env.DB.prepare(`
                        SELECT
                            uuid,
                            username,
                            created_at,
                            updated_at
                        FROM players
                        WHERE uuid = ?
                    `)
                    .bind(uuid)
                    .first();


                return json({

                    success: true,

                    message:
                        "Player synced",

                    player
                });


            } catch (error) {

                console.error(error);


                return json({

                    success: false,

                    error:
                        "Failed to sync player"

                }, 500);
            }
        }


        /*
        =========================
        GET PLAYER
        =========================
        */

        if (
            method === "GET" &&
            path.startsWith("/player/")
        ) {

            const uuid =
                path.replace(
                    "/player/",
                    ""
                );


            const player =
                await env.DB.prepare(`
                    SELECT
                        uuid,
                        username,
                        created_at,
                        updated_at
                    FROM players
                    WHERE uuid = ?
                `)
                .bind(uuid)
                .first();


            if (!player) {

                return json({

                    success: false,

                    error:
                        "Player not found"

                }, 404);
            }


            const statsResult =
                await env.DB.prepare(`
                    SELECT
                        mode,
                        elo,
                        wins,
                        losses,
                        games_played
                    FROM player_stats
                    WHERE uuid = ?
                `)
                .bind(uuid)
                .all();


            const modes = {};


            for (
                const mode of MODES
            ) {

                const stats =
                    statsResult.results.find(
                        s =>
                            s.mode === mode
                    );


                const elo =
                    stats
                        ? Number(
                            stats.elo
                        ) || 0
                        : 0;


                modes[mode] = {

                    elo,

                    tier:
                        getTierFromElo(
                            elo
                        ),

                    wins:
                        stats
                            ? Number(
                                stats.wins
                            ) || 0
                            : 0,

                    losses:
                        stats
                            ? Number(
                                stats.losses
                            ) || 0
                            : 0,

                    games_played:
                        stats
                            ? Number(
                                stats.games_played
                            ) || 0
                            : 0
                };
            }


            return json({

                success: true,

                player: {

                    username:
                        player.username,

                    uuid:
                        player.uuid,

                    created_at:
                        player.created_at,

                    updated_at:
                        player.updated_at,

                    modes
                }
            });
        }


        /*
        =========================
        404
        =========================
        */

        return json({

            success: false,

            error:
                "Endpoint not found",

            path

        }, 404);
    }
};
