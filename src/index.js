const GAMEMODES = [
    "sword",
    "axe",
    "vanilla",
    "uhc",
    "smp",
    "netheriteop",
    "pot",
    "mace"
];

const ALLOWED_ORIGINS = [
    "https://strahinjapile.github.io",
    "https://spicytiers.github.io"
];


export default {

    async fetch(request, env) {

        const url = new URL(request.url);

        const origin = request.headers.get("Origin");

        const headers = {
            "Content-Type": "application/json",
            "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-SpicyTiers-Key"
        };

        if (ALLOWED_ORIGINS.includes(origin)) {
            headers["Access-Control-Allow-Origin"] = origin;
        }


        /* =========================
           CORS
        ========================= */

        if (request.method === "OPTIONS") {

            return new Response(null, {
                status: 204,
                headers
            });

        }


        try {

            /* =========================
               API STATUS
            ========================= */

            if (
                url.pathname === "/" ||
                url.pathname === "/api"
            ) {

                return json({
                    success: true,
                    name: "SpicyTiers API",
                    version: "1.0.0",
                    status: "online"
                }, 200, headers);

            }


            /* =========================
               LEADERBOARD
               
               GET
               /api/leaderboard/sword
            ========================= */

            if (
                request.method === "GET" &&
                url.pathname.startsWith("/api/leaderboard/")
            ) {

                const gamemode =
                    url.pathname
                        .split("/")
                        .pop()
                        .toLowerCase();


                if (!GAMEMODES.includes(gamemode)) {

                    return json({
                        success: false,
                        error: "Invalid gamemode"
                    }, 400, headers);

                }


                const limit =
                    Math.min(
                        Number(url.searchParams.get("limit")) || 100,
                        200
                    );


                const result =
                    await env.DB
                        .prepare(`
                            SELECT
                                players.uuid,
                                players.username,
                                player_stats.gamemode,
                                player_stats.elo,
                                player_stats.tier,
                                player_stats.wins,
                                player_stats.losses

                            FROM player_stats

                            INNER JOIN players
                                ON players.uuid = player_stats.uuid

                            WHERE player_stats.gamemode = ?

                            ORDER BY player_stats.elo DESC

                            LIMIT ?
                        `)
                        .bind(gamemode, limit)
                        .all();


                return json({
                    success: true,
                    gamemode,
                    players: result.results
                }, 200, headers);

            }


            /* =========================
               GET PLAYER
               
               /api/player/UUID
            ========================= */

            if (
                request.method === "GET" &&
                url.pathname.startsWith("/api/player/")
            ) {

                const uuid =
                    decodeURIComponent(
                        url.pathname.substring(
                            "/api/player/".length
                        )
                    );


                const player =
                    await env.DB
                        .prepare(`
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
                        error: "Player not found"
                    }, 404, headers);

                }


                const stats =
                    await env.DB
                        .prepare(`
                            SELECT
                                gamemode,
                                elo,
                                tier,
                                wins,
                                losses
                            FROM player_stats
                            WHERE uuid = ?
                            ORDER BY gamemode
                        `)
                        .bind(uuid)
                        .all();


                return json({
                    success: true,
                    player,
                    stats: stats.results
                }, 200, headers);

            }


            /* =========================
               SEARCH PLAYER
               
               /api/search?username=Steve
            ========================= */

            if (
                request.method === "GET" &&
                url.pathname === "/api/search"
            ) {

                const username =
                    url.searchParams
                        .get("username");


                if (!username) {

                    return json({
                        success: false,
                        error: "Username is required"
                    }, 400, headers);

                }


                const players =
                    await env.DB
                        .prepare(`
                            SELECT
                                uuid,
                                username
                            FROM players
                            WHERE username LIKE ?
                            ORDER BY username
                            LIMIT 20
                        `)
                        .bind(`%${username}%`)
                        .all();


                return json({
                    success: true,
                    players: players.results
                }, 200, headers);

            }


            /* =========================
               UPDATE PLAYER
               
               POST /api/player
            ========================= */

            if (
                request.method === "POST" &&
                url.pathname === "/api/player"
            ) {

                const key =
                    request.headers
                        .get("X-SpicyTiers-Key");


                if (!env.API_KEY ||
                    key !== env.API_KEY) {

                    return json({
                        success: false,
                        error: "Unauthorized"
                    }, 401, headers);

                }


                const body =
                    await request.json();


                if (!body.uuid ||
                    !body.username) {

                    return json({
                        success: false,
                        error: "uuid and username are required"
                    }, 400, headers);

                }


                const now =
                    Date.now();


                await env.DB
                    .prepare(`
                        INSERT INTO players (
                            uuid,
                            username,
                            created_at,
                            updated_at
                        )

                        VALUES (?, ?, ?, ?)

                        ON CONFLICT(uuid)
                        DO UPDATE SET
                            username = excluded.username,
                            updated_at = excluded.updated_at
                    `)
                    .bind(
                        body.uuid,
                        body.username,
                        now,
                        now
                    )
                    .run();


                if (body.stats) {

                    for (const gamemode of GAMEMODES) {

                        const stats =
                            body.stats[gamemode];

                        if (!stats) continue;


                        const elo =
                            Number(stats.elo) || 0;


                        const tier =
                            getTierFromElo(elo);


                        await env.DB
                            .prepare(`
                                INSERT INTO player_stats (
                                    uuid,
                                    gamemode,
                                    elo,
                                    tier,
                                    wins,
                                    losses
                                )

                                VALUES (?, ?, ?, ?, ?, ?)

                                ON CONFLICT(uuid, gamemode)

                                DO UPDATE SET
                                    elo = excluded.elo,
                                    tier = excluded.tier,
                                    wins = excluded.wins,
                                    losses = excluded.losses
                            `)
                            .bind(
                                body.uuid,
                                gamemode,
                                elo,
                                tier,
                                Number(stats.wins) || 0,
                                Number(stats.losses) || 0
                            )
                            .run();

                    }

                }


                return json({
                    success: true,
                    message: "Player updated"
                }, 200, headers);

            }


            return json({
                success: false,
                error: "Endpoint not found"
            }, 404, headers);


        } catch (error) {

            console.error(error);


            return json({
                success: false,
                error: "Internal server error"
            }, 500, headers);

        }

    }

};


/* =========================
   TIER SYSTEM
========================= */

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


/* =========================
   JSON RESPONSE
========================= */

function json(data, status, headers) {

    return new Response(
        JSON.stringify(data),
        {
            status,
            headers
        }
    );

}
