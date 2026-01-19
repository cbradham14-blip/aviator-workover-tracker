const { getPool, sql } = require('../shared/db');

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

        if (req.method === 'POST') {
            // Handle bulk insert
            const wells = req.body;

            if (!Array.isArray(wells)) {
                context.res = {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: { error: 'Request body must be an array of wells' }
                };
                return;
            }

            let inserted = 0;
            for (const well of wells) {
                await pool.request()
                    .input('well', sql.NVarChar, well.name)
                    .input('avg_bopd', sql.Decimal(10, 2), well.avg_bopd || 0)
                    .input('def_bopd', sql.Decimal(10, 2), well.def_bopd || 0)
                    .input('dt_hrs', sql.Decimal(10, 2), well.dt_hrs || 0)
                    .input('status', sql.NVarChar, well.status || 'Active')
                    .input('reason_down', sql.NVarChar, well.reason_down || null)
                    .query(`
                        MERGE production_data AS target
                        USING (VALUES (@well)) AS source (well)
                        ON target.well = source.well
                        WHEN MATCHED THEN
                            UPDATE SET
                                avg_bopd = @avg_bopd,
                                def_bopd = @def_bopd,
                                dt_hrs = @dt_hrs,
                                status = @status,
                                reason_down = @reason_down,
                                data_date = GETDATE()
                        WHEN NOT MATCHED THEN
                            INSERT (well, avg_bopd, def_bopd, dt_hrs, status, reason_down, data_date)
                            VALUES (@well, @avg_bopd, @def_bopd, @dt_hrs, @status, @reason_down, GETDATE());
                    `);
                inserted++;
            }

            context.res = {
                status: 201,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: { success: true, inserted: inserted }
            };
            return;
        }

        // GET request - existing code
        const days = parseInt(req.query.days) || 30;

        const result = await pool.request()
            .input('days', sql.Int, days)
            .query(`
                SELECT
                    id,
                    well,
                    well as well_name,
                    avg_bopd as oil,
                    def_bopd as gas,
                    dt_hrs as water,
                    status,
                    reason_down,
                    data_date as date
                FROM production_data
                WHERE data_date >= DATEADD(day, -@days, GETDATE())
                ORDER BY data_date DESC, well
            `);

        context.res = {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: result.recordset
        };
    } catch (error) {
        context.log.error('Database error:', error);
        context.res = {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: { error: 'Internal server error', details: error.message }
        };
    }
};
