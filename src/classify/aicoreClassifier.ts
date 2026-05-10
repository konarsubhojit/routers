import {classifyPathWithAICore, isAICoreAvailable} from '../native/AICoreClassifier';
import {Classification, Classifier, FileMeta, UNKNOWN} from './types';

const TEMPORARY_KEYWORDS = ['temporary', 'ticket', 'itinerary', 'boarding', 'reservation'];
const PERMANENT_KEYWORDS = ['permanent', 'identity', 'certificate', 'statement', 'contract'];

function containsAny(haystack: string, needles: readonly string[]): boolean {
  return needles.some(needle => haystack.includes(needle));
}

function mapLabelToClassification(label: string | null): Classification {
  if (label == null) {
    return UNKNOWN;
  }

  const normalizedLabel = label.trim().toLowerCase();
  if (normalizedLabel.length === 0) {
    return UNKNOWN;
  }

  if (containsAny(normalizedLabel, TEMPORARY_KEYWORDS)) {
    return 'TEMPORARY';
  }

  if (containsAny(normalizedLabel, PERMANENT_KEYWORDS)) {
    return 'PERMANENT';
  }

  return UNKNOWN;
}

export const aicoreClassifier: Classifier = {
  async isAvailable(): Promise<boolean> {
    try {
      return await isAICoreAvailable();
    } catch {
      return false;
    }
  },

  async classify(file: FileMeta): Promise<Classification> {
    try {
      const label = await classifyPathWithAICore(file.path);
      return mapLabelToClassification(label);
    } catch {
      return UNKNOWN;
    }
  },
};
