# You are changing someone's app

This folder is one app in the Tiiny app shape. It is plain static files: no build step, no server.

## What is where

- `definitions.yaml`: what each word in the app means, and the allowed values. Change it first when a request adds a new kind of value.
- `data/*.json`: the app's content. `data/schema/*.json` lists the allowed values. A property with `"x-term": "<term>"` must keep the same values as `terms.<term>.values` in `definitions.yaml`.
- `seams/*.js`: small pure functions meant to be changed. Each has a contract comment. No network, storage, `window` or `document` in a seam.
- Dates are `YYYY-MM-DD` strings. For the day of the week, use `weekdayOf(date)` from `kit/dates.js` (0 = Sunday, 6 = Saturday). Do not use `new Date(date).getDay()`: it gives the day before west of UTC.
- `index.html`: loads the data, opens the store and wires the screens. Add new shared state here.
- `screens/*.js`: what each screen shows. `kit/` is the shared kit: do not edit it.
- `theme.json`: colours, type, spacing. `app.css`: the one app stylesheet.
- `kit/uprompt.js`: the app's model. `app.json` `models` names each model call. When a request asks the app to suggest, write or decide something, call `call(need, messages)` from `kit/uprompt.js`, and check the answer with `validate` from `kit/gate.js` against the schema.
- `.kit/`: where this install runs things (hosting, inference, storage). To change that, write `.kit/profile.json`, starting from `profile.example.json` and using only the values in `profile.schema.json`. It stays local and is not committed.

## Find the part to change

List the named regions in a file, then show one:

    duckeye -Q '.func' seams/rotation.js
    duckeye -Q '.func#assignWeek' seams/rotation.js
    duckeye -Q '#every' definitions.yaml
    duckeye -Q '#accent' theme.json

Add `--json` to get each region's path. A line range is given only where the tool knows it; otherwise use the path.

## Change it

1. Show the region, then edit it with your own edit tool. Replace the exact text you were shown.
2. Change only what the request needs. Keep names and exports: other files import them.
3. Run the app's checks:

       kit check

   It prints nothing when all is well. Each other line is one fault: file, line, rule, and what is wrong.
4. Fix each fault, and run `kit check` again. If they still fail after three tries, undo with `git restore . && git clean -fd` and explain what blocked you.

## Rules

- Never edit `checks/` or `kit/`. The checks are how the owner knows the app still works.
- Keep seams pure.
- Use only allowed values. To add a value, add it to `definitions.yaml` and to the schema, then use it.
- If the request needs a server, email, scheduled jobs, or anything else a static app cannot do: change nothing, and explain why in one or two sentences.

When you are done, say in one sentence what you changed.
