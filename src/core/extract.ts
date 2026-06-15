// Figma SceneNode → IR. The only module that depends on the Figma node shape.

import type { Axis, IRNode, IRNodeType, IRStyle, Sizing } from './ir';

function rgbToHex(color: RGB): string {
  const to = (n: number) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to(color.r)}${to(color.g)}${to(color.b)}`;
}

function firstSolidFill(
  fills: ReadonlyArray<Paint> | typeof figma.mixed,
): string | null {
  if (fills === figma.mixed || !Array.isArray(fills)) return null;
  const solid = fills.find(
    (f): f is SolidPaint => f.type === 'SOLID' && f.visible !== false,
  );
  return solid ? rgbToHex(solid.color) : null;
}

function nodeType(node: SceneNode): IRNodeType {
  if (node.type === 'TEXT') return 'text';
  if (
    'fills' in node &&
    Array.isArray(node.fills) &&
    node.fills.some((f) => f.type === 'IMAGE')
  ) {
    return 'image';
  }
  if (
    node.type === 'VECTOR' ||
    node.type === 'BOOLEAN_OPERATION' ||
    node.type === 'STAR' ||
    node.type === 'LINE' ||
    node.type === 'POLYGON'
  ) {
    return 'vector';
  }
  if (
    node.type === 'FRAME' ||
    node.type === 'COMPONENT' ||
    node.type === 'INSTANCE' ||
    node.type === 'GROUP'
  ) {
    return 'frame';
  }
  return 'unknown';
}

function sizing(node: SceneNode, dimension: 'width' | 'height'): Sizing {
  const layoutKey =
    dimension === 'width' ? 'layoutSizingHorizontal' : 'layoutSizingVertical';
  if (layoutKey in node) {
    const mode = (node as unknown as Record<string, string>)[layoutKey];
    if (mode === 'FILL') return 'fill';
    if (mode === 'HUG') return 'hug';
  }
  return { fixed: dimension === 'width' ? node.width : node.height };
}

function extractStyle(node: SceneNode, type: IRNodeType): IRStyle {
  // Only frames and image-bearing nodes paint a background. A text node's fill
  // is its glyph color (captured in typography); a vector's fill is its SVG
  // paint — neither belongs in style.background, and leaking either pollutes
  // the structural signature that drives sub-component hoisting.
  const background =
    (type === 'frame' || type === 'image') && 'fills' in node
      ? firstSolidFill(node.fills)
      : null;
  const cornerRadius =
    'cornerRadius' in node && typeof node.cornerRadius === 'number'
      ? node.cornerRadius
      : 0;
  const opacity = 'opacity' in node ? node.opacity : 1;
  return { background, cornerRadius, opacity };
}

function extractLayout(node: SceneNode): IRNode['layout'] {
  if (!('layoutMode' in node) || node.layoutMode === 'NONE') return undefined;
  const direction: Axis = node.layoutMode === 'HORIZONTAL' ? 'row' : 'column';
  const justifyMap: Record<
    string,
    'start' | 'center' | 'end' | 'space-between'
  > = {
    MIN: 'start',
    CENTER: 'center',
    MAX: 'end',
    SPACE_BETWEEN: 'space-between',
  };
  const alignMap: Record<string, 'start' | 'center' | 'end'> = {
    MIN: 'start',
    CENTER: 'center',
    MAX: 'end',
  };
  return {
    direction,
    justify: justifyMap[node.primaryAxisAlignItems] ?? 'start',
    align: alignMap[node.counterAxisAlignItems] ?? 'start',
    gap: typeof node.itemSpacing === 'number' ? node.itemSpacing : 0,
    padding: {
      top: node.paddingTop,
      right: node.paddingRight,
      bottom: node.paddingBottom,
      left: node.paddingLeft,
    },
  };
}

function extractText(node: SceneNode): IRNode['text'] {
  if (node.type !== 'TEXT') return undefined;
  const fontSize = typeof node.fontSize === 'number' ? node.fontSize : 16;
  const fontWeight =
    typeof node.fontWeight === 'number' ? node.fontWeight : 400;
  const lineHeight =
    node.lineHeight !== figma.mixed && node.lineHeight.unit === 'PIXELS'
      ? node.lineHeight.value
      : null;
  return {
    content: node.characters,
    typography: {
      fontSize,
      fontWeight,
      lineHeight,
      color: firstSolidFill(node.fills),
    },
  };
}

export function extract(node: SceneNode): IRNode {
  const type = nodeType(node);
  // Vectors are opaque shapes; don't descend into their internals.
  const children =
    type !== 'vector' && 'children' in node
      ? node.children.map((child) => extract(child))
      : [];
  const vectorColor =
    type === 'vector' && 'fills' in node
      ? (firstSolidFill(node.fills) ?? undefined)
      : undefined;
  return {
    type,
    id: node.id,
    name: node.name,
    layout: extractLayout(node),
    width: sizing(node, 'width'),
    height: sizing(node, 'height'),
    style: extractStyle(node, type),
    text: extractText(node),
    vectorColor,
    children,
  };
}
