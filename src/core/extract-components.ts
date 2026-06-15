// Hoists repeated IR subtrees into reusable sub-components. Pure and testable.
//
// A subtree is extracted when its structural signature (everything that affects
// the rendered output, ignoring the layer name) repeats >= 2 times and the
// subtree is non-trivial (>= MIN_SUBTREE_SIZE nodes). Extraction is top-down, so
// the largest enclosing repeated subtree wins and nested repeats inside an
// extracted component stay inline (conservative baseline).

import type { IRNode } from './ir';
import { toComponentName } from './names';

const MIN_SUBTREE_SIZE = 3;

export interface ExtractedComponent {
  name: string;
  node: IRNode;
}

export interface ExtractionResult {
  /** the tree with repeated subtrees replaced by `componentName` reference nodes */
  root: IRNode;
  /** the hoisted sub-component definitions, in first-seen order */
  components: ExtractedComponent[];
}

function subtreeSize(node: IRNode): number {
  return 1 + node.children.reduce((sum, child) => sum + subtreeSize(child), 0);
}

/** Structural signature; excludes the layer name so siblings merge regardless of naming. */
function signature(node: IRNode): unknown {
  return {
    type: node.type,
    layout: node.layout ?? null,
    width: node.width,
    height: node.height,
    style: node.style,
    text: node.text ?? null,
    children: node.children.map(signature),
  };
}

function canonicalKey(node: IRNode): string {
  return JSON.stringify(signature(node));
}

function countSubtrees(node: IRNode, counts: Map<string, number>): void {
  if (subtreeSize(node) >= MIN_SUBTREE_SIZE) {
    const key = canonicalKey(node);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  node.children.forEach((child) => countSubtrees(child, counts));
}

class Registry {
  private readonly byKey = new Map<string, string>();
  private readonly used = new Set<string>();
  readonly components: ExtractedComponent[] = [];

  constructor(reserved: string) {
    this.used.add(reserved);
  }

  getOrCreate(key: string, node: IRNode): string {
    const existing = this.byKey.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const base = toComponentName(node.name || 'Item');
    let name = base;
    let suffix = 2;
    while (this.used.has(name)) {
      name = `${base}${suffix++}`;
    }
    this.used.add(name);
    this.byKey.set(key, name);
    this.components.push({ name, node });
    return name;
  }
}

function transform(
  node: IRNode,
  counts: Map<string, number>,
  registry: Registry,
): IRNode {
  if (subtreeSize(node) >= MIN_SUBTREE_SIZE) {
    const key = canonicalKey(node);
    if ((counts.get(key) ?? 0) >= 2) {
      const name = registry.getOrCreate(key, node);
      return { ...node, componentName: name, children: [] };
    }
  }
  return {
    ...node,
    children: node.children.map((child) => transform(child, counts, registry)),
  };
}

export function extractComponents(root: IRNode): ExtractionResult {
  const counts = new Map<string, number>();
  countSubtrees(root, counts);

  const registry = new Registry(toComponentName(root.name || 'Component'));
  const newRoot = {
    ...root,
    children: root.children.map((child) => transform(child, counts, registry)),
  };

  return { root: newRoot, components: registry.components };
}
