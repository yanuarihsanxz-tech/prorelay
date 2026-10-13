#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { rootPath, readLocal, listLocal, assertShareable, allowedName, MAX_PACKET_BYTES } from './workspace.js';
import { prepareTask, getTask, listTasks, dispatchTask, sentTask, receiveTask, markTask, resumeTask, checkSnapshot } from './tasks.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const help = `ProRelay — bring your AI subscription into your local coding workflow.

Usage: node src/cli.js <command> [task-id] --root /path/to/project [options]

  doctor         Check the local runtime; browser/account access is checked by the host agent.
  prepare        --brief "Task" or --brief-file brief.md; repeat --file path; --provider gemini|other
                 Optional --parent task-id keeps the revision history linked.
  list           List saved task checkpoints.
  show ID        Show task JSON; --packet prints the selected context for handoff.
  dispatch ID    Reserve one send attempt. Check the target chat before retrying.
  sent ID        --conversation "Chat URL or title" after the message is visibly sent.
  receive ID     --response-file reply.txt; requires complete task markers.
  check ID       Compare selected source files against the sent snapshot.
  mark ID        --status applied|verified|needs_review|paused|failed --note "Reason"
                 verified also requires --evidence "Command and observed result".
  resume ID      Resume a paused task at its previous state without resending.
  local-list     --path . (optional)
  local-read     --path relative/file
  install-skill  --host codex|claude|antigravity|generic; writes only inside --root.
  mcp            Start a local stdio MCP bridge. Read-only unless --allow-write is supplied.

No model API key is required. Browser exchange uses the host agent's available tools.
Task context and replies stay in the project's ignored .prorelay/ directory.
`;

async function inputFile(file) {
  if (!allowedName(path.basename(file))) throw new Error('Input filename is excluded.');
  const stat = await fs.stat(file);
  if (!stat.isFile() || stat.size > MAX_PACKET_BYTES) throw new Error('Input must be a small text file.');
  const data = await fs.readFile(file);
  if (data.length > MAX_PACKET_BYTES) throw new Error('Input is too large.');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(data);
  assertShareable(text);
  return text;
}
export async function installSkill(root, host) {
  const locations = { codex: '.agents/skills', antigravity: '.agents/skills', claude: '.claude/skills', generic: '.agents/skills' };
  if (!Object.hasOwn(locations, host)) throw new Error('Host must be codex, claude, antigravity, or generic.');
  const destination = path.join(root, locations[host], 'prorelay');
  // Refuse symlinked ancestors or an existing installation instead of replacing user guidance.
  let current = root;
  for (const part of path.relative(root, destination).split(path.sep)) {
    current = path.join(current, part);
    try { if ((await fs.lstat(current)).isSymbolicLink()) throw new Error('Skill destination must not contain symlinks.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  try { await fs.access(destination); throw new Error('Skill already exists. Keep it, or review and remove it before reinstalling.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.cp(path.join(repo, 'skills/prorelay'), destination, { recursive: true, errorOnExist: true, force: false });
  await fs.writeFile(path.join(destination, 'runtime.json'), JSON.stringify({ repository: repo, cli: path.join(repo, 'src/cli.js'), workspace: root, host }, null, 2) + '\n', { flag: 'wx' });
  return { host, installedAt: destination, cli: path.join(repo, 'src/cli.js'), next: 'Ask the host to use the prorelay skill. Host discovery or a restart may be needed.' };
}
export async function doctor(root) {
  const checks = { node: { status: Number(process.versions.node.split('.')[0]) >= 22 ? 'ready' : 'blocked', version: process.version }, workspace: { status: 'ready', root } };
  try { await fs.access(root, fs.constants.R_OK | fs.constants.W_OK); } catch { checks.workspace.status = 'blocked'; }
  try { await import('@modelcontextprotocol/sdk/server/mcp.js'); checks.mcp = { status: 'ready' }; }
  catch { checks.mcp = { status: 'missing', action: 'Run npm ci in the ProRelay repository.' }; }
  try { const result = await promisify(execFile)('git', ['--version'], { timeout: 5000 }); checks.git = { status: 'ready', version: result.stdout.trim() }; }
  catch { checks.git = { status: 'optional-missing' }; }
  checks.browser = { status: 'host-check-required', action: 'Inspect available browser/computer tools; confirm read, input, and complete-response capture on the chosen chat.' };
  checks.account = { status: 'host-check-required', action: 'Confirm sign-in, selected model, and current quota. ProRelay cannot grant account access.' };
  return checks;
}
async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    root: { type: 'string' }, brief: { type: 'string' }, 'brief-file': { type: 'string' }, file: { type: 'string', multiple: true }, provider: { type: 'string' }, parent: { type: 'string' }, packet: { type: 'boolean' }, 'response-file': { type: 'string' }, conversation: { type: 'string' }, status: { type: 'string' }, note: { type: 'string' }, evidence: { type: 'string' }, path: { type: 'string' }, host: { type: 'string' }, 'allow-write': { type: 'boolean' }, help: { type: 'boolean', short: 'h' }
  } });
  const [command, id] = positionals;
  if (!command || values.help || command === 'help') { process.stdout.write(help); return; }
  const root = await rootPath(values.root || process.cwd());
  let result;
  switch (command) {
    case 'doctor': result = await doctor(root); break;
    case 'prepare': {
      if (values.brief && values['brief-file']) throw new Error('Choose --brief or --brief-file.');
      const brief = values['brief-file'] ? (await readLocal(root, values['brief-file'])).content : values.brief;
      const task = await prepareTask(root, { brief, files: values.file, provider: values.provider, parent: values.parent });
      result = { id: task.id, status: task.status, files: task.files, next: `show ${task.id} --packet` }; break;
    }
    case 'list': result = await listTasks(root); break;
    case 'show': {
      result = await getTask(root, id);
      if (values.packet) { process.stdout.write(result.packet + '\n'); return; }
      break;
    }
    case 'dispatch': result = await dispatchTask(root, id); break;
    case 'sent': result = await sentTask(root, id, values.conversation); break;
    case 'receive':
      if (!values['response-file']) throw new Error('--response-file is required.');
      result = await receiveTask(root, id, await inputFile(path.resolve(values['response-file']))); break;
    case 'check': result = await checkSnapshot(root, id); break;
    case 'mark': result = await markTask(root, id, values.status, values.note, values.evidence); break;
    case 'resume': result = await resumeTask(root, id); break;
    case 'local-list': result = await listLocal(root, values.path || '.'); break;
    case 'local-read': result = await readLocal(root, values.path); break;
    case 'install-skill': result = await installSkill(root, values.host); break;
    case 'mcp': {
      const { startServer } = await import('./mcp.js');
      await startServer(root, Boolean(values['allow-write'])); return;
    }
    default: throw new Error(`Unknown command: ${command}. Run --help.`);
  }
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { process.stderr.write(`ProRelay: ${error.message}\n`); process.exitCode = 1; });
}
