import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function init() {
    try {
        console.log('--- Iniciando inicialización de Base de Datos ---');
        const schema = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');
        await pool.query(schema);
        console.log('✅ Esquema ejecutado correctamente.');
    } catch (err) {
        console.error('❌ Error inicializando BD:', err);
    } finally {
        await pool.end();
    }
}

init();
