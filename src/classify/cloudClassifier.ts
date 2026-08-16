import {appSettingsStore} from '../settings';
import {CloudBatchClassifier} from './cloudBatchClassifier';
import {createInMemoryCloudCache, RateLimiter} from './cloudCache';
import {classifyBatchWithGemini} from './geminiCloudClient';
import {Classification, Classifier, FileMeta} from './types';

const CONFIDENCE_THRESHOLD = 0.6;

/** Gemini free-tier rate limit is generous but finite; keep batches modest. */
const MAX_REQUESTS_PER_MINUTE = 15;
const RATE_LIMIT_WINDOW_MS = 60_000;

function getGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY;
  return key != null && key.length > 0 ? key : null;
}

const sharedCache = createInMemoryCloudCache();
const sharedRateLimiter = new RateLimiter(MAX_REQUESTS_PER_MINUTE, RATE_LIMIT_WINDOW_MS);

const batchClassifier = new CloudBatchClassifier({
  apiKeyProvider: async () => getGeminiApiKey(),
  classifyBatch: classifyBatchWithGemini,
  cache: sharedCache,
  rateLimiter: sharedRateLimiter,
  granularityProvider: async () => (await appSettingsStore.load()).cloudGranularity,
});

/**
 * Opt-in Tier 3 cloud classifier (`ARCHITECTURE.md`). Only used when the
 * user has explicitly enabled cloud classification in Settings; degrades to
 * `UNKNOWN` (letting the caller keep the on-device result) on any error,
 * missing API key, or quota exhaustion.
 */
export const cloudClassifier: Classifier = {
  async isAvailable(): Promise<boolean> {
    const settings = await appSettingsStore.load();
    return settings.cloudClassificationEnabled && getGeminiApiKey() != null;
  },

  async classify(file: FileMeta): Promise<Classification> {
    const settings = await appSettingsStore.load();
    if (!settings.cloudClassificationEnabled) {
      return 'UNKNOWN';
    }

    const result = await batchClassifier.classify(file);
    if (result.confidence < CONFIDENCE_THRESHOLD) {
      return 'UNKNOWN';
    }
    return result.classification;
  },
};

export {CONFIDENCE_THRESHOLD};
