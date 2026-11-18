import React from 'react';
import { Copy } from 'lucide-react';
/** A small, non-HTML message formatter. Code is never executed; no links, images
 * or remote embeds are loaded from generated text. The raw text remains exportable. */
function inline(text) {
  return text
    .split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g)
    .map((s, i) =>
      s.startsWith('**') && s.endsWith('**') ? (
        <strong key={i}>{s.slice(2, -2)}</strong>
      ) : s.startsWith('`') && s.endsWith('`') ? (
        <code key={i}>{s.slice(1, -1)}</code>
      ) : (
        s
      ),
    );
}
export function ReplyText({ text, tell }) {
  const blocks = [];
  let code = null,
    language = '',
    para = [];
  const flush = () => {
    if (para.length) {
      blocks.push(<p key={blocks.length}>{inline(para.join('\n'))}</p>);
      para = [];
    }
  };
  const dump = () => {
    const body = code.join('\n');
    blocks.push(
      <section className="reply-code" key={blocks.length}>
        <header>
          <small>{language || 'CODE'}</small>
          <button
            title="Copy code"
            aria-label="Copy code"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(body);
                tell('Code copied.');
              } catch {
                tell('Select the code and copy it manually.');
              }
            }}
          >
            <Copy size={12} />
          </button>
        </header>
        <pre dir="ltr">
          <code>{body}</code>
        </pre>
      </section>,
    );
    code = null;
  };
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) {
      if (code) dump();
      else {
        flush();
        code = [];
        language = line.trim().slice(3).trim().slice(0, 32);
      }
      continue;
    }
    if (code) {
      code.push(line);
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    const h = /^#{1,4}\s+(.+)$/.exec(line);
    if (h) {
      flush();
      blocks.push(
        <p className="reply-heading" key={blocks.length}>
          {inline(h[1])}
        </p>,
      );
      continue;
    }
    const bullet = /^\s*[-*]\s+(.+)$/.exec(line);
    if (bullet) {
      flush();
      blocks.push(
        <p className="reply-bullet" key={blocks.length}>
          {inline(bullet[1])}
        </p>,
      );
    } else para.push(line);
  }
  if (code) dump();
  flush();
  return blocks;
}
