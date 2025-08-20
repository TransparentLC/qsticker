import Database from 'better-sqlite3';

const db = new Database('./database/database.db');
db.loadExtension(
    process.platform === 'win32'
        ? './database/sqlite_zstd.dll'
        : './database/libsqlite_zstd.so',
);
db.exec('PRAGMA journal_mode = WAL');

for (const config of [
    {
        table: 'emoticon',
        column: 'images',
        compression_level: 19,
        dict_chooser: "'[nodict]'",
    },
    {
        table: 'emoticon',
        column: 'metadata',
        compression_level: 19,
        dict_chooser: "'[nodict]'",
    },
] as SQLiteZSTD.TransparentCompressConfig[]) {
    try {
        db.prepare('SELECT zstd_enable_transparent(?)')
            .bind(JSON.stringify(config))
            .run();
    } catch (err) {
        if (
            !(err as Error).message.match(
                /^Column .+? is already enabled for compression\.$/g,
            )
        )
            throw err;
    }
}

try {
    db.prepare('SELECT zstd_incremental_maintenance(?, ?)').bind(null, 1).run();
} catch (err) {
    console.log(err);
}

db.exec('VACUUM');
