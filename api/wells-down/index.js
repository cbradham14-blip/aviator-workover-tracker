const { getPool, sql } = require('../shared/db');

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

module.exports = async function (context, req) {
    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers: corsHeaders };
        return;
    }

    try {
        const pool = await getPool();
        const id = context.bindingData.id;

        if (req.method === 'GET') {
            // Get wells that are marked as Down from wells_down table
            const result = await pool.request().query(`
                SELECT
                    wd.id,
                    wd.well,
                    wd.lease,
                    wd.route,
                    wd.def_bopd,
                    wd.dt_hrs,
                    wd.reason,
                    wd.status,
                    wd.date_down,
                    wd.date_up,
                    wd.cost_est_pre_wo,
                    wd.comments,
                    DATEDIFF(day, wd.date_down, ISNULL(wd.date_up, GETDATE())) as days_offline,
                    ROUND(DATEDIFF(day, wd.date_down, ISNULL(wd.date_up, GETDATE())) * wd.def_bopd, 2) as production_down,
                    p.avg_bopd as avg_oil,
                    p.def_bopd as avg_gas,
                    p.dt_hrs as avg_water
                FROM wells_down wd
                LEFT JOIN production_data p ON wd.well = p.well
                WHERE wd.status = 'Down' OR wd.date_up IS NULL
                ORDER BY production_down DESC, days_offline DESC
            `);

            context.res = {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: result.recordset
            };
        }
        else if (req.method === 'POST') {
            // Add or bulk import wells down
            const wells = Array.isArray(req.body) ? req.body : [req.body];

            let inserted = 0;
            for (const well of wells) {
                // Calculate days offline
                const dateDown = well.date_down ? new Date(well.date_down) : new Date();
                const daysOffline = well.days_offline || 0;

                await pool.request()
                    .input('well', sql.NVarChar, well.well)
                    .input('lease', sql.NVarChar, well.lease || null)
                    .input('route', sql.NVarChar, well.route || null)
                    .input('def_bopd', sql.Decimal(10, 2), well.def_bopd || 0)
                    .input('dt_hrs', sql.Int, well.dt_hrs || 0)
                    .input('reason', sql.NVarChar, well.reason || null)
                    .input('status', sql.NVarChar, well.status || 'Down')
                    .input('date_down', sql.DateTime, dateDown)
                    .input('date_up', sql.DateTime, well.date_up ? new Date(well.date_up) : null)
                    .input('cost_est_pre_wo', sql.Decimal(10, 2), well.cost_est_pre_wo || null)
                    .input('comments', sql.NVarChar, well.comments || null)
                    .query(`
                        MERGE wells_down AS target
                        USING (VALUES (@well)) AS source (well)
                        ON target.well = source.well AND target.status = 'Down'
                        WHEN MATCHED THEN
                            UPDATE SET
                                lease = @lease,
                                route = @route,
                                def_bopd = @def_bopd,
                                dt_hrs = @dt_hrs,
                                reason = @reason,
                                status = @status,
                                date_down = @date_down,
                                date_up = @date_up,
                                cost_est_pre_wo = @cost_est_pre_wo,
                                comments = @comments
                        WHEN NOT MATCHED THEN
                            INSERT (well, lease, route, def_bopd, dt_hrs, reason, status, date_down, date_up, cost_est_pre_wo, comments)
                            VALUES (@well, @lease, @route, @def_bopd, @dt_hrs, @reason, @status, @date_down, @date_up, @cost_est_pre_wo, @comments);
                    `);
                inserted++;
            }

            context.res = {
                status: 201,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: { success: true, inserted: inserted }
            };
        }
        else if (req.method === 'PATCH') {
            // Update well down status (e.g., mark as back online)
            if (!id) {
                context.res = {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: { error: 'Well down ID is required' }
                };
                return;
            }

            const { status, date_up, comments } = req.body;

            let updates = [];
            const request = pool.request().input('id', sql.Int, parseInt(id));

            if (status) {
                updates.push('status = @status');
                request.input('status', sql.NVarChar, status);
            }
            if (date_up) {
                updates.push('date_up = @date_up');
                request.input('date_up', sql.DateTime, new Date(date_up));
            }
            if (comments) {
                updates.push('comments = @comments');
                request.input('comments', sql.NVarChar, comments);
            }

            if (updates.length === 0) {
                context.res = {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: { error: 'No fields to update' }
                };
                return;
            }

            await request.query(`
                UPDATE wells_down
                SET ${updates.join(', ')}
                WHERE id = @id
            `);

            context.res = {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: { success: true }
            };
        }
        else if (req.method === 'DELETE') {
            // Delete well down record
            if (!id) {
                context.res = {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: { error: 'Well down ID is required' }
                };
                return;
            }

            await pool.request()
                .input('id', sql.Int, parseInt(id))
                .query('DELETE FROM wells_down WHERE id = @id');

            context.res = {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: { success: true, message: 'Well down record deleted' }
            };
        }
    } catch (error) {
        context.log.error('Wells down endpoint error:', error);
        context.res = {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: { error: 'Internal server error', details: error.message }
        };
    }
};
