const { getPool, sql } = require('../shared/db');

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

module.exports = async function (context, req) {
    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers: corsHeaders };
        return;
    }

    try {
        const pool = await getPool();

        // Get wells that are marked as Down or haven't produced in last 3 days
        const result = await pool.request().query(`
            WITH RecentProduction AS (
                SELECT
                    well,
                    AVG(avg_bopd) as recent_oil,
                    AVG(def_bopd) as recent_gas,
                    AVG(dt_hrs) as recent_water,
                    MAX(data_date) as last_date,
                    status,
                    reason_down
                FROM production_data
                WHERE data_date >= DATEADD(day, -3, GETDATE())
                GROUP BY well, status, reason_down
            ),
            HistoricalProduction AS (
                SELECT
                    well,
                    AVG(avg_bopd) as hist_oil,
                    AVG(def_bopd) as hist_gas,
                    AVG(dt_hrs) as hist_water
                FROM production_data
                WHERE data_date >= DATEADD(day, -30, GETDATE())
                  AND data_date < DATEADD(day, -3, GETDATE())
                GROUP BY well
            )
            SELECT
                r.well,
                r.status,
                r.reason_down,
                r.last_date,
                DATEDIFF(hour, r.last_date, GETDATE()) as downtime_hours,
                ROUND(ISNULL(h.hist_oil, 0), 2) as avg_oil_bopd,
                ROUND(ISNULL(h.hist_gas, 0), 2) as avg_gas_mcf,
                ROUND(ISNULL(h.hist_water, 0), 2) as avg_water_bbl,
                ROUND((DATEDIFF(hour, r.last_date, GETDATE()) / 24.0) * ISNULL(h.hist_oil, 0), 2) as deferred_oil,
                ROUND((DATEDIFF(hour, r.last_date, GETDATE()) / 24.0) * ISNULL(h.hist_gas, 0), 2) as deferred_gas,
                ROUND((DATEDIFF(hour, r.last_date, GETDATE()) / 24.0) * ISNULL(h.hist_water, 0), 2) as deferred_water
            FROM RecentProduction r
            LEFT JOIN HistoricalProduction h ON r.well = h.well
            WHERE r.status = 'Down'
               OR (ISNULL(r.recent_oil, 0) < ISNULL(h.hist_oil, 0) * 0.1 AND ISNULL(h.hist_oil, 0) > 0)
            ORDER BY deferred_oil DESC, downtime_hours DESC
        `);

        context.res = {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: result.recordset
        };
    } catch (error) {
        context.log.error('Wells down endpoint error:', error);
        context.res = {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: { error: 'Internal server error', details: error.message }
        };
    }
};
