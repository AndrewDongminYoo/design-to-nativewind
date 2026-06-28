import { describe, expect, it } from 'vitest';

import type { IRNode } from '../ir';
import { generateRN, generateRNMulti } from '../generate-rn';
import { mapClasses, snapSpacing, spacingClass } from '../map-styles';

const baseStyle = { background: null, cornerRadius: 0, opacity: 1 } as const;

function frame(partial: Partial<IRNode>): IRNode {
  return {
    type: 'frame',
    name: 'Frame',
    width: 'hug',
    height: 'hug',
    style: { ...baseStyle },
    children: [],
    ...partial,
  };
}

describe('snapSpacing', () => {
  it('snaps exact scale values', () => {
    expect(snapSpacing(16)).toBe('4');
    expect(snapSpacing(0)).toBe('0');
  });

  it('returns null when no step is within tolerance', () => {
    expect(snapSpacing(14)).toBeNull();
  });
});

describe('spacingClass', () => {
  it('emits a scale token when snappable', () => {
    expect(spacingClass('p', 16)).toBe('p-4');
  });

  it('emits an arbitrary value when not snappable', () => {
    expect(spacingClass('p', 14)).toBe('p-[14px]');
  });
});

describe('mapClasses', () => {
  it('maps auto layout to flex utilities', () => {
    const node = frame({
      layout: {
        direction: 'row',
        justify: 'space-between',
        align: 'center',
        gap: 8,
        padding: { top: 16, right: 16, bottom: 16, left: 16 },
      },
    });
    const classes = mapClasses(node);
    expect(classes).toContain('flex-row');
    expect(classes).toContain('justify-between');
    expect(classes).toContain('items-center');
    expect(classes).toContain('gap-2');
    expect(classes).toContain('p-4');
  });

  it('maps a background hex to a color token when provided', () => {
    const node = frame({
      style: { background: '#3b82f6', cornerRadius: 0, opacity: 1 },
    });
    expect(
      mapClasses(node, { colorTokens: { '#3b82f6': 'primary' } }),
    ).toContain('bg-primary');
    // Falls back to an arbitrary value when the hex is not in the token map.
    expect(mapClasses(node)).toContain('bg-[#3b82f6]');
  });

  it('maps spacing to a named token, else the scale, else arbitrary', () => {
    const node = frame({
      layout: {
        direction: 'row',
        justify: 'start',
        align: 'start',
        gap: 14,
        padding: { top: 24, right: 24, bottom: 24, left: 24 },
      },
    });
    const classes = mapClasses(node, { spacingTokens: { '24': 'gutter' } });
    expect(classes).toContain('p-gutter'); // exact token match wins
    expect(classes).toContain('gap-[14px]'); // 14px: no token, >1px from any step
    // Without the token, 24px snaps to the default scale step (p-6).
    expect(mapClasses(node)).toContain('p-6');
  });
});

describe('generateRN', () => {
  it('renders a View with a nested Text node', () => {
    const node = frame({
      name: 'Card Header',
      children: [
        {
          type: 'text',
          name: 'Title',
          width: 'hug',
          height: 'hug',
          style: { ...baseStyle },
          text: {
            content: 'Hello',
            typography: {
              fontSize: 16,
              fontWeight: 700,
              lineHeight: null,
              color: '#111111',
            },
          },
          children: [],
        },
      ],
    });
    const code = generateRN(node);
    expect(code).toContain("import { Text, View } from 'react-native'");
    expect(code).toContain('export function CardHeader()');
    expect(code).toContain('<Text');
    expect(code).toContain('>Hello</Text>');
  });

  it('honors the snap tolerance option (Loose vs Strict)', () => {
    const node = frame({
      layout: {
        direction: 'column',
        justify: 'start',
        align: 'start',
        gap: 14,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    });
    // 14px is 2px from the nearest scale step (12px -> gap-3).
    expect(generateRN(node, { tolerance: 2 })).toContain('gap-3');
    expect(generateRN(node, { tolerance: 0 })).toContain('gap-[14px]');
  });
});

describe('generateRNMulti', () => {
  it('matches single-frame generateRN for one root', () => {
    const node = frame({ name: 'Card Header' });
    expect(generateRNMulti([node])).toBe(generateRN(node));
  });

  it('emits one exported component per frame under a shared import block', () => {
    const code = generateRNMulti([
      frame({ name: 'Header' }),
      frame({ name: 'Footer' }),
    ]);
    expect(code).toContain('export function Header()');
    expect(code).toContain('export function Footer()');
    // One shared react-native import, not one per frame.
    expect(code.match(/from 'react-native'/g)).toHaveLength(1);
  });

  it('deduplicates colliding component names file-wide', () => {
    const code = generateRNMulti([
      frame({ name: 'Card' }),
      frame({ name: 'Card' }),
    ]);
    expect(code).toContain('export function Card()');
    expect(code).toContain('export function Card2()');
  });
});
