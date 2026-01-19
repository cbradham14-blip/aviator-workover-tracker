const { getPool, sql } = require('../shared/db');

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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
            // GET all rigs
            const result = await pool.request().query(`
                SELECT id, name, contractor, day_rate as dayRate, status, current_well as currentWell
                FROM rigs
                ORDER BY name
            `);
            context.res = {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: result.recordset
            };
        }
        else if (req.method === 'POST') {
            // Create new rig
            const { name, contractor, dayRate } = req.body;

            if (!name || !contractor || dayRate === undefined) {
                context.res = {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: { error: 'Missing required fields: name, contractor, dayRate' }
                };
                return;
            }

            const result = await pool.request()
                .input('name', sql.NVarChar, name)
                .input('contractor', sql.NVarChar, contractor)
                .input('dayRate', sql.Decimal(10, 2), dayRate)
                .input('status', sql.NVarChar, 'Available')
                .query(`
                    INSERT INTO rigs (name, contractor, day_rate, status)
                    OUTPUT INSERTED.id, INSERTED.name, INSERTED.contractor,
                           INSERTED.day_rate as dayRate, INSERTED.status, INSERTED.current_well as currentWell
                    VALUES (@name, @contractor, @dayRate, @status)
                `);

            context.res = {
                status: 201,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: result.recordset[0]
            };
        }
        else if (req.method === 'DELETE') {
            // Delete rig
            if (!id) {
                context.res = {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: { error: 'Rig ID is required' }
                };
                return;
            }

            const result = await pool.request()
                .input('id', sql.Int, parseInt(id))
                .query('DELETE FROM rigs WHERE id = @id');

            if (result.rowsAffected[0] === 0) {
                context.res = {
                    status: 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: { error: 'Rig not found' }
                };
                return;
            }

            context.res = {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: { success: true, message: 'Rig deleted' }
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
