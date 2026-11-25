// Stand-in, replaced by the real kit (uprompt). Answers only from a test fake.
// call(need, messages, tools) -> Promise<{text: string, toolCalls: object[]}>
export async function call(need, messages, tools = []) {
  const fake = globalThis.UPROMPT_FAKE;
  if (typeof fake !== 'function') throw new Error('uprompt: no model bound (stand-in)');
  const r = await fake(need, messages, tools);
  return { text: String(r?.text ?? ''), toolCalls: Array.isArray(r?.toolCalls) ? r.toolCalls : [] };
}
