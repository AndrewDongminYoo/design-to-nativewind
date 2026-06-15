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

interface NodeMeta {
  size: number;
  key: string;
}

/** Bottom-up: compute size + canonical key once per node, accumulate counts. */
function analyze(
  node: IRNode,
  meta: WeakMap<IRNode, NodeMeta>,
  counts: Map<string, number>,
): NodeMeta {
  const childMetas = node.children.map((child) => analyze(child, meta, counts));
  const size = 1 + childMetas.reduce((sum, m) => sum + m.size, 0);
  // Local fields only — child keys are already memoized, so we splice them in
  // by reference instead of re-stringifying nested signatures at every level.
  const localSig = JSON.stringify({
    type: node.type,
    layout: node.layout ?? null,
    width: node.width,
    height: node.height,
    style: node.style,
    text: node.text ?? null,
    vectorColor: node.vectorColor ?? null,
    svg: node.svg?.jsx ?? null,
  });
  const key = `${localSig}[${childMetas.map((m) => m.key).join(',')}]`;
  const m: NodeMeta = { size, key };
  meta.set(node, m);
  if (size >= MIN_SUBTREE_SIZE) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return m;
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
  meta: WeakMap<IRNode, NodeMeta>,
  counts: Map<string, number>,
  registry: Registry,
): IRNode {
  const m = meta.get(node);
  if (m && m.size >= MIN_SUBTREE_SIZE && (counts.get(m.key) ?? 0) >= 2) {
    const name = registry.getOrCreate(m.key, node);
    return { ...node, componentName: name, children: [] };
  }
  return {
    ...node,
    children: node.children.map((child) =>
      transform(child, meta, counts, registry),
    ),
  };
}

export function extractComponents(root: IRNode): ExtractionResult {
  const meta = new WeakMap<IRNode, NodeMeta>();
  const counts = new Map<string, number>();
  analyze(root, meta, counts);

  const registry = new Registry(toComponentName(root.name || 'Component'));
  // Skip the root itself (its count is 1 — it cannot hoist into itself) and
  // recurse via transform on its children.
  const newRoot = {
    ...root,
    children: root.children.map((child) =>
      transform(child, meta, counts, registry),
    ),
  };

  return { root: newRoot, components: registry.components };
}
