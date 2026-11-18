import { workerData, parentPort } from 'node:worker_threads';
import { writeFileSync } from 'node:fs';
import { render } from '../strata/index.mjs';
const { options, output } = workerData;
const { png, tags } = render(options, (progress, phase) =>
  parentPort.postMessage({ progress, phase }),
);
writeFileSync(output, png);
parentPort.postMessage({ done: true, tags });
