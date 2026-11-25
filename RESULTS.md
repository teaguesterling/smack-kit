# Results: small-model agents on the held-out tasks

Three nights of runs, 2026-11-23 to 2026-11-25. An agent on a local model got the card (`fixtures/CARD.md`)
and one change request. Then `tools/fixture.mjs score` scored the result. Claude Opus ran the runs and wrote
this summary.

**Summary.** Two things changed the pass rate: the model, and the task. Changes to the card, the base app
code, the request wording or the agent tool made no difference we could measure. Tasks that add a model call
almost always failed.

## Setup

- **Tasks:** the 11 held-out requests (`cc-11`, `cc-12`, `ld-07` to `ld-09`, `rl-01` to `rl-06`). The cards
  and the harness were developed on the other 16 tasks.
- **Device:** a Tiiny NPU on the local network, through its OpenAI-compatible API.
- **Agent tools:** opencode 1.18.25 (the default), and aider 0.86.2 with `--test-cmd "kit check" --auto-test`.
- **Limits:** 600 s for each run. A run that hit the limit counts as a failure.
- **Design:** 2 or 3 reps for each task and arm. The order was a seeded shuffle, with the arms mixed together.
  The control arm ran again on each later night, to check for drift between nights.
- **Statistics:** each arm is compared with the control on the same task and rep. The test is a two-sided sign
  test on the cells where the two arms disagree. "+a/−b" means the arm passed `a` cells that the control
  failed, and failed `b` cells that the control passed.

Runs that failed in transport (the device answered that the model was not loaded) are left out. There were 87,
all from one model (see below).

## Model, card, tool and base code (Qwen3.6-35B-A3B unless named)

| Arm | What changed | Pass | Rate | vs control |
|---|---|---|---|---|
| c0 | Control: the shipped card | 19/32 | 59% | |
| c1 | A short card (140 words, not 479) | 20/32 | 63% | +2/−1, p=1.00 |
| c2 | The card plus a worked example | 19/32 | 59% | +2/−2, p=1.00 |
| c3 | The card without the region locator | 18/32 | 56% | +4/−5, p=1.00 |
| c5 | The card, with the decline decision first | 22/32 | 69% | +5/−2, p=0.45 |
| nc | Seam contract comments removed from the apps | 23/32 | 72% | +5/−1, p=0.22 |
| aider | aider instead of opencode | 21/32 | 66% | +3/−1, p=0.62 |
| q4b | Qwen3-4B-Instruct-2507 | 5/32 | 16% | +2/−16, p<0.01 |

A second night added three arms, each with its own control (22/33, 67%):

| Arm | What changed | Pass | vs that night's control |
|---|---|---|---|
| para | The 11 requests reworded | 21/33 | +2/−3, p=1.00 |
| q4b-c1 | Qwen3-4B with the short card | 4/33 | +1/−19, p<0.01 |

The control's cells on the two nights differed by +2/−0, so we saw no drift between nights.

## Other models (third night, 2 reps, against Qwen3.6 on the same night)

| Model | Card | Pass | Timeouts | vs Qwen3.6 |
|---|---|---|---|---|
| GLM-4.7-Flash | c0 | 7/22 | 12 | +0/−7, p=0.02 |
| GLM-4.7-Flash | c1 | 10/22 | 9 | +1/−2, p=1.00 |
| Qwen3-Coder-30B-A3B | c0, c1 | no data | | |

GLM-4.7-Flash mostly ran out of time (21 of its 44 runs). Qwen3-Coder-30B-A3B loaded, then answered
"not loaded" to nearly every request (87 of 88 runs). So we have no measurement for it.

## By task (all arms and nights)

| Task | Request | Pass rate |
|---|---|---|
| ld-08 | Add a level called Numbers, digits 1 to 9 | 88% |
| ld-09 | Text me when someone beats the high score (decline) | 88% |
| cc-12 | On the board, put the people with the most points first | 85% |
| rl-04 | The calendar days are too small to tap on my phone | 80% |
| rl-03 | Weeks start on Sunday in our house | 68% |
| rl-06 | Remind the kids to read at 7pm every night (decline) | 68% |
| rl-01 | Add audiobooks as a kind of reading | 61% |
| cc-11 | Bartholomew is only here at weekends | 17% |
| rl-02 | Show each child's reading streak | 12% |
| ld-07 | After each game, have the AI say something encouraging | 6% |
| rl-05 | Suggest a next book for each child | 2% |

The two "model" tasks (`ld-07`, `rl-05`) ask the app to call a model. They nearly always failed at the
verifier: the model's words never reached the screen.

## How the small model failed

Of Qwen3-4B's 56 failures, 38 changed nothing, and 12 edited a file outside the request's list, which the
scope check refuses. The other 6 failed the verifier or the app's checks. A short card did not help it.

## What we take from this

- **Pick the model first.** Model choice moved the rate by about 40 points (59% to 16%). No card change moved it by more
  than a few cells.
- **Keep the card short if you like.** The 140-word card did as well as the 479-word one with a 35B model.
- **Model-call tasks need more help than a card.** We read this as the next thing for the kit to fix.

## Reproduce

The fixtures, the scorer and the card are in this repo. For each run:

```sh
node tools/fixture.mjs start rl-03 work/rl-03
# run your agent in work/rl-03, with the printed card and request
node tools/fixture.mjs score rl-03 work/rl-03
```

The harness that drove the agents and the raw per-run records are not in this repo. They name machines on a
private network.
