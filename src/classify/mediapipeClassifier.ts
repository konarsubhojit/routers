import {
  classifyTextWithMediaPipe,
  isMediaPipeModelAvailable,
} from '../native/MediaPipeClassifier';
import {Classification, Classifier, FileMeta, UNKNOWN} from './types';

function extractTextCandidate(file: FileMeta): string | null {
  const candidate = file.path.trim();
  if (candidate.length === 0) {
    return null;
  }

  if (
    candidate.startsWith('content://') ||
    candidate.startsWith('file://') ||
    candidate.includes('/') ||
    candidate.includes('\\')
  ) {
    return null;
  }

  return candidate;
}

const TEMPORARY_KEYWORDS = [
  'temporary',
  'boarding',
  'ticket',
  'itinerary',
  'travel',
  'reservation',
];

const PERMANENT_KEYWORDS = [
  'permanent',
  'identity',
  'certificate',
  'statement',
  'contract',
];

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

  const labelWithSpaces = normalizedLabel.replace(/[_-]+/g, ' ');
  const hasStandaloneId = /\bid\b/.test(labelWithSpaces);
  if (hasStandaloneId || containsAny(normalizedLabel, PERMANENT_KEYWORDS)) {
    return 'PERMANENT';
  }

  return UNKNOWN;
}

export const mediapipeClassifier: Classifier = {
  async isAvailable(): Promise<boolean> {
    try {
      return await isMediaPipeModelAvailable();
    } catch {
      return false;
    }
  },

  async classify(file: FileMeta): Promise<Classification> {
    try {
      const textCandidate = extractTextCandidate(file);
      if (textCandidate == null) {
        return UNKNOWN;
      }

      const label = await classifyTextWithMediaPipe(textCandidate);
      return mapLabelToClassification(label);
    } catch {
      return UNKNOWN;
    }
  },
};
