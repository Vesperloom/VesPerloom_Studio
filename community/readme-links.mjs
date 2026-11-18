const labels = {
  'README.md': ['Try Seed Lab', 'Download Seed Lab (HTML)', 'Telegram channel', 'Star on GitHub'],
  'README.de.md': [
    'Seed Lab ausprobieren',
    'Seed Lab als HTML herunterladen',
    'Telegram-Kanal',
    'Auf GitHub mit Stern markieren',
  ],
  'README.ru.md': [
    'Открыть Seed Lab',
    'Скачать Seed Lab (HTML)',
    'Telegram-канал',
    'Поставить звезду на GitHub',
  ],
  'README.zh-CN.md': [
    '体验 Seed Lab',
    '下载 Seed Lab（HTML）',
    'Telegram 频道',
    '在 GitHub 上加星',
  ],
};
export const files = Object.keys(labels);
export function section(file, links) {
  const [web, offline, channel, star] = labels[file];
  const entries = [
    ...(links.demo ? [`[**${web} →**](${links.demo})`] : []),
    `[**${offline} ↓**](app/public/seed-lab.html?raw=true)`,
    `[${channel} · @vesperloom7](${links.telegram})`,
  ];
  if (links.repository) entries.push(`[${star}](${links.repository})`);
  return (
    '<!-- vesper-community:start -->\n' +
    entries.join(' &nbsp;·&nbsp; ') +
    '\n<!-- vesper-community:end -->'
  );
}
