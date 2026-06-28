// IR → React Native + NativeWind JSX string. Pure and unit-testable.

import { collapseVectors } from './collapse-vectors';
import {
  extractComponents as hoistRepeatedSubtrees,
  type ExtractedComponent,
} from './extract-components';
import type { IRNode, Sizing } from './ir';
import { mapClasses } from './map-styles';
import { toComponentName } from './names';
import type { GenOptions } from './options';
import { DEFAULT_OPTIONS } from './options';
import { SVG_IMPORT_ALIAS } from './svg-to-jsx';

const INDENT = '  ';

function rnTag(node: IRNode): 'View' | 'Text' | 'Image' | 'ScrollView' {
  switch (node.type) {
    case 'text':
      return 'Text';
    case 'image':
      return 'Image';
    default:
      return 'View';
  }
}

function escapeText(content: string): string {
  // Escape JSX braces, and turn line breaks into `{'\n'}` — a raw newline in
  // JSX text collapses to a space, so it must be an explicit expression to
  // render. Figma stores line breaks as \n, \r\n, or \u2028 (LINE SEPARATOR).
  return content.replace(/\r\n|[\r\n\u2028\u2029{}]/g, (c) =>
    c === '{' || c === '}' ? `{'${c}'}` : "{'\\n'}",
  );
}

/** Emits ` width={52}` for a fixed dimension, nothing for fill/hug. */
function sizeProp(name: 'width' | 'height', sizing: Sizing): string {
  return typeof sizing === 'object'
    ? ` ${name}={${Math.round(sizing.fixed)}}`
    : '';
}

type RenderOptions = Pick<GenOptions, 'tolerance' | 'colorTokens'>;

function renderNode(
  node: IRNode,
  depth: number,
  options: RenderOptions,
): string {
  const pad = INDENT.repeat(depth);

  if (node.componentName) {
    return `${pad}<${node.componentName} />`;
  }

  // Vectors: when the host has exported and converted the SVG, inline that JSX
  // (re-indented to the current depth). Otherwise fall back to an empty
  // react-native-svg placeholder, hinting the primary fill via `color`.
  if (node.type === 'vector') {
    if (node.svg) {
      return node.svg.jsx
        .split('\n')
        .map((line) => `${pad}${line}`)
        .join('\n');
    }
    const color = node.vectorColor ? ` color="${node.vectorColor}"` : '';
    return `${pad}<Svg${sizeProp('width', node.width)}${sizeProp('height', node.height)}${color} />`;
  }

  const tag = rnTag(node);
  const classes = mapClasses(node, options);
  const className = classes.length ? ` className="${classes.join(' ')}"` : '';

  if (tag === 'Text' && node.text) {
    return `${pad}<Text${className}>${escapeText(node.text.content)}</Text>`;
  }
  if (tag === 'Image') {
    return `${pad}<Image${className} />`;
  }
  if (node.children.length === 0) {
    return `${pad}<${tag}${className} />`;
  }

  const children = node.children
    .map((child) => renderNode(child, depth + 1, options))
    .join('\n');
  return `${pad}<${tag}${className}>\n${children}\n${pad}</${tag}>`;
}

interface ImportUsage {
  rn: Set<string>;
  svg: Set<string>;
}

/** Records the react-native primitives and react-native-svg components used. */
function collectImports(node: IRNode, usage: ImportUsage): void {
  if (node.componentName) {
    return; // reference to a hoisted sub-component
  }
  if (node.type === 'vector') {
    if (node.svg) {
      node.svg.components.forEach((c) => usage.svg.add(c));
    } else {
      usage.svg.add('Svg');
    }
    return;
  }
  usage.rn.add(rnTag(node));
  node.children.forEach((child) => collectImports(child, usage));
}

function renderFunction(
  name: string,
  node: IRNode,
  options: RenderOptions,
  exported: boolean,
): string {
  return `${exported ? 'export ' : ''}function ${name}() {
  return (
${renderNode(node, 2, options)}
  )
}`;
}

/** Reserves `name` in `used`, suffixing `2`, `3`, … on collision. */
function makeUnique(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  let i = 2;
  while (used.has(`${name}${i}`)) i++;
  const unique = `${name}${i}`;
  used.add(unique);
  return unique;
}

/** Rewrites `componentName` references so renamed sub-components keep resolving. */
function renameRefs(node: IRNode, renames: Map<string, string>): IRNode {
  const renamed = node.componentName
    ? renames.get(node.componentName)
    : undefined;
  return {
    ...node,
    ...(renamed ? { componentName: renamed } : {}),
    children: node.children.map((child) => renameRefs(child, renames)),
  };
}

export function generateRN(
  root: IRNode,
  options: Partial<GenOptions> = {},
): string {
  return generateRNMulti([root], options);
}

/**
 * Renders one or more selected frames into a single file: a shared import block,
 * each frame's hoisted sub-components, and one exported component per frame.
 * Function names are made unique file-wide; hoisting stays per-frame (no
 * cross-frame component sharing in v1).
 */
export function generateRNMulti(
  roots: IRNode[],
  options: Partial<GenOptions> = {},
): string {
  const { tolerance, colorTokens, extractComponents } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  const renderOptions: RenderOptions = { tolerance, colorTokens };

  const usedNames = new Set<string>();
  const usage: ImportUsage = { rn: new Set(), svg: new Set() };
  const fns: string[] = [];

  for (const root of roots) {
    const collapsedRoot = collapseVectors(root);
    let mainRoot = collapsedRoot;
    let components: ExtractedComponent[] = [];
    if (extractComponents) {
      const result = hoistRepeatedSubtrees(collapsedRoot);
      mainRoot = result.root;
      components = result.components;
    }

    // Sub-components first so we can remap the main tree's references to them.
    const renames = new Map<string, string>();
    const uniqueComponents = components.map((component) => {
      const name = makeUnique(component.name, usedNames);
      if (name !== component.name) renames.set(component.name, name);
      return { name, node: component.node };
    });
    const mainName = makeUnique(
      toComponentName(mainRoot.name || 'Component'),
      usedNames,
    );
    const mainNode = renames.size ? renameRefs(mainRoot, renames) : mainRoot;

    collectImports(mainNode, usage);
    uniqueComponents.forEach((component) =>
      collectImports(component.node, usage),
    );

    uniqueComponents.forEach((component) =>
      fns.push(
        renderFunction(component.name, component.node, renderOptions, false),
      ),
    );
    fns.push(renderFunction(mainName, mainNode, renderOptions, true));
  }

  const importLines: string[] = [];
  if (usage.rn.size > 0) {
    importLines.push(
      `import { ${[...usage.rn].sort().join(', ')} } from 'react-native'`,
    );
  }
  if (usage.svg.size > 0) {
    const svgSpecifiers = [...usage.svg]
      .sort()
      .map((name) =>
        SVG_IMPORT_ALIAS[name] ? `${SVG_IMPORT_ALIAS[name]} as ${name}` : name,
      );
    importLines.push(
      `import { ${svgSpecifiers.join(', ')} } from 'react-native-svg'`,
    );
  }

  return `${importLines.join('\n')}

${fns.join('\n\n')}
`;
}
