const { getPool, sql } = require('../shared/db');

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
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
        const wellName = context.bindingData.wellName;

        if (req.method === 'GET') {
            // GET all unique wells from production_data
            const result = await pool.request().query(`
                SELECT DISTINCT well as name
                FROM production_data
                WHERE well IS NOT NULL AND well != ''
                ORDER BY well
            `);
            context.res = {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: result.recordset
            };
        }
        else if (req.method === 'DELETE') {
            // Delete well from production_data
            if (!wellName) {
                context.res = {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: { error: 'Well name is required' }
                };
                return;
            }

            const result = await pool.request()
                .input('wellName', sql.NVarChar, decodeURIComponent(wellName))
                .query('DELETE FROM production_data WHERE well = @wellName');

            if (result.rowsAffected[0] === 0) {
                context.res = {
                    status: 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: { error: 'Well not found' }
                };
                return;
            }

            context.res = {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: { success: true, message: 'Well deleted' }
            };
        }
    } catch (error) {
        context.log.error('Database error:', error);
        context.res = {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: { error: 'Internal server error', details: error.message }
        };
    }
};
