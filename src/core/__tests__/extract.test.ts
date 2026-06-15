import { beforeAll, describe, expect, it } from 'vitest';

import { extract } from '../extract';

// extract() reads `figma.mixed` at call time; provide a minimal global stub.
beforeAll(() => {
  (globalThis as Record<string, unknown>).figma = { mixed: Symbol('mixed') };
});

function textNode() {
  return {
    type: 'TEXT',
    name: 'Label',
    characters: 'Hi',
    fontSize: 14,
    fontWeight: 500,
    lineHeight: { unit: 'AUTO' },
    fills: [
      { type: 'SOLID', visible: true, color: { r: 0.4, g: 0.4, b: 0.5 } },
    ],
    opacity: 1,
    width: 100,
    height: 20,
  } as unknown as SceneNode;
}

function vectorNode() {
  return {
    type: 'VECTOR',
    name: 'Path',
    fills: [{ type: 'SOLID', visible: true, color: { r: 1, g: 0, b: 0 } }],
    opacity: 1,
    width: 12,
    height: 12,
  } as unknown as SceneNode;
}

describe('extract', () => {
  it('does not derive a background from a text fill (color stays on typography)', () => {
    const ir = extract(textNode());
    expect(ir.type).toBe('text');
    expect(ir.style.background).toBeNull();
    expect(ir.text?.typography.color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('maps vector node types to the vector IR type and captures the fill color', () => {
    const ir = extract(vectorNode());
    expect(ir.type).toBe('vector');
    expect(ir.vectorColor).toBe('#ff0000');
    expect(ir.style.background).toBeNull();
  });
});
