# smack

**smack** is a small model app creator kit. With it, an agent on a small model, local or hosted, can safely
change a small web app for one person. A typical request is "double points on Saturdays" or "add a column for
the author". The kit doesn't depend on any agent harness. It gives the agent a known app shape, a short card
of instructions, and one quiet command, `kit check`. That command says whether the change kept the app working.

Status: early. The app shape, `kit check`, and the task fixtures work and have tests. The API can change.

[RESULTS.md](RESULTS.md) has three nights of measured runs: small-model agents on the 11 held-out tasks.

## The app shape

A smack app is plain static files with no build step:

| Path | What it holds |
|---|---|
| `app.json` | The app's name, the screens to render, and the model calls it makes |
| `definitions.yaml` | What each word in the app means, and the values it allows |
| `data/*.json`, `data/schema/*.json` | The content, and the schema that limits it |
| `seams/*.js` | Small pure functions, each with a contract comment. A seam is the part an agent is meant to change |
| `screens/*.js`, `index.html` | What each screen shows, and how the screens are wired |
| `theme.json`, `app.css` | Colours, type and spacing, and the one app stylesheet |
| `checks/` | The app's own tests. An agent never edits them |
| `kit/` | The shared kit parts. An agent never edits them |

## kit check

```sh
npm install && npm link          # puts `kit` on PATH
kit check [appdir] [--profile dev|install]
```

When all is well, it prints nothing and exits 0. Otherwise each fault is one line, `file:line rule message`,
and the exit code is 1. The steps run in this order, and the check stops at the first step with faults:

1. **drift**: the schemas still match `definitions.yaml`.
2. **schema**: the data obeys its schema.
3. **purity**: no seam uses the network, storage, `window` or `document` (checked on the syntax tree).
4. **tests**: the app's `checks/` pass.
5. **layout**: each screen renders at phone width with no overflow, overlap, small tap targets or low contrast.

The `install` profile skips layout.

## Fixtures: measuring an agent

`fixtures/` holds three example apps (`chore-chart`, `letter-drop`, `reading-log`), 27 change requests, a
verifier and a reference solution for each request, and the card an agent reads (`fixtures/CARD.md`).

```sh
node tools/fixture.mjs start cc-03 work/cc-03   # copy the app, print the card and the request
# ... let your agent work in work/cc-03 ...
node tools/fixture.mjs score cc-03 work/cc-03   # one line: PASS, or FAIL <step>: <reason>
node tools/fixture.mjs validate                 # every task: the start FAILs, the solution PASSes
```

Some requests are ones a static app can't meet, such as "email me every morning". The right answer is to change
nothing and say why. These "decline" tasks pass only when the app is left unchanged.

## Tests

```sh
npm test               # node:test: kit check and the fixture tool
npx playwright test    # browser tests of the example apps at 360, 390, 768 and 1280 px
```

## Requirements

- Node 18 or later.
- Chromium for the layout step and the browser tests. Run `npx playwright install chromium`, or set `CHROME_PATH`.
- [duckeye](https://github.com/teaguesterling/duckeye) for the card's region locator (`duckeye -Q '.func#name' file.js`).
  The kit itself runs without it.
- coreutils `timeout` (Linux) for `fixture.mjs score`.

## Licence

MIT. See [LICENSE](LICENSE).
