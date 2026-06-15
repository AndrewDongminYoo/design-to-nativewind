// Collapses pure-vector groups into a single vector node so an icon made of
// many shapes becomes one <Svg> placeholder. Pure and unit-testable.
//
// A styled container (one with a background or corner radius) is real UI — a
// colored, rounded badge wrapping a logo, say — so it is kept as a View and only
// the unstyled vector group inside it collapses.

import type { IRNode } from './ir';

function isStyledContainer(node: IRNode): boolean {
  return node.style.background !== null || node.style.cornerRadius > 0;
}

export function collapseVectors(node: IRNode): IRNode {
  const children = node.children.map(collapseVectors);

  if (
    node.type === 'frame' &&
    children.length > 0 &&
    children.every((child) => child.type === 'vector') &&
    !isStyledContainer(node)
  ) {
    return { ...node, type: 'vector', children: [] };
  }

  // Preserve referential identity when no descendant collapsed — avoids
  // allocating a new node + children array on every untouched subtree.
  const changed = children.some((child, i) => child !== node.children[i]);
  return changed ? { ...node, children } : node;
}
