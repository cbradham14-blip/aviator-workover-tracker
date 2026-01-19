const sql = require('mssql');

const config = {
    server: process.env.SQL_SERVER || 'aviator-prodview.database.windows.net',
    database: process.env.SQL_DATABASE || 'Workover-DB',
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    port: 1433,
    options: {
        encrypt: true,
        trustServerCertificate: false,
        enableArithAbort: true,
        connectTimeout: 30000,
        requestTimeout: 30000
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let pool = null;

async function getPool() {
    if (!pool) {
        pool = await sql.connect(config);
    }
    return pool;
}

module.exports = { getPool, sql };
