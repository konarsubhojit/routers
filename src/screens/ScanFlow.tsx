import React, {useCallback, useMemo, useState} from 'react';

import {aicoreClassifier} from '../classify/aicoreClassifier';
import {cloudClassifier} from '../classify/cloudClassifier';
import {mediapipeClassifier} from '../classify/mediapipeClassifier';
import {createTieredClassifier} from '../classify/tieredClassifier';
import {requestTreePermission, scanTree, sha256} from '../native';
import {NativeScannedFileMetadata} from '../native/types';
import {isOlderThanThreshold} from '../preprocess/ageFilter';
import {ExtensionBucket, extensionToBucket} from '../preprocess/extensionBuckets';
import {PickFolderScreen} from './PickFolderScreen';
import {ReviewScreen} from './ReviewScreen';
import {ScanProgressScreen} from './ScanProgressScreen';
import {BucketGroup, ReviewBadge, ScannedFileViewModel} from './types';

const BUCKET_ORDER: ExtensionBucket[] = [
  'Installers',
  'Archives',
  'Images',
  'Docs',
  'Audio',
  'Video',
  'Other',
];

type ScreenState = 'pick' | 'scan' | 'review';

interface ScanFlowProps {
  isDarkMode: boolean;
}

export function ScanFlow({isDarkMode}: ScanFlowProps) {
  const [screen, setScreen] = useState<ScreenState>('pick');
  const [scanError, setScanError] = useState<string | null>(null);
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const [cloudTierEnabled, setCloudTierEnabled] = useState(false);
  const [classifierDiagnostic, setClassifierDiagnostic] = useState(
    'Classifier diagnostics unavailable until first scan.',
  );
  const [groupedFiles, setGroupedFiles] = useState<BucketGroup[]>([]);
  const [selectedUris, setSelectedUris] = useState<Set<string>>(new Set());
  const [collapsedBuckets, setCollapsedBuckets] = useState<Set<ExtensionBucket>>(
    new Set(),
  );

  const tieredClassifier = useMemo(
    () =>
      createTieredClassifier([
        aicoreClassifier,
        mediapipeClassifier,
        ...(cloudTierEnabled ? [cloudClassifier] : []),
      ]),
    [cloudTierEnabled],
  );

  const handleScan = useCallback(async () => {
    setScreen('scan');
    setScanError(null);
    setPermissionMessage(null);

    try {
      const [aicoreAvailable, mediaPipeAvailable] = await Promise.all([
        aicoreClassifier.isAvailable(),
        mediapipeClassifier.isAvailable(),
      ]);

      setClassifierDiagnostic(
        aicoreAvailable
          ? 'AICore: available'
          : mediaPipeAvailable
            ? 'MediaPipe: available'
            : 'No on-device classifier available',
      );

      const treeUri = await requestTreePermission();
      if (treeUri.length === 0) {
        throw new Error('Permission is required to scan a folder.');
      }

      const scannedFiles = await scanTree(treeUri);
      const fileHashes = await hashFiles(scannedFiles);
      const duplicateUris = findDuplicateUris(fileHashes);

      const fileModels = await Promise.all(
        scannedFiles.map(async file => {
          const name = getDisplayName(file);
          const classification = await tieredClassifier.classify({path: name});
          const badges = buildBadges(file, duplicateUris, classification === 'TEMPORARY');

          return {
            uri: file.uri,
            name,
            bucket: extensionToBucket(name),
            badges,
            sizeBytes: file.sizeBytes,
          } satisfies ScannedFileViewModel;
        }),
      );

      const grouped = groupFilesByBucket(fileModels);
      setGroupedFiles(grouped);
      setCollapsedBuckets(new Set());
      setSelectedUris(
        new Set(fileModels.filter(file => file.badges.length > 0).map(file => file.uri)),
      );
      setScreen('review');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Scan failed.';
      if (isPermissionError(message)) {
        setPermissionMessage(message);
      } else {
        setScanError(message);
      }
      setGroupedFiles([]);
      setSelectedUris(new Set());
      setCollapsedBuckets(new Set());
      setScreen('pick');
    }
  }, [tieredClassifier]);

  const handleToggleFileSelected = useCallback((uri: string) => {
    setSelectedUris(current => {
      const next = new Set(current);
      if (next.has(uri)) {
        next.delete(uri);
      } else {
        next.add(uri);
      }
      return next;
    });
  }, []);

  const handleToggleBucketCollapsed = useCallback((bucket: ExtensionBucket) => {
    setCollapsedBuckets(current => {
      const next = new Set(current);
      if (next.has(bucket)) {
        next.delete(bucket);
      } else {
        next.add(bucket);
      }
      return next;
    });
  }, []);

  if (screen === 'scan') {
    return (
      <ScanProgressScreen
        classifierDiagnostic={classifierDiagnostic}
        isDarkMode={isDarkMode}
      />
    );
  }

  if (screen === 'review') {
    return (
      <ReviewScreen
        collapsedBuckets={collapsedBuckets}
        groupedFiles={groupedFiles}
        isDarkMode={isDarkMode}
        onRescan={handleScan}
        onToggleBucketCollapsed={handleToggleBucketCollapsed}
        onToggleFileSelected={handleToggleFileSelected}
        selectedUris={selectedUris}
      />
    );
  }

  return (
    <PickFolderScreen
      classifierDiagnostic={classifierDiagnostic}
      cloudTierEnabled={cloudTierEnabled}
      errorMessage={scanError}
      isDarkMode={isDarkMode}
      onCloudTierEnabledChange={setCloudTierEnabled}
      onScan={handleScan}
      permissionMessage={permissionMessage}
    />
  );
}

