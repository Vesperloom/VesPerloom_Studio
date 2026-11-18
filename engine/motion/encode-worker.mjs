import { parentPort, workerData } from 'node:worker_threads';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import HME from 'h264-mp4-encoder';
import pngjs from 'pngjs';
import { motionScene } from './scene.mjs';
import { reviewProxy } from './webm.mjs';
import { canonicalMp4 } from './container.mjs';
const { settings: s, work } = workerData,
  native = s.model === 'strata-motion',
  size = s.width * s.height,
  scene = native ? motionScene(s) : null;
const proxy = await reviewProxy(s);
const e = await HME.createH264MP4Encoder();
let fd;
try {
  e.width = s.width;
  e.height = s.height;
  e.frameRate = s.fps;
  e.speed = 5;
  e.quantizationParameter = 25;
  e.groupOfPictures = s.fps;
  e.initialize();
  const hash = createHash('sha256');
  if (!native) {
    const file = path.join(work, 'frames.rgb');
    if (fs.statSync(file).size !== size * 3 * s.frames)
      throw Error('Unexpected decoded video dimensions or frame count.');
    fd = fs.openSync(file, 'r');
  }
  const rgb = native ? null : Buffer.alloc(size * 3),
    rgba = native ? null : new Uint8Array(size * 4).fill(255);
  const tileWidth = 128,
    tileHeight = 72,
    strip = new pngjs.PNG({ width: tileWidth * 5, height: tileHeight });
  const milestones = Array.from({ length: 5 }, (_, k) => Math.round((k * (s.frames - 1)) / 4));
  for (let i = 0; i < s.frames; i++) {
    let pixels;
    if (native) pixels = scene.frame(i / (s.frames - 1));
    else {
      let pos = 0;
      while (pos < rgb.length) {
        const n = fs.readSync(fd, rgb, pos, rgb.length - pos, null);
        if (!n) throw Error('Incomplete decoded frame.');
        pos += n;
      }
      for (let j = 0; j < size; j++) {
        rgba[j * 4] = rgb[j * 3];
        rgba[j * 4 + 1] = rgb[j * 3 + 1];
        rgba[j * 4 + 2] = rgb[j * 3 + 2];
      }
      pixels = rgba;
    }
    const slot = milestones.indexOf(i);
    if (slot !== -1) {
      const sc = Math.max(tileWidth / s.width, tileHeight / s.height);
      for (let y = 0; y < tileHeight; y++)
        for (let x = 0; x < tileWidth; x++) {
          const sx = Math.min(s.width - 1, Math.floor((x + (s.width * sc - tileWidth) / 2) / sc)),
            sy = Math.min(s.height - 1, Math.floor((y + (s.height * sc - tileHeight) / 2) / sc));
          const a = (sy * s.width + sx) * 4,
            b = (strip.width * y + slot * tileWidth + x) * 4;
          for (let j = 0; j < 4; j++) strip.data[b + j] = pixels[a + j];
        }
    }
    if (i === 0)
      fs.writeFileSync(
        path.join(work, 'poster.png'),
        pngjs.PNG.sync.write(
          { width: s.width, height: s.height, data: Buffer.from(pixels.buffer) },
          { colorType: 2 },
        ),
      );
    hash.update(pixels);
    e.addFrameRgba(pixels);
    proxy.add(pixels);
    parentPort.postMessage({
      progress: (i + 1) / s.frames,
      phase: `Frame ${i + 1} of ${s.frames}`,
    });
  }
  fs.writeFileSync(path.join(work, 'review.webm'), proxy.finish());
  fs.writeFileSync(path.join(work, 'strip.png'), pngjs.PNG.sync.write(strip, { colorType: 2 }));
  e.finalize();
  fs.writeFileSync(path.join(work, 'clip.mp4'), canonicalMp4(e.FS.readFile(e.outputFilename)));
  parentPort.postMessage({
    done: true,
    pixelStreamSha256: hash.digest('hex'),
    tags: scene?.tags || { family: 'wan', palette: 'model-defined' },
  });
} finally {
  if (fd !== undefined) fs.closeSync(fd);
  e.delete();
}
