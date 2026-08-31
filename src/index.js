const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json",
            ...corsHeaders
        }
    });
}

export default {
    async fetch(request, env) {

        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: corsHeaders
            });
        }

        const url = new URL(request.url);

        /*
        ========================================
        GET /api/health
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
        GET /api/player/:username
        ========================================
        */

        if (
            url.pathname.startsWith("/api/player/") &&
            request.method === "GET"
        ) {

            const username =
                decodeURIComponent(
                    url.pathname.split("/").pop()
                );

            if (!username) {
                return json({
                    success: false,
                    error: "Missing username"
                }, 400);
            }

            /*
             * ZA SADA TEST DATA.
             *
             * Kasnije ovde povezujemo
             * pravu bazu.
             */

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
        POST /api/player
        ========================================
        */

        if (
            url.pathname === "/api/player" &&
            request.method === "POST"
        ) {

            try {

                const body =
                    await request.json();

                if (!body.username) {
                    return json({
                        success: false,
                        error: "Username is required"
                    }, 400);
                }

                /*
                 * Kasnije ovde upisujemo
                 * playera u bazu.
                 */

                return json({
                    success: true,

                    message: "Player received",

                    player: body
                });

            } catch {

                return json({
                    success: false,
                    error: "Invalid JSON"
                }, 400);
            }
        }


        /*
        ========================================
        404
        ========================================
        */

        return json({
            success: false,
            error: "Endpoint not found"
        }, 404);
    }
};
