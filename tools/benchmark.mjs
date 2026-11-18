import { render } from '../engine/strata/index.mjs';
import { normalize } from '../server/runtime/options.mjs';
import os from 'node:os';
const options = normalize({ prompt: 'A ringed planet over copper desert dunes', seed: 41928 });
render(options);
const times = [];
for (let i = 0; i < 7; i++) {
  const start = performance.now();
  render({ ...options, seed: options.seed + i });
  times.push(Math.round(performance.now() - start));
}
const sorted = [...times].sort((a, b) => a - b);
console.log(
  JSON.stringify(
    {
      node: process.version,
      os: process.platform,
      arch: process.arch,
      logicalCpus: os.availableParallelism(),
      resolution: [options.width, options.height],
      steps: options.steps,
      warmup: 1,
      runs: times.length,
      samplesMs: times,
      medianMs: sorted[3],
      maximumMs: sorted.at(-1),
      processPeakRSSMiB: Math.round(process.resourceUsage().maxRSS / 1024),
    },
    null,
    2,
  ),
);
