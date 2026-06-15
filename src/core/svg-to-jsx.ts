// Lightweight SVG -> react-native-svg JSX transform (an "SVGR-lite"). Pure and
// unit-testable: no DOM, no eval, no dependencies. Figma's SVG export is clean
// and predictable, so a small XML scanner plus tag/attribute mapping covers it.
// Unsupported constructs degrade (unknown elements are unwrapped) rather than
// throwing.

import type { SvgRender } from './ir';

interface XmlNode {
  tag: string;
  attrs: Record<string, string>;
  children: XmlNode[];
}

// SVG element (lowercased) -> react-native-svg component.
const TAG_MAP: Record<string, string> = {
  svg: 'Svg',
  g: 'G',
  path: 'Path',
  rect: 'Rect',
  circle: 'Circle',
  ellipse: 'Ellipse',
  line: 'Line',
  polyline: 'Polyline',
  polygon: 'Polygon',
  // Text/Image collide with react-native's own exports; use aliases that
  // generate-rn imports as `Text as SvgText` / `Image as SvgImage`. See
  // SVG_IMPORT_ALIAS below — keep these two in sync.
  text: 'SvgText',
  tspan: 'TSpan',
  textpath: 'TextPath',
  defs: 'Defs',
  clippath: 'ClipPath',
  lineargradient: 'LinearGradient',
  radialgradient: 'RadialGradient',
  stop: 'Stop',
  pattern: 'Pattern',
  mask: 'Mask',
  use: 'Use',
  image: 'SvgImage',
  symbol: 'Symbol',
  marker: 'Marker',
};

/** Generated tag name -> real react-native-svg export, for import aliasing. */
export const SVG_IMPORT_ALIAS: Record<string, string> = {
  SvgText: 'Text',
  SvgImage: 'Image',
};

function parseAttrs(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    attrs[match[1]] = match[2] ?? match[3] ?? '';
  }
  return attrs;
}

function parseXml(source: string): XmlNode | null {
  const cleaned = source
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '');
  const tagRe = /<(\/)?([a-zA-Z][\w:.-]*)([^>]*?)(\/?)>/g;
  const stack: XmlNode[] = [];
  let root: XmlNode | null = null;
  let match: RegExpExecArray | null;

  while ((match = tagRe.exec(cleaned)) !== null) {
    const [, closing, tag, attrString, selfClose] = match;
    if (closing) {
      stack.pop();
      continue;
    }
    const node: XmlNode = { tag, attrs: parseAttrs(attrString), children: [] };
    const parent = stack[stack.length - 1];
    if (parent) {
      parent.children.push(node);
    } else {
      root = node;
    }
    if (selfClose !== '/') {
      stack.push(node);
    }
  }
  return root;
}

/** Maps an SVG attribute name to its JSX form, or null to drop it. */
function mapAttrName(name: string): string | null {
  if (name === 'xmlns' || name.startsWith('xmlns:')) return null;
  if (name === 'class' || name === 'style') return null;
  if (name === 'xlink:href' || name === 'href') return 'href';
  if (name.includes(':')) return null; // other namespaced attributes
  return name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function renderAttrs(attrs: Record<string, string>): string {
  return Object.entries(attrs)
    .map(([key, value]) => {
      const name = mapAttrName(key);
      if (name === null) return '';
      return ` ${name}="${value.replace(/"/g, '&quot;')}"`;
    })
    .join('');
}

function renderNode(node: XmlNode, depth: number, used: Set<string>): string[] {
  const component = TAG_MAP[node.tag.toLowerCase()];
  const pad = '  '.repeat(depth);

  // Unknown element: unwrap it, keeping any children, rather than dropping content.
  if (component === undefined) {
    return node.children.flatMap((child) => renderNode(child, depth, used));
  }

  used.add(component);
  const attrs = renderAttrs(node.attrs);
  const childLines = node.children.flatMap((child) =>
    renderNode(child, depth + 1, used),
  );

  if (childLines.length === 0) {
    return [`${pad}<${component}${attrs} />`];
  }
  return [
    `${pad}<${component}${attrs}>`,
    ...childLines,
    `${pad}</${component}>`,
  ];
}

/** Transforms an SVG string into react-native-svg JSX. Returns null on failure. */
export function svgToJsx(svg: string): SvgRender | null {
  const root = parseXml(svg);
  if (root === null || TAG_MAP[root.tag.toLowerCase()] === undefined) {
    return null;
  }
  const used = new Set<string>();
  const jsx = renderNode(root, 0, used).join('\n');
  return { jsx, components: [...used].sort() };
}
