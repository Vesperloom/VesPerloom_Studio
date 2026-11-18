import fs from 'node:fs/promises';
import path from 'node:path';
import { videoSettings } from '../server/video/settings.mjs';
import { renderVideo } from '../server/video/execute.mjs';
import { videoRecipe } from '../server/video/store.mjs';
import { limits } from '../server/config.mjs';
import { readMotionRecipe } from '../server/video/recipe.mjs';
export async function videoCommand(cmd, id, v) {
  let expected = null,
    settings,
    parent = null;
  if (cmd === 'replay-video') {
    const recipe = JSON.parse(await fs.readFile(id, 'utf8'));
    settings = readMotionRecipe(recipe);
    expected = recipe.output.pixelStreamSha256;
    parent = recipe.parent ?? null;
  } else {
    const opts = { model: id, prompt: v.prompt, frame: v.frame, camera: v.camera, size: v.size };
    for (const k of ['seed', 'steps', 'drift', 'duration', 'strength', 'fps'])
      if (v[k] !== undefined) opts[k] = Number(v[k]);
    settings = videoSettings(opts);
  }
  const dest = path.resolve(v.out || 'shot.mp4');
  if (path.extname(dest).toLowerCase() !== '.mp4') throw Error('Video output must end in .mp4.');
  await fs.mkdir(path.dirname(dest), { recursive: true });
  const work = await fs.mkdtemp(path.join(path.dirname(dest), '.shot-')),
    ctl = new AbortController();
  const stop = () => ctl.abort(Error('Interrupted'));
  process.once('SIGINT', stop);
  const timer = setTimeout(() => ctl.abort(Error('Video deadline exceeded.')), limits.timeout);
  timer.unref();
  try {
    const t = performance.now(),
      result = await renderVideo(settings, work, { signal: ctl.signal });
    if (expected && expected !== result.pixelStreamSha256)
      throw Error('Replay pixel stream differs; original output was not overwritten.');
    const recipe = await videoRecipe(
      work,
      settings,
      result,
      Math.round(performance.now() - t),
      parent,
    );
    await fs.rename(path.join(work, 'clip.mp4'), dest);
    await fs.copyFile(path.join(work, 'poster.png'), dest + '.poster.png');
    await fs.writeFile(dest + '.recipe.json', JSON.stringify(recipe, null, 2) + '\n');
    console.log(
      `${dest}\n${settings.frames} frames · ${settings.fps} fps · ${settings.width}×${settings.height}\n${dest}.recipe.json`,
    );
  } finally {
    clearTimeout(timer);
    process.removeListener('SIGINT', stop);
    await fs.rm(work, { recursive: true, force: true });
  }
}
