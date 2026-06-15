// IR style → NativeWind utility classes. Pure and unit-testable.

import type { IRNode, Sizing } from './ir';

// Tailwind spacing scale (rem steps) mapped to px at the default 16px root.
// We snap to the nearest step within SNAP_TOLERANCE_PX, else emit an arbitrary value.
const SPACING_PX_TO_STEP: ReadonlyArray<readonly [number, string]> = [
  [0, '0'],
  [2, '0.5'],
  [4, '1'],
  [6, '1.5'],
  [8, '2'],
  [10, '2.5'],
  [12, '3'],
  [16, '4'],
  [20, '5'],
  [24, '6'],
  [32, '8'],
  [40, '10'],
  [48, '12'],
  [64, '16'],
];

export const SNAP_TOLERANCE_PX = 1;

/** Returns the spacing-scale token (e.g. "4") or null if no step is within tolerance. */
export function snapSpacing(
  px: number,
  tolerance = SNAP_TOLERANCE_PX,
): string | null {
  let best: { step: string; diff: number } | null = null;
  for (const [value, step] of SPACING_PX_TO_STEP) {
    const diff = Math.abs(value - px);
    if (diff <= tolerance && (best === null || diff < best.diff)) {
      best = { step, diff };
    }
  }
  return best?.step ?? null;
}

/** Builds a spacing utility like `p-4` or `p-[13px]`. */
export function spacingClass(
  prefix: string,
  px: number,
  tolerance = SNAP_TOLERANCE_PX,
): string {
  if (px === 0) return `${prefix}-0`;
  const step = snapSpacing(px, tolerance);
  return step !== null
    ? `${prefix}-${step}`
    : `${prefix}-[${Math.round(px)}px]`;
}

function sizingClass(prefix: 'w' | 'h', sizing: Sizing): string | null {
  if (sizing === 'fill') return `${prefix}-full`;
  if (sizing === 'hug') return null; // hug = intrinsic; no class needed
  return `${prefix}-[${Math.round(sizing.fixed)}px]`;
}

const JUSTIFY: Record<string, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  'space-between': 'justify-between',
};

const ALIGN: Record<string, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

/** Returns the ordered, de-duplicated NativeWind classes for a node. */
export function mapClasses(
  node: IRNode,
  tolerance = SNAP_TOLERANCE_PX,
): string[] {
  const classes: string[] = [];

  if (node.layout) {
    const { direction, justify, align, gap, padding } = node.layout;
    classes.push('flex', direction === 'row' ? 'flex-row' : 'flex-col');
    classes.push(JUSTIFY[justify]);
    classes.push(ALIGN[align]);
    if (gap > 0) classes.push(spacingClass('gap', gap, tolerance));

    const { top, right, bottom, left } = padding;
    if (top === right && right === bottom && bottom === left) {
      if (top > 0) classes.push(spacingClass('p', top, tolerance));
    } else {
      if (top === bottom && top > 0)
        classes.push(spacingClass('py', top, tolerance));
      else {
        if (top > 0) classes.push(spacingClass('pt', top, tolerance));
        if (bottom > 0) classes.push(spacingClass('pb', bottom, tolerance));
      }
      if (left === right && left > 0)
        classes.push(spacingClass('px', left, tolerance));
      else {
        if (left > 0) classes.push(spacingClass('pl', left, tolerance));
        if (right > 0) classes.push(spacingClass('pr', right, tolerance));
      }
    }
  }

  const w = sizingClass('w', node.width);
  if (w) classes.push(w);
  const h = sizingClass('h', node.height);
  if (h) classes.push(h);

  if (node.style.background) classes.push(`bg-[${node.style.background}]`);
  if (node.style.cornerRadius > 0) {
    const step = snapSpacing(node.style.cornerRadius, tolerance);
    classes.push(
      step !== null
        ? `rounded-[${Math.round(node.style.cornerRadius)}px]`
        : `rounded-[${Math.round(node.style.cornerRadius)}px]`,
    );
  }
  if (node.style.opacity < 1) {
    classes.push(`opacity-[${node.style.opacity.toFixed(2)}]`);
  }

  if (node.text) {
    classes.push(`text-[${Math.round(node.text.typography.fontSize)}px]`);
    if (node.text.typography.color)
      classes.push(`text-[${node.text.typography.color}]`);
    if (node.text.typography.fontWeight >= 700) classes.push('font-bold');
    else if (node.text.typography.fontWeight >= 500)
      classes.push('font-medium');
  }

  return [...new Set(classes)];
}