function isPermissionError(message: string): boolean {
  return /permission|denied|cancelled|canceled/.test(message.toLowerCase());
}

function getDisplayName(file: NativeScannedFileMetadata): string {
  const trimmedName = file.name?.trim();
  return trimmedName && trimmedName.length > 0 ? trimmedName : file.uri;
}

async function hashFiles(
  files: NativeScannedFileMetadata[],
): Promise<Map<string, string>> {
  const uriToHashEntries = await Promise.all(
    files.map(async file => {
      try {
        return [file.uri, await sha256(file.uri)] as const;
      } catch {
        return [file.uri, ''] as const;
      }
    }),
  );

  return new Map(uriToHashEntries);
}

function findDuplicateUris(uriToHash: Map<string, string>): Set<string> {
  const hashToUris = new Map<string, string[]>();

  for (const [uri, hash] of uriToHash.entries()) {
    if (hash.length === 0) {
      continue;
    }

    const uris = hashToUris.get(hash);
    if (uris != null) {
      uris.push(uri);
    } else {
      hashToUris.set(hash, [uri]);
    }
  }

  const duplicates = new Set<string>();
  for (const uris of hashToUris.values()) {
    if (uris.length > 1) {
      for (const uri of uris) {
        duplicates.add(uri);
      }
    }
  }

  return duplicates;
}

function buildBadges(
  file: NativeScannedFileMetadata,
  duplicateUris: Set<string>,
  isTemporary: boolean,
): ReviewBadge[] {
  const badges: ReviewBadge[] = [];

  if (duplicateUris.has(file.uri)) {
    badges.push('DUPLICATE');
  }

  if (file.mtime != null && isOlderThanThreshold(file.mtime)) {
    badges.push('OLD');
  }

  if (isTemporary) {
    badges.push('TEMPORARY');
  }

  return badges;
}

function groupFilesByBucket(files: ScannedFileViewModel[]): BucketGroup[] {
  const grouped = new Map<ExtensionBucket, ScannedFileViewModel[]>();
  for (const file of files) {
    const current = grouped.get(file.bucket);
    if (current == null) {
      grouped.set(file.bucket, [file]);
    } else {
      current.push(file);
    }
  }

  return BUCKET_ORDER
    .map(bucket => ({bucket, files: grouped.get(bucket) ?? []}))
    .filter(group => group.files.length > 0);
}
