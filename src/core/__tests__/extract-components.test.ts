import { describe, expect, it } from 'vitest';

import { extractComponents } from '../extract-components';
import { generateRN } from '../generate-rn';
import type { IRNode } from '../ir';

const baseStyle = { background: null, cornerRadius: 0, opacity: 1 } as const;

function leaf(name: string, content = 'x'): IRNode {
  return {
    type: 'text',
    name,
    width: 'hug',
    height: 'hug',
    style: { ...baseStyle },
    text: {
      content,
      typography: {
        fontSize: 14,
        fontWeight: 400,
        lineHeight: null,
        color: null,
      },
    },
    children: [],
  };
}

function box(name: string, children: IRNode[]): IRNode {
  return {
    type: 'frame',
    name,
    width: 'hug',
    height: 'hug',
    style: { ...baseStyle },
    children,
  };
}

/** A card has 3 nodes (frame + 2 text), meeting the size threshold. */
function card(name = 'Card'): IRNode {
  return box(name, [leaf('Title', 'Hello'), leaf('Body', 'World')]);
}

describe('extractComponents', () => {
  it('hoists a repeated subtree and replaces occurrences with references', () => {
    const root = box('List', [card(), card()]);
    const { root: newRoot, components } = extractComponents(root);

    expect(components).toHaveLength(1);
    expect(
      newRoot.children.every((c) => c.componentName === components[0].name),
    ).toBe(true);
  });

  it('does not extract subtrees below the size threshold', () => {
    // Each child is a single text node (size 1); repeated but too small.
    const root = box('Row', [leaf('A'), leaf('A')]);
    expect(extractComponents(root).components).toHaveLength(0);
  });

  it('does not merge subtrees that differ only in text content', () => {
    const root = box('List', [
      box('Card', [leaf('Title', 'One'), leaf('Body', 'x')]),
      box('Card', [leaf('Title', 'Two'), leaf('Body', 'x')]),
    ]);
    expect(extractComponents(root).components).toHaveLength(0);
  });
});

describe('generateRN with extractComponents', () => {
  it('emits one sub-component referenced multiple times', () => {
    const root = box('List', [card(), card(), card()]);
    const code = generateRN(root, { extractComponents: true });
    expect(code).toContain('function Card()');
    expect(code).toContain('export function List()');
    expect(code.match(/<Card \/>/g)).toHaveLength(3);
  });

  it('inlines everything when extraction is disabled (default)', () => {
    const root = box('List', [card(), card()]);
    const code = generateRN(root);
    expect(code).not.toContain('function Card()');
    expect(code).not.toContain('<Card />');
  });
});
