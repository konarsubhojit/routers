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
});
