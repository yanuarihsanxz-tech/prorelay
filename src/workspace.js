import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const MAX_FILE_BYTES = 256 * 1024;
export const MAX_PACKET_BYTES = 512 * 1024;
const hidden = new Set(['.git', '.prorelay', 'node_modules', '.ssh', '.aws', '.azure', '.gnupg', '.npmrc', '.pypirc', '.netrc']);
const sensitiveName = /^(?:\.env(?:\..*)?|id_(?:rsa|dsa|ecdsa|ed25519)(?:\.pub)?|credentials(?:\..*)?|secrets?(?:\..*)?|auth(?:\.json)?|token(?:s)?(?:\..*)?)$|\.(?:pem|p12|pfx|key)$/i;
const suspicious = /-----BEGIN (?:[A-Z ]*PRIVATE KEY)-----|(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AIza[A-Za-z0-9_-]{30,}|sk-[A-Za-z0-9_-]{32,})/;

export function hash(text) { return crypto.createHash('sha256').update(text).digest('hex'); }
export function inside(root, candidate) {
  const rel = path.relative(root, candidate);
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel));
}
export function allowedName(rel) {
  return rel.split(/[\\/]/).every(part => !hidden.has(part) && !sensitiveName.test(part) && !/\.prorelay-(?:lock|.*\.tmp)$/.test(part));
}
export function assertShareable(text) {
  if (suspicious.test(text)) throw new Error('Potential credential detected. Remove it before sharing. Contents were not returned.');
  if (text.includes('\0')) throw new Error('Binary files are not supported.');
}
export async function rootPath(root) {
  const actual = await fs.realpath(path.resolve(root));
  if (!(await fs.stat(actual)).isDirectory()) throw new Error('Workspace root must be a directory.');
  return actual;
}
export async function resolveFile(root, relative, { create = false } = {}) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.includes('\0') || relative.includes('\\')) {
    throw new Error('Use a non-empty relative path with forward slashes.');
  }
  const candidate = path.resolve(root, relative);
  if (!inside(root, candidate) || candidate === root) throw new Error('Path escapes the selected workspace.');
  const normalized = path.relative(root, candidate);
  if (!allowedName(normalized)) throw new Error('Path is excluded from the local bridge.');
  // Check each component; following even an in-root symlink could expose a blocked name.
  let current = root;
  const parts = normalized.split(path.sep);
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) throw new Error('Symlink paths are not exposed by the local bridge.');
      if (i < parts.length - 1 && !stat.isDirectory()) throw new Error('Parent path is not a directory.');
    } catch (error) {
      if (error.code === 'ENOENT' && create && i === parts.length - 1) return candidate;
      throw error;
    }
  }
  return candidate;
}
export async function readLocal(root, relative) {
  const file = await resolveFile(root, relative);
  const stat = await fs.stat(file);
  if (!stat.isFile()) throw new Error('Path must be a regular file.');
  if (stat.size > MAX_FILE_BYTES) throw new Error(`File exceeds ${MAX_FILE_BYTES} bytes.`);
  const buffer = await fs.readFile(file);
  if (buffer.length > MAX_FILE_BYTES) throw new Error('File grew beyond the size limit.');
  const content = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  assertShareable(content);
  return { path: path.relative(root, file).split(path.sep).join('/'), content, sha256: hash(content), bytes: buffer.length };
}
export async function listLocal(root, relative = '.', limit = 200) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error('Limit must be 1–1000.');
  const directory = relative === '.' ? root : await resolveFile(root, relative);
  if (!(await fs.stat(directory)).isDirectory()) throw new Error('Path must be a directory.');
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const visible = entries.filter(entry => !entry.isSymbolicLink() && allowedName(path.relative(root, path.join(directory, entry.name))));
  visible.sort((a, b) => a.name.localeCompare(b.name));
  return { entries: visible.slice(0, limit).map(entry => ({ path: path.relative(root, path.join(directory, entry.name)).split(path.sep).join('/'), type: entry.isDirectory() ? 'directory' : 'file' })), truncated: visible.length > limit };
}
export async function writeLocal(root, relative, content, expectedSha256, allowWrite) {
  if (!allowWrite) throw new Error('Write access is disabled. Start the MCP server with --allow-write to opt in.');
  if (typeof content !== 'string' || Buffer.byteLength(content) > MAX_FILE_BYTES) throw new Error('Text is missing or too large.');
  assertShareable(content);
  const file = await resolveFile(root, relative, { create: true });
  let previous = null;
  try { previous = await readLocal(root, relative); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (previous ? expectedSha256 !== previous.sha256 : expectedSha256 !== 'NEW') {
    throw new Error('File changed or overwrite was not acknowledged. Read the current hash; use NEW only for a new file.');
  }
  if (!previous) {
    await fs.writeFile(file, content, { flag: 'wx', mode: 0o600 });
  } else {
    // Exclusive per-file lock makes simultaneous ProRelay writes fail instead of clobbering.
    const lock = `${file}.prorelay-lock`;
    const handle = await fs.open(lock, 'wx', 0o600);
    try {
      const fresh = await readLocal(root, relative);
      if (fresh.sha256 !== expectedSha256) throw new Error('File changed while acquiring the write lock.');
      const temp = `${file}.prorelay-${crypto.randomUUID()}.tmp`;
      try {
        await fs.writeFile(temp, content, { flag: 'wx', mode: (await fs.stat(file)).mode & 0o777 });
        await fs.rename(temp, file);
      } finally { await fs.rm(temp, { force: true }); }
    } finally { await handle.close(); await fs.rm(lock, { force: true }); }
  }
  return { path: relative, sha256: hash(content), bytes: Buffer.byteLength(content) };
}
