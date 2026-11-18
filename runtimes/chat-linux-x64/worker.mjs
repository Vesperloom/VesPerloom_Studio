/** Opt-in, per-turn CPU child process. Never shares a KV cache across users. */
import os from 'node:os';
import { getLlama, LlamaChatSession, LlamaLogLevel } from 'node-llama-cpp';
const send = (m) => process.send?.(m);
async function run() {
  let text = '';
  for await (const chunk of process.stdin) text += chunk;
  const { modelPath, system, messages, maxTokens } = JSON.parse(text);
  const llama = await getLlama({ gpu: false, build: 'never', logLevel: LlamaLogLevel.error });
  try {
    const model = await llama.loadModel({ modelPath, gpuLayers: 0 });
    const ctx = await model.createContext({
      contextSize: 4096,
      batchSize: 128,
      threads: Math.max(1, Math.min(6, os.availableParallelism())),
    });
    const session = new LlamaChatSession({
      contextSequence: ctx.getSequence(),
      systemPrompt: system,
    });
    const turns = [...messages];
    const budget = ctx.contextSize - maxTokens - 192;
    const tokens = (str) => model.tokenize(str).length;
    while (
      turns.length > 1 &&
      tokens(system) + turns.reduce((n, m) => n + tokens(m.content) + 12, 0) > budget
    )
      turns.splice(0, 2);
    if (tokens(system) + tokens(turns.at(-1).content) + 24 > budget)
      throw Error('The last message is longer than the local model context.');
    const history = [
      { type: 'system', text: system },
      ...turns
        .slice(0, -1)
        .map((m) =>
          m.role === 'user'
            ? { type: 'user', text: m.content }
            : { type: 'model', response: [m.content] },
        ),
    ];
    session.setChatHistory(history);
    send({ type: 'ready', contextTurns: turns.length });
    const result = await session.promptWithMeta(turns.at(-1).content, {
      maxTokens,
      temperature: 0.6,
      topP: 0.9,
      repeatPenalty: { penalty: 1.06 },
      onTextChunk: (chunk) => send({ type: 'delta', text: chunk }),
    });
    send({ type: 'end', reason: result.stopReason === 'maxTokens' ? 'length' : 'stop' });
  } finally {
    await llama.dispose();
  }
}
run()
  .catch((e) => {
    send({ type: 'error', message: String(e.message).slice(0, 240) });
    process.exitCode = 1;
  })
  .finally(() => process.disconnect?.());
