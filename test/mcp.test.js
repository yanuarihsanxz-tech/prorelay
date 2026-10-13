import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));
async function connect(t, writable = false) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'prorelay-mcp-'));
  await fs.writeFile(path.join(root, 'hello.txt'), 'Hello from a local file.\n');
  const client = new Client({ name: 'prorelay-test-client', version: '1.0.0' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [cli, 'mcp', '--root', root, ...(writable ? ['--allow-write'] : [])], stderr: 'pipe' });
  await client.connect(transport);
  t.after(async () => { await client.close(); await fs.rm(root, { recursive: true, force: true }); });
  return { client, root };
}
function data(result) { assert.equal(result.isError, undefined); return JSON.parse(result.content[0].text); }
test('real stdio MCP client negotiates, discovers tools, and reads a scoped local file', async t => {
  const { client } = await connect(t);
  const tools = await client.listTools();
  assert.ok(tools.tools.some(tool => tool.name === 'local_read'));
  assert.ok(!tools.tools.some(tool => tool.name === 'local_write'));
  const file = data(await client.callTool({ name: 'local_read', arguments: { path: 'hello.txt' } }));
  assert.equal(file.content, 'Hello from a local file.\n');
  const denied = await client.callTool({ name: 'local_read', arguments: { path: '../outside.txt' } });
  assert.equal(denied.isError, true);
});
test('opt-in MCP writes use hashes and task tools preserve exchange state', async t => {
  const { client, root } = await connect(t, true);
  const file = data(await client.callTool({ name: 'local_read', arguments: { path: 'hello.txt' } }));
  data(await client.callTool({ name: 'local_write', arguments: { path: 'hello.txt', content: 'Updated.\n', expectedSha256: file.sha256 } }));
  assert.equal(await fs.readFile(path.join(root, 'hello.txt'), 'utf8'), 'Updated.\n');
  assert.equal((await client.callTool({ name: 'local_write', arguments: { path: 'hello.txt', content: 'Stale.', expectedSha256: file.sha256 } })).isError, true);
  const task = data(await client.callTool({ name: 'relay_prepare', arguments: { brief: 'Review hello.txt.', files: ['hello.txt'] } }));
  data(await client.callTool({ name: 'relay_dispatch', arguments: { id: task.id } }));
  data(await client.callTool({ name: 'relay_receive', arguments: { id: task.id, text: `PRORELAY_BEGIN_${task.id}\nReviewed.\nPRORELAY_END_${task.id}` } }));
  assert.equal(data(await client.callTool({ name: 'relay_get', arguments: { id: task.id } })).status, 'received');
});
