import { randomUUID } from 'node:crypto';
import { limits } from '../config.mjs';
import { InputError } from './options.mjs';
export class JobQueue {
  constructor(run, { pending = limits.pending, timeout = limits.timeout } = {}) {
    Object.assign(this, {
      run,
      capacity: pending,
      timeout,
      jobs: new Map(),
      waiting: [],
      active: null,
      closed: false,
    });
  }
  submit(settings, parent = null, owner = '_shared') {
    if (this.closed) throw new InputError('Studio is shutting down.', 503);
    if (this.waiting.length >= this.capacity)
      throw new InputError('Render queue is full. Try again after a job finishes.', 429);
    if (
      owner !== '_shared' &&
      [...this.jobs.values()].filter(
        (j) => j.owner === owner && ['queued', 'running', 'cancelling'].includes(j.status),
      ).length >= 2
    )
      throw new InputError('A workspace can have two active or pending visual jobs.', 429);
    for (const [id, j] of this.jobs) {
      if (this.jobs.size < limits.remembered) break;
      if (!['queued', 'running', 'cancelling'].includes(j.status)) this.jobs.delete(id);
    }
    const j = {
      id: randomUUID(),
      status: 'queued',
      progress: 0,
      phase: 'Waiting for engine',
      settings,
      parent,
      owner,
      createdAt: new Date().toISOString(),
    };
    this.jobs.set(j.id, j);
    this.waiting.push(j);
    this.pump();
    return j;
  }
  async pump() {
    if (this.active || !this.waiting.length || this.closed) return;
    const job = this.waiting.shift(),
      ctl = new AbortController();
    this.active = { job, ctl };
    job.status = 'running';
    job.phase = 'Starting worker';
    const timer = setTimeout(() => ctl.abort(Error('Render deadline exceeded.')), this.timeout);
    timer.unref?.();
    try {
      const out = await this.run(job.settings, {
        id: job.id,
        parent: job.parent,
        owner: job.owner,
        signal: ctl.signal,
        onProgress: (progress, phase) => {
          job.progress = Math.max(0, Math.min(1, progress));
          job.phase = phase;
        },
      });
      job.status = 'done';
      job.progress = 1;
      job.phase = 'Complete';
      job.result = out;
    } catch (e) {
      job.status =
        ctl.signal.aborted && ctl.signal.reason?.message === 'Cancelled' ? 'cancelled' : 'failed';
      job.error = e.message;
      job.phase = job.status === 'cancelled' ? 'Cancelled' : 'Worker stopped';
    } finally {
      clearTimeout(timer);
      this.active = null;
      void this.pump();
    }
  }
  cancel(id) {
    const j = this.jobs.get(id);
    if (!j) throw new InputError('Unknown job.', 404);
    if (j.status === 'queued') {
      this.waiting = this.waiting.filter((x) => x !== j);
      j.status = 'cancelled';
      j.phase = 'Cancelled';
    } else if (j.status === 'running') {
      j.status = 'cancelling';
      this.active.ctl.abort(Error('Cancelled'));
    } else if (j.status !== 'cancelling') throw new InputError('Job is already terminal.', 409);
    return j;
  }
  shutdown() {
    this.closed = true;
    for (const j of [...this.waiting]) this.cancel(j.id);
    if (this.active) this.cancel(this.active.job.id);
  }
}
