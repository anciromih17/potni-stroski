const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/potni_stroski';

const pool = new Pool({ connectionString });

async function waitForDb({ retries = 20, delay = 2000 } = {}) {
    for (let i = 0; i < retries; i++) {
        try {
            await pool.query('SELECT 1');
            console.log('Postgres is available');
            return;
        } catch (err) {
            const attempt = i + 1;
            console.log(`Postgres not ready yet (attempt ${attempt}/${retries}). Retrying in ${delay}ms...`);
            await new Promise((res) => setTimeout(res, delay));
        }
    }
    throw new Error(`Postgres not available after ${retries} attempts`);
}

async function init() {
    await waitForDb();

    await pool.query(`
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL,
      folder TEXT,
      total_value NUMERIC(12,2),
      total_km NUMERIC(12,2),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      pdf bytea NOT NULL
    );
  `);
}

module.exports = { pool, init };