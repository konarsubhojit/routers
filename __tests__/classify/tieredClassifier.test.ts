import {createTieredClassifier} from '../../src/classify/tieredClassifier';
import {Classifier} from '../../src/classify/types';

const file = {path: 'downloads/ticket.pdf'};

function buildClassifier(
  isAvailable: () => Promise<boolean>,
  classify: () => Promise<'TEMPORARY' | 'PERMANENT' | 'UNKNOWN'>,
): Classifier {
  return {
    isAvailable,
    classify: async () => classify(),
  };
}

describe('createTieredClassifier', () => {
  it('isAvailable returns true when any tier is available', async () => {
    const tiered = createTieredClassifier([
      buildClassifier(jest.fn().mockResolvedValue(false), jest.fn().mockResolvedValue('UNKNOWN')),
      buildClassifier(jest.fn().mockResolvedValue(true), jest.fn().mockResolvedValue('PERMANENT')),
      buildClassifier(jest.fn().mockResolvedValue(false), jest.fn().mockResolvedValue('UNKNOWN')),
    ]);

    await expect(tiered.isAvailable()).resolves.toBe(true);
  });

  it('isAvailable returns false when all tiers are unavailable', async () => {
    const tiered = createTieredClassifier([
      buildClassifier(jest.fn().mockResolvedValue(false), jest.fn().mockResolvedValue('UNKNOWN')),
      buildClassifier(jest.fn().mockResolvedValue(false), jest.fn().mockResolvedValue('UNKNOWN')),
      buildClassifier(jest.fn().mockResolvedValue(false), jest.fn().mockResolvedValue('UNKNOWN')),
    ]);

    await expect(tiered.isAvailable()).resolves.toBe(false);
  });

  it('isAvailable falls through errors and checks remaining tiers', async () => {
    const tiered = createTieredClassifier([
      buildClassifier(
        jest.fn().mockRejectedValue(new Error('tier1 unavailable check failed')),
        jest.fn().mockResolvedValue('UNKNOWN'),
      ),
      buildClassifier(jest.fn().mockResolvedValue(true), jest.fn().mockResolvedValue('PERMANENT')),
      buildClassifier(jest.fn().mockResolvedValue(false), jest.fn().mockResolvedValue('UNKNOWN')),
    ]);

    await expect(tiered.isAvailable()).resolves.toBe(true);
  });

  it('uses the highest-priority available tier', async () => {
    const tier1Classify = jest.fn().mockResolvedValue('TEMPORARY');
    const tier2Classify = jest.fn().mockResolvedValue('PERMANENT');

    const tiered = createTieredClassifier([
      buildClassifier(jest.fn().mockResolvedValue(true), tier1Classify),
      buildClassifier(jest.fn().mockResolvedValue(true), tier2Classify),
      buildClassifier(jest.fn().mockResolvedValue(false), jest.fn().mockResolvedValue('UNKNOWN')),
    ]);

    await expect(tiered.classify(file)).resolves.toBe('TEMPORARY');
    expect(tier1Classify).toHaveBeenCalledTimes(1);
    expect(tier2Classify).not.toHaveBeenCalled();
  });

  it('falls back when a higher-priority tier is unavailable', async () => {
    const tier2Classify = jest.fn().mockResolvedValue('PERMANENT');

    const tiered = createTieredClassifier([
      buildClassifier(jest.fn().mockResolvedValue(false), jest.fn().mockResolvedValue('UNKNOWN')),
      buildClassifier(jest.fn().mockResolvedValue(true), tier2Classify),
      buildClassifier(jest.fn().mockResolvedValue(false), jest.fn().mockResolvedValue('UNKNOWN')),
    ]);

    await expect(tiered.classify(file)).resolves.toBe('PERMANENT');
    expect(tier2Classify).toHaveBeenCalledTimes(1);
  });

  it('falls back when a higher-priority available tier throws', async () => {
    const tier2Classify = jest.fn().mockResolvedValue('TEMPORARY');

    const tiered = createTieredClassifier([
      buildClassifier(jest.fn().mockResolvedValue(true), jest.fn().mockRejectedValue(new Error('tier1 failed'))),
      buildClassifier(jest.fn().mockResolvedValue(true), tier2Classify),
      buildClassifier(jest.fn().mockResolvedValue(false), jest.fn().mockResolvedValue('UNKNOWN')),
    ]);

    await expect(tiered.classify(file)).resolves.toBe('TEMPORARY');
    expect(tier2Classify).toHaveBeenCalledTimes(1);
  });

  it('falls back when isAvailable throws during classify', async () => {
    const tier2Classify = jest.fn().mockResolvedValue('PERMANENT');

    const tiered = createTieredClassifier([
      buildClassifier(
        jest.fn().mockRejectedValue(new Error('tier1 unavailable check failed')),
        jest.fn().mockResolvedValue('TEMPORARY'),
      ),
      buildClassifier(jest.fn().mockResolvedValue(true), tier2Classify),
      buildClassifier(jest.fn().mockResolvedValue(false), jest.fn().mockResolvedValue('UNKNOWN')),
    ]);

    await expect(tiered.classify(file)).resolves.toBe('PERMANENT');
    expect(tier2Classify).toHaveBeenCalledTimes(1);
  });

  it('returns UNKNOWN when all tiers are unavailable or error out', async () => {
    const tiered = createTieredClassifier([
      buildClassifier(jest.fn().mockResolvedValue(false), jest.fn().mockResolvedValue('TEMPORARY')),
      buildClassifier(jest.fn().mockResolvedValue(true), jest.fn().mockRejectedValue(new Error('tier2 failed'))),
      buildClassifier(
        jest.fn().mockRejectedValue(new Error('tier3 unavailable check failed')),
        jest.fn().mockResolvedValue('PERMANENT'),
      ),
    ]);

    await expect(tiered.classify(file)).resolves.toBe('UNKNOWN');
  });

  it('reports tier errors through onError callback', async () => {
    const onError = jest.fn();

    const tiered = createTieredClassifier(
      [
        buildClassifier(jest.fn().mockRejectedValue(new Error('tier1 check failed')), jest.fn().mockResolvedValue('UNKNOWN')),
        buildClassifier(jest.fn().mockResolvedValue(true), jest.fn().mockResolvedValue('TEMPORARY')),
      ],
      {onError},
    );

    await expect(tiered.classify(file)).resolves.toBe('TEMPORARY');
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        tierIndex: 0,
        operation: 'classify',
      }),
    );
  });
});
