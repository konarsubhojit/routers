import {CloudBatchClassifier, MissingApiKeyError, QuotaExceededError} from '../../src/classify/cloudBatchClassifier';
import {createInMemoryCloudCache, RateLimiter} from '../../src/classify/cloudCache';
import {CloudPayload} from '../../src/classify/cloudMetadata';

describe('CloudBatchClassifier', () => {
  it('batches concurrent classify() calls into a single request', async () => {
    const classifyBatch = jest.fn(async (payloads: CloudPayload[]) =>
      payloads.map(() => ({classification: 'PERMANENT' as const, confidence: 0.9})),
    );

    const classifier = new CloudBatchClassifier({
      apiKeyProvider: async () => 'test-key',
      classifyBatch,
      cache: createInMemoryCloudCache(),
      granularityProvider: () => 'filename',
      batchWindowMs: 10,
    });

    const results = await Promise.all([
      classifier.classify({path: 'downloads/passport.pdf'}),
      classifier.classify({path: 'downloads/ticket.pdf'}),
    ]);

    expect(classifyBatch).toHaveBeenCalledTimes(1);
    expect(classifyBatch.mock.calls[0][0]).toHaveLength(2);
    expect(results).toEqual([
      {classification: 'PERMANENT', confidence: 0.9},
      {classification: 'PERMANENT', confidence: 0.9},
    ]);
  });

  it('sends only filename metadata — never a full path or file contents', async () => {
    const classifyBatch = jest.fn(async (payloads: CloudPayload[]) =>
      payloads.map(() => ({classification: 'TEMPORARY' as const, confidence: 0.8})),
    );

    const classifier = new CloudBatchClassifier({
      apiKeyProvider: async () => 'test-key',
      classifyBatch,
      cache: createInMemoryCloudCache(),
      granularityProvider: () => 'filename',
      batchWindowMs: 5,
    });

    await classifier.classify({
      path: '/storage/emulated/0/Download/secret/boarding-pass.pdf',
      sizeBytes: 123456,
      mimeType: 'application/pdf',
    });

    const [payloads] = classifyBatch.mock.calls[0];
    expect(payloads).toEqual([{name: 'boarding-pass.pdf', extension: 'pdf'}]);
  });

  it('includes size and MIME type only under filename+metadata granularity', async () => {
    const classifyBatch = jest.fn(async (payloads: CloudPayload[]) =>
      payloads.map(() => ({classification: 'TEMPORARY' as const, confidence: 0.8})),
    );

    const classifier = new CloudBatchClassifier({
      apiKeyProvider: async () => 'test-key',
      classifyBatch,
      cache: createInMemoryCloudCache(),
      granularityProvider: () => 'filename+metadata',
      batchWindowMs: 5,
    });

    await classifier.classify({
      path: 'downloads/boarding-pass.pdf',
      sizeBytes: 123456,
      mimeType: 'application/pdf',
    });

    const [payloads] = classifyBatch.mock.calls[0];
    expect(payloads).toEqual([
      {name: 'boarding-pass.pdf', extension: 'pdf', sizeBytes: 123456, mimeType: 'application/pdf'},
    ]);
  });

  it('caches results keyed by metadata hash and avoids repeat calls', async () => {
    const classifyBatch = jest.fn(async (payloads: CloudPayload[]) =>
      payloads.map(() => ({classification: 'PERMANENT' as const, confidence: 0.95})),
    );
    const cache = createInMemoryCloudCache();

    const classifier = new CloudBatchClassifier({
      apiKeyProvider: async () => 'test-key',
      classifyBatch,
      cache,
      granularityProvider: () => 'filename',
      batchWindowMs: 5,
    });

    await classifier.classify({path: 'downloads/passport.pdf'});
    await classifier.classify({path: 'downloads/passport.pdf'});

    expect(classifyBatch).toHaveBeenCalledTimes(1);
  });

  it('rejects with MissingApiKeyError when no API key is configured', async () => {
    const classifier = new CloudBatchClassifier({
      apiKeyProvider: async () => null,
      classifyBatch: jest.fn(),
      cache: createInMemoryCloudCache(),
      granularityProvider: () => 'filename',
      batchWindowMs: 5,
    });

    await expect(classifier.classify({path: 'downloads/passport.pdf'})).rejects.toBeInstanceOf(
      MissingApiKeyError,
    );
  });

  it('rejects with QuotaExceededError once the rate limiter denies a batch', async () => {
    const rateLimiter = new RateLimiter(1, 60_000);
    const classifyBatch = jest.fn(async (payloads: CloudPayload[]) =>
      payloads.map(() => ({classification: 'PERMANENT' as const, confidence: 0.9})),
    );

    const classifier = new CloudBatchClassifier({
      apiKeyProvider: async () => 'test-key',
      classifyBatch,
      cache: createInMemoryCloudCache(),
      granularityProvider: () => 'filename',
      rateLimiter,
      batchWindowMs: 5,
    });

    await classifier.classify({path: 'downloads/a.pdf'});
    await expect(classifier.classify({path: 'downloads/b.pdf'})).rejects.toBeInstanceOf(
      QuotaExceededError,
    );
  });

  it('rejects all pending requests in a batch when the cloud call throws', async () => {
    const classifyBatch = jest.fn().mockRejectedValue(new Error('network down'));

    const classifier = new CloudBatchClassifier({
      apiKeyProvider: async () => 'test-key',
      classifyBatch,
      cache: createInMemoryCloudCache(),
      granularityProvider: () => 'filename',
      batchWindowMs: 5,
    });

    await expect(classifier.classify({path: 'downloads/a.pdf'})).rejects.toThrow('network down');
  });
});
