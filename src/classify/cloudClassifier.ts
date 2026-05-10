import {Classification, Classifier, FileMeta} from './types';

const UNKNOWN: Classification = 'UNKNOWN';

export const cloudClassifier: Classifier = {
  async isAvailable(): Promise<boolean> {
    return false;
  },
  async classify(_file: FileMeta): Promise<Classification> {
    return UNKNOWN;
  },
};
