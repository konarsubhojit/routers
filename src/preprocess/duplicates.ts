export interface HashFile {
  path: string;
  hash: string;
}

export function groupByHash(files: HashFile[]): Map<string, HashFile[]> {
  const grouped = new Map<string, HashFile[]>();

  for (const file of files) {
    const existing = grouped.get(file.hash);
    if (existing) {
      existing.push(file);
      continue;
    }

    grouped.set(file.hash, [file]);
  }

  return grouped;
}

export function duplicateHashes(groupedByHash: Map<string, HashFile[]>): Set<string> {
  const duplicates = new Set<string>();

  for (const [hash, files] of groupedByHash) {
    if (files.length > 1) {
      duplicates.add(hash);
    }
  }

  return duplicates;
}

export function flagDuplicates(files: HashFile[]): Array<HashFile & {isDuplicate: boolean}> {
  const grouped = groupByHash(files);
  const duplicates = duplicateHashes(grouped);

  return files.map(file => ({
    ...file,
    isDuplicate: duplicates.has(file.hash),
  }));
}
