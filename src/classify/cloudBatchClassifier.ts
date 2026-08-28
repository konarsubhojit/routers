import {CloudGranularity} from '../settings/appSettings';
import {RateLimiter, CloudResultCache} from './cloudCache';
import {buildCloudPayload, CloudClassificationResult, CloudPayload, hashCloudPayload} from './cloudMetadata';
import {FileMeta} from './types';

export class MissingApiKeyError extends Error {}
export class QuotaExceededError extends Error {}

export interface CloudBatchClassifierDeps {
  /** Returns the user's Gemini API key, or null if not configured. */
  apiKeyProvider: () => Promise<string | null>;
  /** Sends one batched request to the cloud model; returns one result per payload, in order. */
  classifyBatch: (payloads: CloudPayload[], apiKey: string) => Promise<CloudClassificationResult[]>;
  cache: CloudResultCache;
  /** Read on every classify() call so a settings change takes effect immediately. */
  granularityProvider: () => Promise<CloudGranularity> | CloudGranularity;
  rateLimiter?: RateLimiter;
  /** How long to coalesce concurrent classify() calls into a single batch request. */
  batchWindowMs?: number;
}

interface PendingEntry {
  payload: CloudPayload;
  resolvers: Array<{
    resolve: (result: CloudClassificationResult) => void;
    reject: (error: unknown) => void;
  }>;
}

/**
 * Opt-in Tier 3 cloud classifier. Batches concurrent requests to conserve
 * Gemini free-tier quota, rate-limits outgoing batches, caches results keyed
 * by a hash of the (metadata-only) request payload, and never sends file
 * contents — only filename/extension, and optionally size + MIME type.
 */
export class CloudBatchClassifier {
  private pending = new Map<string, PendingEntry>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly deps: CloudBatchClassifierDeps) {}

  async classify(file: FileMeta): Promise<CloudClassificationResult> {
    const granularity = await this.deps.granularityProvider();
    const payload = buildCloudPayload(file, granularity);
    const key = hashCloudPayload(payload);

    const cached = await this.deps.cache.get(key);
    if (cached != null) {
      return cached;
    }

    return new Promise<CloudClassificationResult>((resolve, reject) => {
      const existing = this.pending.get(key);
      if (existing != null) {
        existing.resolvers.push({resolve, reject});
        return;
      }

      this.pending.set(key, {payload, resolvers: [{resolve, reject}]});
      this.scheduleFlush();
    });
  }

  private scheduleFlush(): void {
    if (this.flushTimer != null) {
      return;
    }
    const windowMs = this.deps.batchWindowMs ?? 25;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flushPending();
    }, windowMs);
  }

  /** Sends any queued requests as a single batch immediately. Exposed for tests. */
  async flushPending(): Promise<void> {
    if (this.flushTimer != null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const batch = this.pending;
    this.pending = new Map();
    if (batch.size === 0) {
      return;
    }

    const entries = Array.from(batch.entries());
    const payloads = entries.map(([, entry]) => entry.payload);

    try {
      const apiKey = await this.deps.apiKeyProvider();
      if (apiKey == null || apiKey.length === 0) {
        throw new MissingApiKeyError('Cloud classification API key is not configured.');
      }

      if (this.deps.rateLimiter != null && !this.deps.rateLimiter.tryAcquire()) {
        throw new QuotaExceededError('Cloud classification rate limit exceeded.');
      }

      const results = await this.deps.classifyBatch(payloads, apiKey);
      if (results.length !== payloads.length) {
        throw new Error('Cloud classifier returned a mismatched result count.');
      }

      for (const [index, [key, entry]] of entries.entries()) {
        const result = results[index];
        if (result == null) {
          continue;
        }
        await this.deps.cache.set(key, result);
        for (const resolver of entry.resolvers) {
          resolver.resolve(result);
        }
      }
    } catch (error) {
      for (const [, entry] of entries) {
        entry.resolvers.forEach(resolver => resolver.reject(error));
      }
    }
  }
}
