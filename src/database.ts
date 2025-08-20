import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import exitHook from 'exit-hook';

const db = new Database('./database/database.db');
db.loadExtension(
    process.platform === 'win32'
        ? './database/sqlite_zstd.dll'
        : './database/libsqlite_zstd.so',
);
db.exec('PRAGMA journal_mode = WAL');
exitHook(() => {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    db.exec('VACUUM');
});

export default drizzle(db);
