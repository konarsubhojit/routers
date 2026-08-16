import {CloudClassificationResult} from './cloudMetadata';

export interface CloudResultCache {
  get(key: string): Promise<CloudClassificationResult | null>;
  set(key: string, result: CloudClassificationResult): Promise<void>;
}

/** Simple in-memory cache. A persistent implementation can wrap AsyncStorage. */
export function createInMemoryCloudCache(): CloudResultCache {
  const map = new Map<string, CloudClassificationResult>();
  return {
    async get(key: string) {
      return map.has(key) ? (map.get(key) as CloudClassificationResult) : null;
    },
    async set(key: string, result: CloudClassificationResult) {
      map.set(key, result);
    },
  };
}

/** Basic fixed-window rate limiter: allows up to `maxRequests` per `windowMs`. */
export class RateLimiter {
  private windowStart = 0;
  private countInWindow = 0;

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  tryAcquire(): boolean {
    const currentTime = this.now();
    if (currentTime - this.windowStart >= this.windowMs) {
      this.windowStart = currentTime;
      this.countInWindow = 0;
    }

    if (this.countInWindow >= this.maxRequests) {
      return false;
    }

    this.countInWindow += 1;
    return true;
  }
}
