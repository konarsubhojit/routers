import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppSettingsStore, KeyValueStorage} from './appSettings';

const asyncStorageAdapter: KeyValueStorage = {
  getItem: key => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
};

/** Production settings store backed by `@react-native-async-storage/async-storage`. */
export const appSettingsStore = new AppSettingsStore(asyncStorageAdapter);

export * from './appSettings';
