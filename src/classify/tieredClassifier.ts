import {Classification, Classifier, FileMeta, UNKNOWN} from './types';

type TierOperation = 'isAvailable' | 'classify';

export interface TieredClassifierError {
  tierIndex: number;
  operation: TierOperation;
  error: unknown;
}

export interface TieredClassifierOptions {
  onError?: (tierError: TieredClassifierError) => void;
}

export function createTieredClassifier(
  tiers: Classifier[],
  options: TieredClassifierOptions = {},
): Classifier {
  const {onError} = options;

  function reportError(tierIndex: number, operation: TierOperation, error: unknown): void {
    onError?.({tierIndex, operation, error});
  }

  return {
    async isAvailable(): Promise<boolean> {
      for (const [index, tier] of tiers.entries()) {
        try {
          if (await tier.isAvailable()) {
            return true;
          }
        } catch (error: unknown) {
          reportError(index, 'isAvailable', error);
          continue;
        }
      }

      return false;
    },

    async classify(file: FileMeta): Promise<Classification> {
      for (const [index, tier] of tiers.entries()) {
        try {
          if (!(await tier.isAvailable())) {
            continue;
          }

          return await tier.classify(file);
        } catch (error: unknown) {
          reportError(index, 'classify', error);
          continue;
        }
      }

      return UNKNOWN;
    },
  };
}
