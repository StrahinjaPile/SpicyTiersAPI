const MODES = [
    "sword",
    "axe",
    "vanilla",
    "uhc",
    "smp",
    "netheriteop",
    "pot",
    "mace"
];


export default {

    async fetch(request, env) {

        const url = new URL(request.url);

        const path =
            url.pathname
                .replace(/\/+$/, "") || "/";

        const method =
            request.method;


        const headers = {

            "Content-Type":
                "application/json",

            "Access-Control-Allow-Origin":
                "*",

            "Access-Control-Allow-Methods":
                "GET, POST, OPTIONS",

            "Access-Control-Allow-Headers":
                "Content-Type"
        };


        if (method === "OPTIONS") {

            return new Response(null, {
                headers
            });

        }


        try {


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
                        "2.0.0"
                }, headers);

            }


            /*
            =========================
            OVERALL LEADERBOARD
            =========================
            */

            if (
                method === "GET" &&
                path === "/leaderboard"
            ) {

                const result =
                    await getOverallLeaderboard(
                        env.DB
                    );


                return json({

                    success: true,

                    mode:
                        "overall",

                    players:
                        result

                }, headers);

            }


            /*
            =========================
            MODE LEADERBOARD
            =========================
            */

            if (
                method === "GET" &&
                path.startsWith(
                    "/leaderboard/"
                )
            ) {

                const mode =
                    path.split("/")[2]
                        .toLowerCase();


                if (
                    !MODES.includes(mode)
                ) {

                    return json({

                        success: false,

                        error:
                            "Invalid gamemode"

                    }, headers, 400);

                }


                const result =
                    await getModeLeaderboard(
                        env.DB,
                        mode
                    );


                return json({

                    success: true,

                    mode,

                    players:
                        result

                }, headers);

            }


            /*
            =========================
            PLAYER PROFILE
            =========================
            */

            if (
                method === "GET" &&
                path.startsWith("/player/")
            ) {

                const uuid =
                    path.split("/")[2];


                if (!uuid) {

                    return json({

                        success: false,

                        error:
                            "Missing UUID"

                    }, headers, 400);

                }


                const player =
                    await env.DB
                        .prepare(`
                            SELECT
                                uuid,
                                username
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

                    }, headers, 404);

                }


                const stats =
                    await env.DB
                        .prepare(`
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


                const formatted = {};


                for (
                    const stat
                    of stats.results
                ) {

                    formatted[
                        stat.mode
                    ] = {

                        elo:
                            stat.elo,

                        tier:
                            getTierFromElo(
                                stat.elo
                            ),

                        wins:
                            stat.wins,

                        losses:
                            stat.losses,

                        gamesPlayed:
                            stat.games_played
                    };

                }


                return json({

                    success: true,

                    player: {

                        uuid:
                            player.uuid,

                        username:
                            player.username,

                        stats:
                            formatted
                    }

                }, headers);

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

                    }, headers, 400);

                }


                await env.DB
                    .prepare(`
                        INSERT INTO players (
                            uuid,
                            username,
                            updated_at
                        )

                        VALUES (
                            ?,
                            ?,
                            CURRENT_TIMESTAMP
                        )

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


                for (
                    const mode
                    of MODES
                ) {

                    await env.DB
                        .prepare(`
                            INSERT OR IGNORE
                            INTO player_stats (

                                uuid,
                                mode,
                                elo

                            )

                            VALUES (
                                ?,
                                ?,
                                1000
                            )
                        `)
                        .bind(
                            uuid,
                            mode
                        )
                        .run();

                }


                return json({

                    success: true,

                    message:
                        "Player synced"

                }, headers);

            }


            /*
            =========================
            MATCH RESULT
            =========================
            */

            if (
                method === "POST" &&
                path === "/match/result"
            ) {

                const body =
                    await request.json();


                const winnerUuid =
                    body.winnerUuid;


                const loserUuid =
                    body.loserUuid;


                const mode =
                    body.mode
                        ?.toLowerCase();


                if (

                    !winnerUuid ||

                    !loserUuid ||

                    !mode

                ) {

                    return json({

                        success: false,

                        error:
                            "Missing match data"

                    }, headers, 400);

                }


                if (
                    !MODES.includes(mode)
                ) {

                    return json({

                        success: false,

                        error:
                            "Invalid gamemode"

                    }, headers, 400);

                }


                const winner =
                    await getStats(
                        env.DB,
                        winnerUuid,
                        mode
                    );


                const loser =
                    await getStats(
                        env.DB,
                        loserUuid,
                        mode
                    );


                if (
                    !winner ||
                    !loser
                ) {

                    return json({

                        success: false,

                        error:
                            "Player stats not found"

                    }, headers, 404);

                }


                const eloResult =
                    calculateElo(

                        winner.elo,

                        loser.elo

                    );


                const newWinnerElo =
                    eloResult.winner;


                const newLoserElo =
                    eloResult.loser;


                await env.DB
                    .batch([


                        env.DB
                            .prepare(`
                                UPDATE player_stats

                                SET

                                    elo = ?,

                                    wins = wins + 1,

                                    games_played =
                                        games_played + 1

                                WHERE

                                    uuid = ?

                                    AND mode = ?
                            `)
                            .bind(

                                newWinnerElo,

                                winnerUuid,

                                mode

                            ),


                        env.DB
                            .prepare(`
                                UPDATE player_stats

                                SET

                                    elo = ?,

                                    losses = losses + 1,

                                    games_played =
                                        games_played + 1

                                WHERE

                                    uuid = ?

                                    AND mode = ?
                            `)
                            .bind(

                                newLoserElo,

                                loserUuid,

                                mode

                            )

                    ]);


                return json({

                    success: true,

                    mode,


                    winner: {

                        uuid:
                            winnerUuid,

                        oldElo:
                            winner.elo,

                        newElo:
                            newWinnerElo,

                        tier:
                            getTierFromElo(
                                newWinnerElo
                            )

                    },


                    loser: {

                        uuid:
                            loserUuid,

                        oldElo:
                            loser.elo,

                        newElo:
                            newLoserElo,

                        tier:
                            getTierFromElo(
                                newLoserElo
                            )

                    }

                }, headers);

            }


            /*
            =========================
            404
            =========================
            */

            return json({

                success: false,

                error:
                    "Endpoint not found"

            }, headers, 404);


        } catch (error) {


            console.error(error);


            return json({

                success: false,

                error:
                    error.message

            }, headers, 500);

        }

    }

};


/*
=========================
JSON RESPONSE
=========================
*/

function json(
    data,
    headers,
    status = 200
) {

    return new Response(

        JSON.stringify(
            data,
            null,
            2
        ),

        {

            status,

            headers

        }

    );

}


/*
=========================
GET MODE LEADERBOARD
=========================
*/

async function getModeLeaderboard(
    db,
    mode
) {

    const result =
        await db
            .prepare(`

                SELECT

                    players.uuid,

                    players.username,

                    player_stats.elo,

                    player_stats.wins,

                    player_stats.losses,

                    player_stats.games_played

                FROM player_stats

                INNER JOIN players

                    ON players.uuid =
                        player_stats.uuid

                WHERE
                    player_stats.mode = ?

                ORDER BY
                    player_stats.elo DESC

                LIMIT 100

            `)

            .bind(mode)

            .all();


    return result.results.map(
        player => ({

            username:
                player.username,

            uuid:
                player.uuid,

            elo:
                player.elo,

            tier:
                getTierFromElo(
                    player.elo
                ),

            wins:
                player.wins,

            losses:
                player.losses,

            gamesPlayed:
                player.games_played

        })
    );

}


/*
=========================
OVERALL LEADERBOARD
=========================
*/

async function getOverallLeaderboard(
    db
) {

    const result =
        await db
            .prepare(`

                SELECT

                    players.uuid,

                    players.username,

                    SUM(
                        player_stats.elo
                    ) AS total_elo

                FROM players

                INNER JOIN player_stats

                    ON players.uuid =
                        player_stats.uuid

                GROUP BY
                    players.uuid

                ORDER BY
                    total_elo DESC

                LIMIT 100

            `)

            .all();


    return result.results.map(
        player => ({

            username:
                player.username,

            uuid:
                player.uuid,

            elo:
                player.total_elo

        })
    );

}


/*
=========================
GET PLAYER STATS
=========================
*/

async function getStats(
    db,
    uuid,
    mode
) {

    return await db
        .prepare(`

            SELECT

                elo,
                wins,
                losses,
                games_played

            FROM player_stats

            WHERE

                uuid = ?

                AND mode = ?

        `)

        .bind(
            uuid,
            mode
        )

        .first();

}


/*
=========================
ELO CALCULATION
=========================
*/

function calculateElo(
    winnerElo,
    loserElo
) {

    const K = 32;


    const winnerExpected =
        1 /

        (
            1 +

            Math.pow(

                10,

                (
                    loserElo -
                    winnerElo
                ) / 400

            )
        );


    const loserExpected =
        1 /

        (
            1 +

            Math.pow(

                10,

                (
                    winnerElo -
                    loserElo
                ) / 400

            )
        );


    const newWinner =
        Math.round(

            winnerElo +

            K *

            (
                1 -
                winnerExpected
            )

        );


    const newLoser =
        Math.round(

            loserElo +

            K *

            (
                0 -
                loserExpected
            )

        );


    return {

        winner:
            Math.max(
                0,
                newWinner
            ),

        loser:
            Math.max(
                0,
                newLoser
            )

    };

}


/*
=========================
TIER SYSTEM
=========================
*/

function getTierFromElo(
    elo
) {

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
