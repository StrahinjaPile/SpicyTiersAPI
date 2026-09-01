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
        JSON.stringify(
            data,
            null,
            2
        ),
        {
            status,

            headers: {
                "Content-Type":
                    "application/json",

                "Access-Control-Allow-Origin":
                    "*",

                "Access-Control-Allow-Methods":
                    "GET, POST, OPTIONS",

                "Access-Control-Allow-Headers":
                    "Content-Type"
            }
        }
    );
}


function getTierFromElo(elo) {

    if (elo >= 2250)
        return "HT1";

    if (elo >= 2000)
        return "LT1";

    if (elo >= 1900)
        return "HT2";

    if (elo >= 1800)
        return "LT2";

    if (elo >= 1650)
        return "HT3";

    if (elo >= 1500)
        return "LT3";

    if (elo >= 1300)
        return "HT4";

    if (elo >= 1200)
        return "LT4";

    if (elo >= 1100)
        return "HT5";

    if (elo >= 1000)
        return "LT5";

    return "UNRANKED";
}


function validMode(mode) {

    return MODES.includes(
        mode
    );

}


export default {

    async fetch(
        request,
        env
    ) {

        /*
        =========================
        CORS
        =========================
        */

        if (
            request.method ===
            "OPTIONS"
        ) {

            return new Response(
                null,
                {
                    status: 204,

                    headers: {
                        "Access-Control-Allow-Origin":
                            "*",

                        "Access-Control-Allow-Methods":
                            "GET, POST, OPTIONS",

                        "Access-Control-Allow-Headers":
                            "Content-Type"
                    }
                }
            );

        }


        const url =
            new URL(
                request.url
            );


        const path =
            url.pathname;


        const method =
            request.method;


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

                message:
                    "SpicyTiers API is online",

                version:
                    "2.1.0",

                database:
                    "D1"

            });

        }


        /*
        =========================
        OVERALL LEADERBOARD
        =========================

        Overall ELO =
        TOTAL ELO FROM ALL MODES

        Each player also returns
        every individual mode
        and its tier.
        */

        if (
            method === "GET" &&
            path === "/leaderboard"
        ) {

            const playersResult =
                await env.DB.prepare(`
                    SELECT
                        p.uuid,
                        p.username
                    FROM players p
                    ORDER BY p.username ASC
                `)
                .all();


            const players = [];


            for (
                const player
                of playersResult.results
            ) {

                const statsResult =
                    await env.DB.prepare(`
                        SELECT
                            mode,
                            elo
                        FROM player_stats
                        WHERE uuid = ?
                    `)
                    .bind(
                        player.uuid
                    )
                    .all();


                let totalElo =
                    0;


                const modes =
                    {};


                for (
                    const mode
                    of MODES
                ) {

                    const stat =
                        statsResult.results.find(
                            s =>
                                s.mode ===
                                mode
                        );


                    const elo =
                        stat
                            ? (
                                Number(
                                    stat.elo
                                ) || 0
                            )
                            : 0;


                    /*
                    =========================
                    ADD TO TOTAL ELO
                    =========================
                    */

                    totalElo +=
                        elo;


                    /*
                    =========================
                    SAVE INDIVIDUAL MODE
                    =========================
                    */

                    modes[mode] = {

                        elo:

                            elo,


                        tier:

                            getTierFromElo(
                                elo
                            )

                    };

                }


                players.push({

                    username:

                        player.username,


                    uuid:

                        player.uuid,


                    /*
                    No average tier here.
                    Individual tiers are
                    inside modes.
                    */

                    elo:

                        totalElo,


                    modes:

                        modes

                });

            }


            /*
            =========================
            SORT BY TOTAL ELO
            =========================
            */

            players.sort(
                (
                    a,
                    b
                ) =>

                    b.elo -
                    a.elo
            );


            return json({

                success:
                    true,


                mode:
                    "overall",


                players:

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
            path.startsWith(
                "/leaderboard/"
            )
        ) {

            const mode =
                path
                    .replace(
                        "/leaderboard/",
                        ""
                    )
                    .toLowerCase();


            if (
                !validMode(
                    mode
                )
            ) {

                return json({

                    success:
                        false,


                    error:
                        "Invalid gamemode",


                    mode:
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
                .bind(
                    mode
                )
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


                            elo:

                                elo

                        };

                    }
                );


            return json({

                success:
                    true,


                mode:

                    mode,


                players:

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
            path ===
            "/player/sync"
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

                        success:
                            false,


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
                    const mode
                    of MODES
                ) {

                    await env.DB.prepare(`
                        INSERT OR IGNORE
                        INTO player_stats (

                            uuid,

                            mode,

                            elo,

                            wins,

                            losses,

                            games_played

                        )

                        VALUES (

                            ?,

                            ?,

                            1000,

                            0,

                            0,

                            0

                        )
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
                    .bind(
                        uuid
                    )
                    .first();


                return json({

                    success:
                        true,


                    message:
                        "Player synced",


                    player:

                        player

                });

            } catch (
                error
            ) {

                console.error(
                    error
                );


                return json({

                    success:
                        false,


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
            path.startsWith(
                "/player/"
            )
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
                .bind(
                    uuid
                )
                .first();


            if (
                !player
            ) {

                return json({

                    success:
                        false,


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
                .bind(
                    uuid
                )
                .all();


            const modes =
                {};


            let totalElo =
                0;


            for (
                const mode
                of MODES
            ) {

                const stats =
                    statsResult.results.find(
                        s =>
                            s.mode ===
                            mode
                    );


                const elo =
                    stats

                        ? (
                            Number(
                                stats.elo
                            ) || 0
                        )

                        : 0;


                totalElo +=
                    elo;


                modes[mode] = {

                    elo:

                        elo,


                    tier:

                        getTierFromElo(
                            elo
                        ),


                    wins:

                        stats

                            ? (
                                Number(
                                    stats.wins
                                ) || 0
                            )

                            : 0,


                    losses:

                        stats

                            ? (
                                Number(
                                    stats.losses
                                ) || 0
                            )

                            : 0,


                    games_played:

                        stats

                            ? (
                                Number(
                                    stats.games_played
                                ) || 0
                            )

                            : 0

                };

            }


            return json({

                success:
                    true,


                player: {

                    username:

                        player.username,


                    uuid:

                        player.uuid,


                    created_at:

                        player.created_at,


                    updated_at:

                        player.updated_at,


                    /*
                    TOTAL ELO
                    */

                    elo:

                        totalElo,


                    /*
                    EVERY MODE
                    */

                    modes:

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

            success:
                false,


            error:
                "Endpoint not found",


            path:

                path

        }, 404);

    }

};
