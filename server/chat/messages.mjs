import { InputError } from '../runtime/options.mjs';
export const systemPrompt =
  'You are a helpful assistant in Vesperloom, a creative studio. Answer the user directly, in the language they use. When asked for an image or video prompt, describe a concrete scene. Never claim you have rendered a file: the user can send text to a studio to render it.';
export function chatInput(raw) {
  const { model = 'qwen-small', messages, maxTokens = 192 } = raw || {};
  if (!['qwen-small', 'qwen-7b', 'connected'].includes(model))
    throw new InputError('Unknown chat engine.');
  if (
    !Array.isArray(messages) ||
    !messages.length ||
    messages.length > 17 ||
    messages.length % 2 !== 1
  )
    throw new InputError('Send up to eight previous exchanges followed by a user message.');
  let size = 0;
  const clean = messages.map((m, i) => {
    const role = i % 2 ? 'assistant' : 'user';
    if (
      m?.role !== role ||
      typeof m.content !== 'string' ||
      !m.content.trim() ||
      m.content.length > 4000
    )
      throw new InputError('Invalid chat turn (user/assistant, 1–4000 characters).');
    size += m.content.length;
    return { role, content: m.content.trim() };
  });
  if (size > 14000 || !Number.isInteger(maxTokens) || maxTokens < 8 || maxTokens > 384)
    throw new InputError('Chat context or output budget exceeds the studio limit.');
  return { model, messages: clean, maxTokens };
}
