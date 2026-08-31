const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data, status = 200) {
    return new Response(JSON.stringify(data, null, 2), {
        status,
        headers: {
            "Content-Type": "application/json",
            ...corsHeaders
        }
    });
}

export default {

    async fetch(request, env) {

        const url = new URL(request.url);

        /*
        ========================================
        CORS
        ========================================
        */

        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: corsHeaders
            });
        }


        /*
        ========================================
        API HEALTH
        ========================================
        */

        if (
            url.pathname === "/api/health" &&
            request.method === "GET"
        ) {

            return json({
                success: true,
                message: "SpicyTiers API is online",
                version: "1.0.0"
            });

        }


        /*
        ========================================
        LEADERBOARD
        ========================================
        */

        if (
            url.pathname.startsWith("/api/leaderboard/") &&
            request.method === "GET"
        ) {

            const mode =
                decodeURIComponent(
                    url.pathname
                        .split("/")
                        .pop()
                );


            const allowedModes = [
                "sword",
                "axe",
                "vanilla",
                "uhc",
                "smp",
                "netheriteop",
                "pot",
                "mace"
            ];


            if (!allowedModes.includes(mode)) {

                return json({
                    success: false,
                    error: "Invalid gamemode"
                }, 400);

            }


            const leaderboard = [

                {
                    username: "StrahinjaPile",
                    uuid: "00000000-0000-0000-0000-000000000001",
                    tier: "HT2",
                    elo: 1900
                },

                {
                    username: "Player2",
                    uuid: "00000000-0000-0000-0000-000000000002",
                    tier: "LT2",
                    elo: 1800
                },

                {
                    username: "Player3",
                    uuid: "00000000-0000-0000-0000-000000000003",
                    tier: "HT3",
                    elo: 1650
                },

                {
                    username: "Player4",
                    uuid: "00000000-0000-0000-0000-000000000004",
                    tier: "LT3",
                    elo: 1500
                }

            ];


            leaderboard.sort(
                (a, b) => b.elo - a.elo
            );


            return json({

                success: true,

                mode: mode,

                players: leaderboard

            });

        }


        /*
        ========================================
        PLAYER
        ========================================
        */

        if (
            url.pathname.startsWith("/api/player/") &&
            request.method === "GET"
        ) {

            const username =
                decodeURIComponent(
                    url.pathname
                        .split("/")
                        .pop()
                );


            if (!username) {

                return json({
                    success: false,
                    error: "Missing username"
                }, 400);

            }


            return json({

                success: true,

                player: {

                    username: username,

                    uuid: null,

                    sword: {
                        elo: 1000,
                        tier: "LT5"
                    },

                    axe: {
                        elo: 1000,
                        tier: "LT5"
                    },

                    vanilla: {
                        elo: 1000,
                        tier: "LT5"
                    },

                    uhc: {
                        elo: 1000,
                        tier: "LT5"
                    },

                    smp: {
                        elo: 1000,
                        tier: "LT5"
                    },

                    netheriteop: {
                        elo: 1000,
                        tier: "LT5"
                    },

                    pot: {
                        elo: 1000,
                        tier: "LT5"
                    },

                    mace: {
                        elo: 1000,
                        tier: "LT5"
                    }

                }

            });

        }


        /*
        ========================================
        UNKNOWN ENDPOINT
        ========================================
        */

        return json({

            success: false,

            error: "Endpoint not found",

            path: url.pathname

        }, 404);

    }

};
