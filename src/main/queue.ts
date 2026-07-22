/**
 * The generation queue: single worker, strict priority then FIFO. Contents are
 * reconciled against needs derived from campaign state (core/generation/needs)
 * — jobs are never persisted; reloading a campaign re-derives them.
 */
import { buildRequest } from '@core/generation/builders';
import type { LlmEngine } from '@core/generation/engine';
import type { JobPriority, JobRequest, JobSnapshot, JobStatus } from '@core/generation/jobs';
import { parseJobOutput } from '@core/generation/outputs';
import type { Campaign } from '@core/model/schemas';

const PRIORITY_ORDER: Record<JobPriority, number> = { interactive: 0, high: 1, background: 2 };
const MAX_ATTEMPTS = 3;

interface InternalJob {
  request: JobRequest;
  label: string;
  status: JobStatus;
  attempts: number;
  error?: string;
  sequence: number;
}

export interface QueueDeps {
  getEngine: () => LlmEngine | null;
  getCampaign: () => Campaign | null;
  /** Apply a finished job's output to state (dispatches applyJobResult). */
  applyResult: (request: JobRequest, output: unknown) => void;
  onChange: () => void;
}

export class GenerationQueue {
  private jobs = new Map<string, InternalJob>();
  private running: InternalJob | null = null;
  private sequence = 0;

  constructor(private readonly deps: QueueDeps) {}

  /** Sync queue contents with the needed-jobs list derived from state. */
  reconcile(needed: Array<JobRequest & { label: string }>): void {
    const neededKeys = new Set(needed.map((n) => n.key));
    let changed = false;
    for (const [key, existing] of this.jobs) {
      if (!neededKeys.has(key) && existing !== this.running) {
        this.jobs.delete(key);
        changed = true;
      }
    }
    for (const request of needed) {
      const existing = this.jobs.get(request.key);
      if (!existing) {
        this.sequence += 1;
        this.jobs.set(request.key, {
          request,
          label: request.label,
          status: 'pending',
          attempts: 0,
          sequence: this.sequence,
        });
        changed = true;
      } else if (existing.status === 'pending' && existing.request.priority !== request.priority) {
        existing.request = request;
        changed = true;
      }
    }
    if (changed) this.deps.onChange();
    void this.pump();
  }

  retry(key: string): void {
    const jobItem = this.jobs.get(key);
    if (jobItem && jobItem.status === 'failed') {
      jobItem.status = 'pending';
      jobItem.attempts = 0;
      jobItem.error = undefined;
      this.deps.onChange();
      void this.pump();
    }
  }

  snapshots(): JobSnapshot[] {
    return [...this.jobs.values()]
      .sort(
        (a, b) =>
          PRIORITY_ORDER[a.request.priority] - PRIORITY_ORDER[b.request.priority] ||
          a.sequence - b.sequence,
      )
      .map((jobItem) => ({
        key: jobItem.request.key,
        type: jobItem.request.type,
        priority: jobItem.request.priority,
        status: jobItem.status,
        attempts: jobItem.attempts,
        error: jobItem.error,
        label: jobItem.label,
      }));
  }

  /** Resolves when the queue has nothing pending or running (used in tests). */
  async idle(): Promise<void> {
    while (this.running || this.nextPending()) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  private nextPending(): InternalJob | undefined {
    return [...this.jobs.values()]
      .filter((jobItem) => jobItem.status === 'pending')
      .sort(
        (a, b) =>
          PRIORITY_ORDER[a.request.priority] - PRIORITY_ORDER[b.request.priority] ||
          a.sequence - b.sequence,
      )[0];
  }

  private async pump(): Promise<void> {
    if (this.running) return;
    const engine = this.deps.getEngine();
    const campaign = this.deps.getCampaign();
    if (!engine || !campaign) return;
    const jobItem = this.nextPending();
    if (!jobItem) return;

    this.running = jobItem;
    jobItem.status = 'running';
    this.deps.onChange();
    const campaignId = campaign.id;

    try {
      const output = await this.execute(engine, campaign, jobItem);
      // Remove the finished job and clear `running` BEFORE applying: the
      // post-apply reconcile must be able to re-derive the same key if the
      // need persists (e.g. a batch application that made no progress).
      this.jobs.delete(jobItem.request.key);
      this.running = null;
      // Discard results that arrive for a different campaign (load/close race).
      if (this.deps.getCampaign()?.id === campaignId) {
        this.deps.applyResult(jobItem.request, output);
      }
    } catch (error) {
      this.jobs.set(jobItem.request.key, jobItem);
      jobItem.status = 'failed';
      jobItem.error = (error as Error).message;
    } finally {
      if (this.running === jobItem) this.running = null;
      this.deps.onChange();
      void this.pump();
    }
  }

  /** Attempt loop: initial call → one repair re-prompt → one fresh retry. */
  private async execute(
    engine: LlmEngine,
    campaign: Campaign,
    jobItem: InternalJob,
  ): Promise<unknown> {
    const request = buildRequest(campaign, jobItem.request);
    let lastError: Error = new Error('Generation failed');
    let repairText: string | null = null;

    while (jobItem.attempts < MAX_ATTEMPTS) {
      jobItem.attempts += 1;
      const attemptRequest =
        repairText === null
          ? request
          : {
              ...request,
              messages: [
                ...request.messages,
                { role: 'assistant' as const, content: repairText },
                {
                  role: 'user' as const,
                  content: `Your previous response was invalid: ${lastError.message}\nRespond again, following the required format exactly.`,
                },
              ],
            };
      let rawText: string;
      try {
        rawText = (await engine.complete(attemptRequest)).text;
      } catch (error) {
        lastError = error as Error;
        repairText = null; // transport error: plain retry
        continue;
      }
      try {
        return parseJobOutput(jobItem.request.type, rawText);
      } catch (error) {
        lastError = error as Error;
        // First parse failure → repair re-prompt; afterwards → fresh retry.
        repairText = repairText === null ? rawText : null;
      }
    }
    throw lastError;
  }
}
