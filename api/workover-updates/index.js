const { getPool, sql } = require('../shared/db');

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

module.exports = async function (context, req) {
    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers: corsHeaders };
        return;
    }

    try {
        const pool = await getPool();
        const workover_id = context.bindingData.workover_id;

        if (req.method === 'GET') {
            if (workover_id) {
                // Get updates for specific workover
                const result = await pool.request()
                    .input('workover_id', sql.Int, parseInt(workover_id))
                    .query(`
                        SELECT
                            id,
                            workover_id,
                            update_date,
                            daily_cost,
                            notes,
                            created_by,
                            created_at
                        FROM workover_updates
                        WHERE workover_id = @workover_id
                        ORDER BY update_date DESC
                    `);

                // Also get the total cost
                const totalResult = await pool.request()
                    .input('workover_id', sql.Int, parseInt(workover_id))
                    .query(`
                        SELECT ISNULL(SUM(daily_cost), 0) as total_cost
                        FROM workover_updates
                        WHERE workover_id = @workover_id
                    `);

                context.res = {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: {
                        updates: result.recordset,
                        total_cost: totalResult.recordset[0].total_cost
                    }
                };
            } else {
                // Get all updates with workover info
                const result = await pool.request().query(`
                    SELECT
                        wu.id,
                        wu.workover_id,
                        wu.update_date,
                        wu.daily_cost,
                        wu.notes,
                        wu.created_by,
                        wu.created_at,
                        w.well,
                        w.rig
                    FROM workover_updates wu
                    JOIN workovers w ON wu.workover_id = w.id
                    ORDER BY wu.update_date DESC
                `);

                context.res = {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: result.recordset
                };
            }
        }
        else if (req.method === 'POST') {
            const { workover_id: body_workover_id, daily_cost, notes, created_by, update_date } = req.body;
            const woId = workover_id || body_workover_id;

            if (!woId) {
                context.res = {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: { error: 'workover_id is required' }
                };
                return;
            }

            const updateDate = update_date ? new Date(update_date) : new Date();

            const insertResult = await pool.request()
                .input('workover_id', sql.Int, parseInt(woId))
                .input('update_date', sql.Date, updateDate)
                .input('daily_cost', sql.Decimal(10, 2), daily_cost || 0)
                .input('notes', sql.NVarChar, notes || null)
                .input('created_by', sql.NVarChar, created_by || null)
                .query(`
                    INSERT INTO workover_updates (workover_id, update_date, daily_cost, notes, created_by)
                    VALUES (@workover_id, @update_date, @daily_cost, @notes, @created_by);
                    SELECT SCOPE_IDENTITY() AS newId;
                `);

            const newId = insertResult.recordset[0].newId;

            // Update the workover's final_cost with total
            await pool.request()
                .input('workover_id', sql.Int, parseInt(woId))
                .query(`
                    UPDATE workovers
                    SET final_cost = (
                        SELECT ISNULL(SUM(daily_cost), 0)
                        FROM workover_updates
                        WHERE workover_id = @workover_id
                    )
                    WHERE id = @workover_id
                `);

            // Get the total cost
            const totalResult = await pool.request()
                .input('workover_id', sql.Int, parseInt(woId))
                .query(`
                    SELECT ISNULL(SUM(daily_cost), 0) as total_cost
                    FROM workover_updates
                    WHERE workover_id = @workover_id
                `);

            context.res = {
                status: 201,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: {
                    id: newId,
                    workover_id: parseInt(woId),
                    daily_cost: daily_cost || 0,
                    notes: notes,
                    update_date: updateDate,
                    total_cost: totalResult.recordset[0].total_cost
                }
            };
        }
        else if (req.method === 'DELETE') {
            const { update_id } = req.query;

            if (!update_id) {
                context.res = {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: { error: 'update_id query parameter is required' }
                };
                return;
            }

            // Get the workover_id before deleting
            const getResult = await pool.request()
                .input('id', sql.Int, parseInt(update_id))
                .query('SELECT workover_id FROM workover_updates WHERE id = @id');

            if (getResult.recordset.length === 0) {
                context.res = {
                    status: 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: { error: 'Update not found' }
                };
                return;
            }

            const woId = getResult.recordset[0].workover_id;

            await pool.request()
                .input('id', sql.Int, parseInt(update_id))
                .query('DELETE FROM workover_updates WHERE id = @id');

            // Update the workover's final_cost
            await pool.request()
                .input('workover_id', sql.Int, woId)
                .query(`
                    UPDATE workovers
                    SET final_cost = (
                        SELECT ISNULL(SUM(daily_cost), 0)
                        FROM workover_updates
                        WHERE workover_id = @workover_id
                    )
                    WHERE id = @workover_id
                `);

            context.res = {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: { success: true, message: 'Update deleted' }
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
