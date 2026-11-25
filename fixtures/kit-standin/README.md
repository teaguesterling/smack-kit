# Kit stand-ins

Stand-ins, replaced by the real kit. Each app vendors a copy of these files in its `kit/` directory (design §8a).

- `gate.js`: `validate(schema, value) -> string[]`. Each error names the path, and the allowed values for an enum.
- `store.js`: `openStore(name) -> {get, set}`, the shape of utote kv. It uses `localStorage` in a browser and memory in Node. It stores data only; it never runs it.
- `uprompt.js`: `call(need, messages, tools) -> {text, toolCalls}`. It answers only from `globalThis.UPROMPT_FAKE`. Otherwise it throws `uprompt: no model bound (stand-in)`.
- `parts.js`: UI parts, styled only through `--kit-<token>` CSS custom properties that `applyTheme(theme)` sets.
