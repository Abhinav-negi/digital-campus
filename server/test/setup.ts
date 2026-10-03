// Loaded with `--import` before any test file (and so before src/lib/db.ts builds its client):
// every test process talks to TEST_DATABASE_URL, never the dev DB.
const url = process.env.TEST_DATABASE_URL;
if (!url || url === process.env.DATABASE_URL) throw new Error('Set TEST_DATABASE_URL to a separate database (see .env.example)');
process.env.DATABASE_URL = url;
process.env.NODE_ENV = 'test';
