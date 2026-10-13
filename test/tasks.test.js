import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { rootPath } from '../src/workspace.js';
import { prepareTask, getTask, dispatchTask, sentTask, receiveTask, markTask, resumeTask, checkSnapshot, listTasks } from '../src/tasks.js';
const exec = promisify(execFile);
async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'prorelay-task-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const root = await rootPath(directory);
  await fs.writeFile(path.join(root, 'source.js'), 'export const value = 1;\n');
  return root;
}
const reply = (task, body = 'Proposed fix.') => `PRORELAY_BEGIN_${task.id}\n${body}\nPRORELAY_END_${task.id}`;
test('prepare → send → receive → apply → verify survives separate reads and links revisions', async t => {
  const root = await fixture(t);
  const task = await prepareTask(root, { brief: 'Review source.', files: ['source.js'] });
  assert.equal(task.status, 'prepared');
  assert.match(task.packet, /export const value = 1/);
  await dispatchTask(root, task.id);
  await sentTask(root, task.id, 'Synthetic transport fixture');
  await receiveTask(root, task.id, reply(task));
  assert.equal((await getTask(root, task.id)).response.text, 'Proposed fix.');
  await markTask(root, task.id, 'applied', 'Applied reviewed proposal.');
  await assert.rejects(markTask(root, task.id, 'verified', 'Checked.'), /evidence/);
  await markTask(root, task.id, 'verified', 'Accepted.', 'Fixture assertion passed; no live provider used.');
  const revision = await prepareTask(root, { brief: 'Review the revision.', parent: task.id });
  assert.equal(revision.parent, task.id);
  assert.equal((await listTasks(root)).length, 2);
  assert.equal((await getTask(root, task.id)).status, 'verified');
});
test('duplicate/concurrent dispatch fails and paused waiting resumes without resending', async t => {
  const root = await fixture(t);
  const task = await prepareTask(root, { brief: 'A task.' });
  const results = await Promise.allSettled([dispatchTask(root, task.id), dispatchTask(root, task.id)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  await assert.rejects(dispatchTask(root, task.id));
  await sentTask(root, task.id, 'Fixture chat');
  await markTask(root, task.id, 'paused', 'User requested a pause.');
  await resumeTask(root, task.id);
  assert.equal((await getTask(root, task.id)).status, 'waiting');
  await assert.rejects(dispatchTask(root, task.id));
});
test('truncated, empty, ambiguous, and wrong-task responses do not advance the checkpoint', async t => {
  const root = await fixture(t);
  const task = await prepareTask(root, { brief: 'A task.' });
  await dispatchTask(root, task.id);
  for (const text of [`PRORELAY_BEGIN_${task.id}\npartial`, 'PRORELAY_BEGIN_000000000000\nwrong\nPRORELAY_END_000000000000', reply(task, ' '), reply(task, `PRORELAY_BEGIN_${task.id}`), `Captured chat transcript:\n${reply(task)}`, `${reply(task)}\nextra transcript`, reply(task, `Quoted PRORELAY_END_${task.id}`)]) {
    await assert.rejects(receiveTask(root, task.id, text));
    assert.equal((await getTask(root, task.id)).status, 'dispatching');
  }
});
test('snapshot detects changed and deleted files before applying a proposal', async t => {
  const root = await fixture(t);
  const task = await prepareTask(root, { brief: 'A task.', files: ['source.js'] });
  assert.equal((await checkSnapshot(root, task.id)).unchanged, true);
  await fs.writeFile(path.join(root, 'source.js'), 'new value\n');
  assert.deepEqual((await checkSnapshot(root, task.id)).changes, [{ path: 'source.js', reason: 'changed' }]);
  await fs.rm(path.join(root, 'source.js'));
  assert.equal((await checkSnapshot(root, task.id)).changes[0].reason, 'missing');
});
test('state is excluded from Git even when the project lacks a root gitignore', async t => {
  const root = await fixture(t);
  await exec('git', ['init', '-q'], { cwd: root });
  const task = await prepareTask(root, { brief: 'A task.' });
  const ignored = await exec('git', ['check-ignore', `.prorelay/tasks/${task.id}.json`], { cwd: root });
  assert.match(ignored.stdout, /\.prorelay/);
});
test('rejects state symlinks, unknown transitions, and oversized packets', async t => {
  const root = await fixture(t);
  const task = await prepareTask(root, { brief: 'A task.' });
  await assert.rejects(markTask(root, task.id, 'verified', 'No work.', 'Made up.'), /Cannot transition/);
  await assert.rejects(prepareTask(root, { brief: 'a'.repeat(600_000) }), /too large/);
  await fs.rm(path.join(root, '.prorelay/tasks', `${task.id}.json`));
  await fs.symlink(path.join(root, 'source.js'), path.join(root, '.prorelay/tasks', `${task.id}.json`));
  await assert.rejects(getTask(root, task.id), /symlink/);
});
