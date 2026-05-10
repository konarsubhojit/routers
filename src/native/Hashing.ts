import {NativeModules} from 'react-native';

interface HashingModuleSpec {
  sha256(contentUri: string): Promise<string>;
}

function getHashingModule(): HashingModuleSpec {
  const module = NativeModules.HashingModule as HashingModuleSpec | undefined;
  if (module == null) {
    throw new Error('HashingModule is not available on this platform.');
  }

  return module;
}

export async function sha256(contentUri: string): Promise<string> {
  return getHashingModule().sha256(contentUri);
}
