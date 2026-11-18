import { createInterface } from 'node:readline/promises';
import { home } from '../server/config.mjs';
import { chatModels, localReply } from '../server/chat/service.mjs';
import { chatInput } from '../server/chat/messages.mjs';
/** Headless chat is intentionally local-only. The command never selects a network model. */
export async function chatCommand(model, options) {
  const m = chatModels(home, null).find((p) => p.id === model);
  if (!m?.ready)
    throw Error(`${model}: local chat engine is not ready. See npm run chat:setup and loom list.`);
  const maxTokens = Number(options['max-tokens'] || 192);
  let history = [];
  async function turn(prompt) {
    while (
      history.length &&
      (history.length > 16 ||
        history.reduce((n, t) => n + t.content.length, 0) + prompt.length > 14000)
    )
      history.splice(0, 2);
    const input = chatInput({
      model,
      maxTokens,
      messages: [...history, { role: 'user', content: prompt }],
    });
    const ctl = new AbortController();
    const stop = () => ctl.abort(Error('Chat interrupted.'));
    const timeout = setTimeout(() => ctl.abort(Error('Chat deadline exceeded.')), 180000);
    timeout.unref();
    process.once('SIGINT', stop);
    let reply = '';
    try {
      await localReply(input, home, ctl.signal, (m) => {
        if (m.type === 'delta') {
          reply += m.text;
          process.stdout.write(m.text);
        }
      });
      if (!reply.trim()) throw Error('The model returned no text.');
      history.push(
        { role: 'user', content: prompt },
        { role: 'assistant', content: reply.slice(0, 4000) },
      );
      console.log();
    } finally {
      clearTimeout(timeout);
      process.removeListener('SIGINT', stop);
    }
  }
  if (options.prompt !== undefined) return turn(options.prompt);
  if (!process.stdin.isTTY) throw Error('Noninteractive input requires --prompt TEXT.');
  console.log(`${m.name} · local session · /clear resets context, /exit quits.`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    while (true) {
      let prompt;
      try {
        prompt = (await rl.question('You › ')).trim();
      } catch {
        return;
      }
      if (prompt === '/exit') break;
      if (prompt === '/clear') {
        history = [];
        console.log('Context cleared.');
        continue;
      }
      if (prompt) await turn(prompt);
    }
  } finally {
    rl.close();
  }
}
