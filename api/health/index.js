const { getPool } = require('../shared/db');

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

module.exports = async function (context, req) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers: corsHeaders };
        return;
    }

    try {
        const pool = await getPool();
        // Simple query to verify DB connection
        await pool.request().query('SELECT 1 as test');

        context.res = {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                database: 'connected'
            }
        };
    } catch (error) {
        context.log.error('Health check failed:', error);
        context.res = {
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: {
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: error.message
            }
        };
    }
};
