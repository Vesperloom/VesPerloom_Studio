import { InputError } from '../runtime/options.mjs';
import { systemPrompt } from './messages.mjs';
/** Only administrators select endpoints; the browser can select a registered ID, never a URL. */
export function providerConfig(env = process.env) {
  if (!env.VESPER_CHAT_BASE_URL || !env.VESPER_CHAT_MODEL) return null;
  const u = new URL(env.VESPER_CHAT_BASE_URL);
  if (
    (u.protocol !== 'https:' &&
      !(u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname))) ||
    u.username ||
    u.password ||
    u.search ||
    u.hash
  )
    throw Error(
      'Chat provider must use HTTPS (or loopback HTTP), without URL credentials or a query.',
    );
  return {
    url: u.href.replace(/\/$/, '') + '/chat/completions',
    host: u.host,
    model: env.VESPER_CHAT_MODEL,
    key: env.VESPER_CHAT_API_KEY || '',
  };
}
export async function* providerReply(config, input, signal) {
  const r = await fetch(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(config.key ? { Authorization: 'Bearer ' + config.key } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'system', content: systemPrompt }, ...input.messages],
      max_tokens: input.maxTokens,
      stream: true,
    }),
    signal,
    redirect: 'error',
  });
  if (!r.ok || !r.body)
    throw new InputError(`Configured chat provider returned HTTP ${r.status}.`, 502);
  let buf = '',
    finished = false,
    reason = 'stop';
  const decoder = new TextDecoder();
  for await (const chunk of r.body) {
    buf += decoder.decode(chunk, { stream: true });
    if (buf.length > 128 * 1024) throw Error('Provider stream block exceeded its limit.');
    let match;
    while ((match = /\r?\n\r?\n/.exec(buf))) {
      const block = buf.slice(0, match.index);
      buf = buf.slice(match.index + match[0].length);
      const data = block
        .split(/\r?\n/)
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trimStart())
        .join('\n');
      if (!data) continue;
      if (data === '[DONE]') {
        yield { type: 'end', reason };
        return;
      }
      const obj = JSON.parse(data);
      if (obj.error) throw Error('Provider reported a generation error.');
      const choice = obj.choices?.[0];
      if (typeof choice?.delta?.content === 'string' && choice.delta.content)
        yield { type: 'delta', text: choice.delta.content };
      if (choice?.finish_reason) {
        reason = choice.finish_reason;
        finished = true;
      }
    }
  }
  if (!finished) throw Error('Provider stream ended before completion.');
  yield { type: 'end', reason };
}
