import {Classification, Classifier, FileMeta} from './types';

export function createTieredClassifier(
  [tier1, tier2, tier3]: [Classifier, Classifier, Classifier],
): Classifier {
  const tiers = [tier1, tier2, tier3];

  return {
    async isAvailable(): Promise<boolean> {
      for (const tier of tiers) {
        try {
          if (await tier.isAvailable()) {
            return true;
          }
        } catch {
          continue;
        }
      }

      return false;
    },

    async classify(file: FileMeta): Promise<Classification> {
      for (const tier of tiers) {
        try {
          if (!(await tier.isAvailable())) {
            continue;
          }

          return await tier.classify(file);
        } catch {
          continue;
        }
      }

      return 'UNKNOWN';
    },
  };
}
