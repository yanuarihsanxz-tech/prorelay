# Live coding handoff demo

The demo task fixes `clamp`: finite numbers only, ordered bounds, and unchanged valid clamping behavior. `range.before.js` preserves the incomplete baseline; `range.js` contains the reviewed result after validation. The tests provide observable completion criteria.

Use a separate scratch workspace so the demo does not overwrite an existing project:

```bash
mkdir -p /path/to/scratch/prorelay-demo
cp examples/demo-project/range.before.js /path/to/scratch/prorelay-demo/range.js
cp examples/demo-project/range.test.js /path/to/scratch/prorelay-demo/range.test.js
cp examples/demo-project/brief.md /path/to/scratch/prorelay-demo/brief.md

node --test /path/to/scratch/prorelay-demo/range.test.js
```

The baseline fails validation tests. Ask your local coding agent to use ProRelay to send the brief and the two source/test files to Gemini, collect a complete marked answer, implement it in that scratch directory, and rerun the test. It should show both the failing baseline and the passing result.

```bash
node src/cli.js prepare --root /path/to/scratch/prorelay-demo \
  --brief-file brief.md --file range.js --file range.test.js
```

Follow [the full handoff walkthrough](../docs/workflow.md). Pause at review, resume the same task, or create a linked revision to test recovery. The repository's verification report separates a live provider exchange from synthetic transport tests.
