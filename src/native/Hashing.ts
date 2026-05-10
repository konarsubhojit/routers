import {requireNativeModule} from './requireNativeModule';

interface HashingModuleSpec {
  sha256(contentUri: string): Promise<string>;
}

function getHashingModule(): HashingModuleSpec {
  return requireNativeModule<HashingModuleSpec>('HashingModule');
}

export async function sha256(contentUri: string): Promise<string> {
  return getHashingModule().sha256(contentUri);
}
