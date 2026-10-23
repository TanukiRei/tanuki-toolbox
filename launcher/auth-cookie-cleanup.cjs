'use strict';
// One-shot, pre-Electron maintenance. Never imported by the running host.
// Browser/account cookies and credential stores are outside this operation.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const KEEP_PER_HOST = 8;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
const AUTH_NAME = /^dsh-auth-[A-Za-z0-9_-]{43}$/;
const CHROME_EPOCH_US = 11644473600000000n;

function atomicJSON(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.lstatSync(path.dirname(file)).isSymbolicLink()) throw Error('UNSAFE_BACKUP_DIRECTORY');
  const temporary = file + '.' + randomUUID() + '.tmp';
  try {
    fs.writeFileSync(temporary, JSON.stringify(value, (_, item) =>
      typeof item === 'bigint' ? item.toString() :
      ArrayBuffer.isView(item) ? { encoding: 'base64', data: Buffer.from(item.buffer, item.byteOffset, item.byteLength).toString('base64') } : item,
    2), { flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, file);
  } finally {
    try { fs.unlinkSync(temporary); } catch {}
  }
}

function cleanAuthCookies({ profile, running = false, dryRun = false, args = [], env = process.env }) {
  if (process.platform !== 'win32') return { status: 'unsupported', removed: 0 };
  if (running || dryRun) return { status: 'skipped', reason: running ? 'app-running' : 'dry-run', removed: 0 };
  // A custom Electron profile cannot safely be inferred from DSH_HOME.
  if (args.some(arg => /^--user-data-dir(?:=|$)/i.test(arg))) {
    return { status: 'skipped', reason: 'custom-user-data', removed: 0 };
  }
  const directory = path.join(env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), '@deepseek-ai', 'dsh-desktop', 'Network');
  const file = path.join(directory, 'Cookies');
  const reportFile = path.join(profile, '.tanuki-toolbox', 'auth-cookie-cleanup.json');
  const backupFile = path.join(profile, '.tanuki-toolbox', 'backups', 'local-auth-cookies.json');
  let database, transaction = false;
  const finish = value => {
    const result = { ...value, at: new Date().toISOString() };
    try { atomicJSON(reportFile, result); } catch {}
    return result;
  };
  try {
    let stat;
    try { stat = fs.lstatSync(file); } catch (error) {
      if (error.code === 'ENOENT') return finish({ status: 'absent', removed: 0 });
      throw error;
    }
    if (!stat.isFile() || stat.isSymbolicLink() || fs.lstatSync(directory).isSymbolicLink() || stat.size > 32 * 1024 * 1024) {
      return finish({ status: 'skipped', reason: 'unsupported-database', removed: 0 });
    }
    const { DatabaseSync } = require('node:sqlite');
    database = new DatabaseSync(file);
    database.exec('PRAGMA busy_timeout=1000');
    // No schema changes, VACUUM, journal-mode changes or broad cache deletion.
    database.exec('BEGIN IMMEDIATE');
    transaction = true;
    const columns = new Set(database.prepare('PRAGMA table_info(cookies)').all().map(column => column.name));
    for (const column of ['host_key', 'name', 'path', 'is_httponly', 'creation_utc', 'last_access_utc']) {
      if (!columns.has(column)) throw Error('UNSUPPORTED_COOKIE_SCHEMA');
    }
    const query = database.prepare("SELECT rowid AS cleanupRowId, * FROM cookies WHERE host_key IN ('127.0.0.1', 'localhost', '[::1]', '::1') AND name GLOB 'dsh-auth-*' AND path='/' AND is_httponly=1 ORDER BY last_access_utc DESC, creation_utc DESC, rowid DESC LIMIT 4097");
    query.setReadBigInts(true);
    const rows = query.all();
    if (rows.length > 4096) throw Error('COOKIE_LIMIT_EXCEEDED');
    const now = BigInt(Date.now()) * 1000n + CHROME_EPOCH_US;
    const counts = new Map(), removed = [];
    for (const row of rows) {
      if (!LOOPBACK_HOSTS.has(row.host_key) || !AUTH_NAME.test(row.name)) continue;
      const expired = row.has_expires === 1n && typeof row.expires_utc === 'bigint' && row.expires_utc > 0n && row.expires_utc <= now;
      const retained = counts.get(row.host_key) || 0;
      if (expired || retained >= KEEP_PER_HOST) removed.push(row);
      else counts.set(row.host_key, retained + 1);
    }
    if (!removed.length) {
      database.exec('ROLLBACK'); transaction = false;
      return finish({ status: 'unchanged', removed: 0, retained: [...counts.values()].reduce((n, value) => n + value, 0) });
    }
    // Save only rows to be removed, never unrelated website/account cookies.
    // One rotating backup prevents the maintenance itself accumulating history.
    atomicJSON(backupFile, { schema: 1, at: new Date().toISOString(), database: file, rows: removed.map(({ cleanupRowId, ...row }) => row) });
    const remove = database.prepare("DELETE FROM cookies WHERE rowid=? AND host_key=? AND name=? AND path='/' AND is_httponly=1");
    let changed = 0;
    for (const row of removed) changed += Number(remove.run(row.cleanupRowId, row.host_key, row.name).changes);
    if (changed !== removed.length) throw Error('COOKIE_DATABASE_CHANGED');
    database.exec('COMMIT'); transaction = false;
    return finish({ status: 'cleaned', removed: changed, retained: [...counts.values()].reduce((n, value) => n + value, 0), backup: backupFile });
  } catch (error) {
    if (transaction) { try { database.exec('ROLLBACK'); } catch {} transaction = false; }
    // A busy/unsupported store must never prevent the application from starting.
    return finish({ status: 'skipped', reason: 'database-unavailable', code: typeof error.code === 'string' ? error.code : 'CLEANUP_UNAVAILABLE', removed: 0 });
  } finally {
    if (database) { try { database.close(); } catch {} }
  }
}
module.exports = { cleanAuthCookies };
