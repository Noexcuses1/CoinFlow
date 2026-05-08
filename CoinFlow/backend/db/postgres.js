import pkg from 'pg';
const { Pool } = pkg;

let pool = null;

// Only try to connect if DATABASE_URL is set
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
}

export async function query(text, params) {
  if (!pool) {
    console.warn('No database configured – skipping query:', text);
    return { rows: [], rowCount: 0 };
  }
  try {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error.message);
    return { rows: [], rowCount: 0 };
  }
}

export async function initializeDatabase() {
  if (!pool) {
    console.log('🟡 No DATABASE_URL set – skipping database initialisation.');
    return;
  }
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        token VARCHAR(20) NOT NULL,
        type VARCHAR(10) NOT NULL CHECK (type IN ('buy', 'sell')),
        wallet VARCHAR(60) NOT NULL,
        value_usd NUMERIC(16,2) NOT NULL,
        tx_hash VARCHAR(88) UNIQUE,
        chain VARCHAR(20) DEFAULT 'solana',
        profit_percent NUMERIC(6,2),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at DESC);
    `);
    console.log('✅ Database initialised');
  } catch (err) {
    console.error('❌ Database initialisation failed:', err.message);
  }
}