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


/*
====================================
SAMPLE PLAYERS
====================================

Ovo je privremena baza podataka.

Kasnije ćemo ovo zameniti pravom
Cloudflare D1 bazom.
*/


const PLAYERS = {


    "00000000-0000-0000-0000-000000000001": {

        username:
            "StrahinjaPile",

        uuid:
            "00000000-0000-0000-0000-000000000001",

        sword: {
            elo: 1900
        },

        axe: {
            elo: 1650
        },

        mace: {
            elo: 1500
        },

        pot: {
            elo: 1200
        },

        uhc: {
            elo: 1800
        },

        vanilla: {
            elo: 1300
        },

        smp: {
            elo: 1100
        },

        nethop: {
            elo: 1000
        }

    },


    "00000000-0000-0000-0000-000000000002": {

        username:
            "Player2",

        uuid:
            "00000000-0000-0000-0000-000000000002",

        sword: {
            elo: 1800
        },

        axe: {
            elo: 1500
        },

        mace: {
            elo: 1300
        },

        pot: {
            elo: 1000
        },

        uhc: {
            elo: 1650
        },

        vanilla: {
            elo: 1200
        },

        smp: {
            elo: 1000
        },

        nethop: {
            elo: 0
        }

    },


    "00000000-0000-0000-0000-000000000003": {

        username:
            "Player3",

        uuid:
            "00000000-0000-0000-0000-000000000003",

        sword: {
            elo: 1650
        },

        axe: {
            elo: 1800
        },

        mace: {
            elo: 1400
        },

        pot: {
            elo: 1500
        },

        uhc: {
            elo: 1200
        },

        vanilla: {
            elo: 1000
        },

        smp: {
            elo: 1300
        },

        nethop: {
            elo: 1100
        }

    },


    "00000000-0000-0000-0000-000000000004": {

        username:
            "Player4",

        uuid:
            "00000000-0000-0000-0000-000000000004",

        sword: {
            elo: 1500
        },

        axe: {
            elo: 1200
        },

        mace: {
            elo: 1650
        },

        pot: {
            elo: 1300
        },

        uhc: {
            elo: 1100
        },

        vanilla: {
            elo: 1800
        },

        smp: {
            elo: 1500
        },

        nethop: {
            elo: 1200
        }

    }

};


/*
====================================
GET MODE LEADERBOARD
====================================
*/


function getModeLeaderboard(mode) {


    const players =
        Object.values(PLAYERS)


            .map(
                player => {


                    const stats =
                        player[mode]
                        ||
                        { elo: 0 };


                    const elo =
                        Number(
                            stats.elo
                        )
                        ||
                        0;


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
            )


            .sort(
                (a, b) =>
                    b.elo - a.elo
            );


    return players;


}


/*
====================================
GET OVERALL LEADERBOARD
====================================

Overall ELO =
prosek svih gamemode ELO-a.

Kasnije možemo promeniti formulu.
*/


function getOverallLeaderboard() {


    const players =
        Object.values(PLAYERS)


            .map(
                player => {


                    let totalElo =
                        0;


                    let playedModes =
                        0;


                    for (
                        const mode
                        of MODES
                    ) {


                        const stats =
                            player[mode];


                        if (
                            stats
                        ) {


                            const elo =
                                Number(
                                    stats.elo
                                )
                                ||
                                0;


                            /*
                            Ne računamo 0 ELO
                            kao odigrani mode.
                            */


                            if (
                                elo > 0
                            ) {


                                totalElo +=
                                    elo;


                                playedModes++;


                            }


                        }


                    }


                    let overallElo =
                        0;


                    if (
                        playedModes > 0
                    ) {


                        overallElo =

                            Math.round(

                                totalElo /

                                playedModes

                            );


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
                            overallElo

                    };


                }
            )


            .sort(
                (a, b) =>
                    b.elo - a.elo
            );


    return players;


}


/*
====================================
MAIN WORKER
====================================
*/


export default {


    async fetch(
        request,
        env,
        ctx
    ) {


        /*
        =========================
        OPTIONS / CORS
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

            method === "GET"

            &&

            path === "/health"

        ) {


            return json({

                success:
                    true,

                message:
                    "SpicyTiers API is online",

                version:
                    "1.0.0"

            });


        }


        /*
        =========================
        OVERALL LEADERBOARD
        =========================
        */


        if (

            method === "GET"

            &&

            path === "/leaderboard"

        ) {


            const players =
                getOverallLeaderboard();


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

            method === "GET"

            &&

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

                !MODES.includes(
                    mode
                )

            ) {


                return json(

                    {

                        success:
                            false,

                        error:
                            "Invalid gamemode",

                        mode:
                            mode

                    },

                    400

                );


            }


            const players =
                getModeLeaderboard(
                    mode
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

            method === "POST"

            &&

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

                    !uuid

                    ||

                    !username

                ) {


                    return json(

                        {

                            success:
                                false,

                            error:
                                "UUID and username are required"

                        },

                        400

                    );


                }


                /*
                CREATE PLAYER
                */


                if (

                    !PLAYERS[uuid]

                ) {


                    PLAYERS[uuid] = {


                        username:
                            username,


                        uuid:
                            uuid,


                        sword:
                            { elo: 0 },


                        axe:
                            { elo: 0 },


                        mace:
                            { elo: 0 },


                        pot:
                            { elo: 0 },


                        uhc:
                            { elo: 0 },


                        vanilla:
                            { elo: 0 },


                        smp:
                            { elo: 0 },


                        nethop:
                            { elo: 0 }


                    };


                }


                /*
                UPDATE USERNAME
                */


                PLAYERS[uuid].username =
                    username;


                return json({

                    success:
                        true,

                    message:
                        "Player synced",

                    player:
                        PLAYERS[uuid]

                });


            }


            catch (
                error
            ) {


                return json(

                    {

                        success:
                            false,

                        error:
                            "Invalid request body"

                    },

                    400

                );


            }


        }


        /*
        =========================
        GET PLAYER
        =========================
        */


        if (

            method === "GET"

            &&

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
                PLAYERS[uuid];


            if (
                !player
            ) {


                return json(

                    {

                        success:
                            false,

                        error:
                            "Player not found"

                    },

                    404

                );


            }


            /*
            CREATE RESPONSE
            */


            const modes =

                {};


            for (

                const mode

                of MODES

            ) {


                const elo =

                    Number(

                        player[mode]?.elo

                    )

                    ||

                    0;


                modes[mode] = {


                    elo:
                        elo,


                    tier:

                        getTierFromElo(
                            elo
                        )

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

                    modes:
                        modes

                }

            });


        }


        /*
        =========================
        ENDPOINT NOT FOUND
        =========================
        */


        return json(

            {

                success:
                    false,

                error:
                    "Endpoint not found",

                path:
                    path

            },

            404

        );


    }


};
