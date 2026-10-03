// Local Postgres 17 without Docker or sudo (D14). Runs in the foreground; Ctrl-C stops it.
// User, password, port and DB names match .env.example, so DATABASE_URL needs no change.
import { existsSync } from 'node:fs';
import EmbeddedPostgres from 'embedded-postgres';

const dir = new URL('../.data/pg', import.meta.url).pathname;
const pg = new EmbeddedPostgres({
  databaseDir: dir, user: 'campus', password: 'campus', port: 5432, persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: () => {},
});

const fresh = !existsSync(dir);
if (fresh) await pg.initialise();
await pg.start();
if (fresh) for (const name of ['campus', 'campus_test']) await pg.createDatabase(name);
console.log('postgres:5432 ready (campus, campus_test) · data in .data/pg · Ctrl-C to stop');

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => pg.stop().then(() => process.exit(0)));
