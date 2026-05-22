export type CollisionPolicy = 'skip' | 'rename' | 'overwrite';

export const DEFAULT_COLLISION_POLICY: CollisionPolicy = 'rename';

/**
 * Generates a suffixed name for a file when a name collision is detected.
 *
 * Examples:
 *   resolveCollisionName('invoice.pdf', 1)  → 'invoice (1).pdf'
 *   resolveCollisionName('invoice.pdf', 2)  → 'invoice (2).pdf'
 *   resolveCollisionName('archive', 1)      → 'archive (1)'
 *   resolveCollisionName('.bashrc', 1)      → '.bashrc (1)'
 */
export function resolveCollisionName(originalName: string, index: number): string {
  const lastDot = originalName.lastIndexOf('.');
  if (lastDot <= 0) {
    return `${originalName} (${index})`;
  }
  return `${originalName.slice(0, lastDot)} (${index})${originalName.slice(lastDot)}`;
}
