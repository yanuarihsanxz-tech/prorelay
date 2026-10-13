import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { rootPath, readLocal, listLocal, writeLocal, MAX_FILE_BYTES } from '../src/workspace.js';

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'prorelay-workspace-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const root = await rootPath(directory);
  await fs.writeFile(path.join(root, 'hello.js'), 'export const hello = 1;\n');
  return root;
}
test('reads selected text with a stable hash; listing hides excluded paths', async t => {
  const root = await fixture(t);
  await fs.writeFile(path.join(root, '.env'), 'PRIVATE_EXAMPLE=hidden');
  await fs.mkdir(path.join(root, 'node_modules'));
  const file = await readLocal(root, 'hello.js');
  assert.equal(file.content, 'export const hello = 1;\n');
  assert.match(file.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual((await listLocal(root)).entries.map(entry => entry.path), ['hello.js']);
  await assert.rejects(readLocal(root, '.env'), /excluded/);
});
test('rejects traversal, absolute paths, in-root secret aliases, and external symlinks', async t => {
  const root = await fixture(t);
  await fs.writeFile(path.join(root, '.env'), 'PRIVATE_EXAMPLE=hidden');
  await fs.symlink(path.join(root, '.env'), path.join(root, 'alias.txt'));
  await fs.symlink(os.tmpdir(), path.join(root, 'outside'));
  for (const relative of ['../outside.txt', '/etc/hosts', 'alias.txt', 'outside/other.txt', '.git/config', 'file\\path']) {
    await assert.rejects(readLocal(root, relative));
  }
  await assert.rejects(writeLocal(root, 'alias.txt', 'replacement', 'NEW', true), /Symlink/);
});
test('rejects oversized, binary, malformed UTF-8, and credential-like content', async t => {
  const root = await fixture(t);
  await fs.writeFile(path.join(root, 'large.txt'), Buffer.alloc(MAX_FILE_BYTES + 1, 65));
  await fs.writeFile(path.join(root, 'binary.txt'), Buffer.from([65, 0, 66]));
  await fs.writeFile(path.join(root, 'invalid.txt'), Buffer.from([0xff]));
  await fs.writeFile(path.join(root, 'config.txt'), 'ghp_' + 'a'.repeat(36));
  for (const relative of ['large.txt', 'binary.txt', 'invalid.txt', 'config.txt']) await assert.rejects(readLocal(root, relative));
});
test('writes require opt-in and a current hash; NEW cannot overwrite', async t => {
  const root = await fixture(t);
  const file = await readLocal(root, 'hello.js');
  await assert.rejects(writeLocal(root, 'hello.js', 'changed', file.sha256, false), /disabled/);
  await assert.rejects(writeLocal(root, 'hello.js', 'changed', 'NEW', true), /changed/);
  await writeLocal(root, 'hello.js', 'changed\n', file.sha256, true);
  await assert.rejects(writeLocal(root, 'hello.js', 'stale', file.sha256, true), /changed/);
  await writeLocal(root, 'new.txt', 'new\n', 'NEW', true);
  assert.equal((await readLocal(root, 'new.txt')).content, 'new\n');
});
