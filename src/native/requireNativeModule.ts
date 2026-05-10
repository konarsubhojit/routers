import {NativeModules} from 'react-native';

export function requireNativeModule<T>(name: string): T {
  const module = (NativeModules as Record<string, unknown>)[name] as
    | T
    | undefined;
  if (module == null) {
    throw new Error(`${name} is not available on this platform.`);
  }

  return module;
}
