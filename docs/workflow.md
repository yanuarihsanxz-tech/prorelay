# A complete handoff

The coding agent runs the commands below and performs the browser actions with its own available tools. Replace `PROJECT` with the chosen absolute project path and `ID` with the actual task ID. Run the CLI from the ProRelay checkout or use its absolute path.

## Prepare

Write a brief that preserves the user's desired outcome, constraints, accepted decisions, and completion checks. Choose the relevant files.

```bash
node src/cli.js prepare --root PROJECT --brief-file brief.md \
  --file src/example.js --file test/example.test.js
node src/cli.js show ID --root PROJECT --packet
```

Nothing has been transmitted. Inspect the selected packet before sending. The packet includes the task ID, source paths, hashes, and the brief, but not the absolute workspace path. A recorded Git commit is useful provenance; selected file hashes identify uncommitted contents too.

## Send and wait

```bash
node src/cli.js dispatch ID --root PROJECT
```

Now use the host's browser/app controls to select the intended chat/model, paste or upload the packet, and send it. Verify the message appears. Then record the destination:

```bash
node src/cli.js sent ID --root PROJECT --conversation "Destination chat URL or title"
```

Wait through the host's supported tools. ProRelay is not a daemon. If the host is interrupted in `dispatching`, inspect the destination before any resend; the command deliberately refuses another dispatch of that task. You may collect a complete answer directly from `dispatching` if delivery succeeded but recording `sent` was interrupted.

## Collect and implement

Save the actual final response to a local text file. It must contain:

```text
PRORELAY_BEGIN_ID
The complete proposed answer, with code or review findings as needed.
PRORELAY_END_ID
```

`ID` above represents the real 12-character task ID. Do not add missing markers yourself; ask the target model to reformat its complete answer without resending the full original task. Inspect the chat first so a formatting follow-up does not duplicate an unfinished request.

```bash
node src/cli.js receive ID --root PROJECT --response-file /path/to/captured-reply.txt
node src/cli.js check ID --root PROJECT
```

Review the proposal against the current project. If the snapshot changed, reconcile those differences before applying it. Use the executor's normal file-edit tools. Run meaningful tests and the required user path. Only then record the result:

```bash
node src/cli.js mark ID --root PROJECT --status applied \
  --note "Applied the reviewed change to src/example.js."
node src/cli.js mark ID --root PROJECT --status verified \
  --note "The required behavior passed." \
  --evidence "Exact command; observed outcome and remaining limits."
```

`mark` stores executor-reported evidence. It does not execute a test, validate the truth of a note, or approve returned code.

## Review, revise, and resume

For a user choice, record `needs_review` with a concrete note and show the result. For a requested pause, record `paused`; resume later without replaying delivery:

```bash
node src/cli.js mark ID --root PROJECT --status paused --note "Waiting for the user's requested review."
node src/cli.js list --root PROJECT
node src/cli.js resume ID --root PROJECT
```

For a new revision, prepare a new packet from current sources and link it to the preceding task:

```bash
node src/cli.js prepare --root PROJECT --parent ID \
  --brief-file revision.md --file src/example.js
```

The brief should include relevant findings and decisions from the preceding task; `--parent` records the relationship but does not automatically include its full response. Keep earlier attempts and evidence instead of overwriting history.

## Storage and limits

State lives under `.prorelay/tasks/`. A local `.gitignore` containing `*` keeps it out of Git even when the project has no root ignore file. Treat this directory as private context. File packets accept up to 30 selected UTF-8 files, each up to 256 KiB, with a total packet limit of 512 KiB. Provider UI limits may be lower; choose a smaller packet or a supported text-file upload when needed.

Task mutation uses an exclusive lock. A process killed mid-write may leave a lock. Verify that the process has ended and inspect the task state before removing a stale lock. Do not reset an uncertain dispatch automatically.
