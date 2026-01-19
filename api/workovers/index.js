const { getPool, sql } = require('../shared/db');

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
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
        const id = context.bindingData.id;

        if (req.method === 'GET') {
            // GET all workovers
            const result = await pool.request().query(`
                SELECT
                    id,
                    wo_number as woNumber,
                    well,
                    well as well_name,
                    rig,
                    reason,
                    type as work_type,
                    est_cost as estCost,
                    final_cost as cost,
                    def_bopd as defBopd,
                    status,
                    start_date,
                    completed_date as end_date,
                    notes,
                    completion_notes,
                    created_by
                FROM workovers
                ORDER BY start_date DESC
            `);
            context.res = {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: result.recordset
            };
        }
        else if (req.method === 'POST') {
            // Create new workover
            // Database columns: well, rig, reason, type, est_cost, def_bopd, status, start_date, completed_date, final_cost, notes, created_by
            // wo_number is computed/auto-generated, so we DON'T insert it
            const { well, rig, reason, type, estCost, defBopd, status, notes, createdBy, startDate, endDate, cost } = req.body;

            if (!well || !rig || !reason) {
                context.res = {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: { error: 'Missing required fields: well, rig, reason' }
                };
                return;
            }

            // Use provided startDate or default to now
            const workoverStartDate = startDate ? new Date(startDate) : new Date();
            const workoverEndDate = endDate ? new Date(endDate) : null;
            const workoverCost = cost || null;

            // Insert and get the new ID using SCOPE_IDENTITY()
            const insertResult = await pool.request()
                .input('well', sql.NVarChar, well)
                .input('rig', sql.NVarChar, rig)
                .input('reason', sql.NVarChar, reason)
                .input('type', sql.NVarChar, type || 'Workover')
                .input('estCost', sql.Decimal(10, 2), estCost || null)
                .input('defBopd', sql.Decimal(10, 2), defBopd || null)
                .input('status', sql.NVarChar, status || 'Active')
                .input('startDate', sql.DateTime, workoverStartDate)
                .input('completedDate', sql.DateTime, workoverEndDate)
                .input('finalCost', sql.Decimal(10, 2), workoverCost)
                .input('notes', sql.NVarChar, notes || null)
                .input('createdBy', sql.NVarChar, createdBy || null)
                .query(`
                    INSERT INTO workovers (well, rig, reason, type, est_cost, def_bopd, status, start_date, completed_date, final_cost, notes, created_by)
                    VALUES (@well, @rig, @reason, @type, @estCost, @defBopd, @status, @startDate, @completedDate, @finalCost, @notes, @createdBy);
                    SELECT SCOPE_IDENTITY() AS newId;
                `);

            const newId = insertResult.recordset[0].newId;

            // Fetch the newly created record
            const selectResult = await pool.request()
                .input('id', sql.Int, newId)
                .query(`
                    SELECT
                        id,
                        wo_number as woNumber,
                        well,
                        well as well_name,
                        rig,
                        reason,
                        type as work_type,
                        est_cost as estCost,
                        status,
                        start_date,
                        notes
                    FROM workovers
                    WHERE id = @id
                `);

            context.res = {
                status: 201,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: selectResult.recordset[0]
            };
        }
        else if (req.method === 'PATCH') {
            // Update workover
            if (!id) {
                context.res = {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: { error: 'Workover ID is required' }
                };
                return;
            }

            const { status, rig, finalCost, cost, completionNotes, notes } = req.body;

            // Build dynamic update query
            let updates = [];
            const request = pool.request().input('id', sql.Int, parseInt(id));

            if (status) {
                updates.push('status = @status');
                request.input('status', sql.NVarChar, status);

                // If completing, set completed_date
                if (status.toLowerCase() === 'completed') {
                    updates.push('completed_date = @completedDate');
                    request.input('completedDate', sql.DateTime, new Date());
                }
            }
            if (rig) {
                updates.push('rig = @rig');
                request.input('rig', sql.NVarChar, rig);
            }
            if (finalCost !== undefined || cost !== undefined) {
                updates.push('final_cost = @finalCost');
                request.input('finalCost', sql.Decimal(10, 2), finalCost || cost);
            }
            if (completionNotes || notes) {
                updates.push('completion_notes = @completionNotes');
                request.input('completionNotes', sql.NVarChar, completionNotes || notes);
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
                UPDATE workovers
                SET ${updates.join(', ')}
                WHERE id = @id
            `);

            // Fetch the updated record
            const selectResult = await pool.request()
                .input('id', sql.Int, parseInt(id))
                .query(`
                    SELECT
                        id,
                        wo_number as woNumber,
                        well,
                        well as well_name,
                        rig,
                        reason,
                        type as work_type,
                        final_cost as cost,
                        status,
                        start_date,
                        completed_date as end_date,
                        completion_notes
                    FROM workovers
                    WHERE id = @id
                `);

            if (selectResult.recordset.length === 0) {
                context.res = {
                    status: 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: { error: 'Workover not found' }
                };
                return;
            }

            context.res = {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: selectResult.recordset[0]
            };
        }
        else if (req.method === 'DELETE') {
            // Delete workover
            if (!id) {
                context.res = {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: { error: 'Workover ID is required' }
                };
                return;
            }

            await pool.request()
                .input('id', sql.Int, parseInt(id))
                .query('DELETE FROM workovers WHERE id = @id');

            context.res = {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: { success: true, message: 'Workover deleted' }
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
