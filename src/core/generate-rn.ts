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
  return content.replace(/[{}]/g, (c) => `{'${c}'}`);
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

  // Vectors are emitted as an empty react-native-svg placeholder for the
  // developer to fill in; the original paths are not reconstructed, but the
  // primary fill is passed as `color` to hint the intended tint.
  if (node.type === 'vector') {
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
  svg: boolean;
}

/** Records which react-native primitives and whether react-native-svg are used. */
function collectImports(node: IRNode, usage: ImportUsage): void {
  if (node.componentName) {
    return; // reference to a hoisted sub-component
  }
  if (node.type === 'vector') {
    usage.svg = true;
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

export function generateRN(
  root: IRNode,
  options: Partial<GenOptions> = {},
): string {
  const { tolerance, colorTokens, extractComponents } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  const renderOptions: RenderOptions = { tolerance, colorTokens };

  const collapsedRoot = collapseVectors(root);
  let mainRoot = collapsedRoot;
  let components: ExtractedComponent[] = [];
  if (extractComponents) {
    const result = hoistRepeatedSubtrees(collapsedRoot);
    mainRoot = result.root;
    components = result.components;
  }

  const usage: ImportUsage = { rn: new Set(), svg: false };
  collectImports(mainRoot, usage);
  components.forEach((component) => collectImports(component.node, usage));

  const importLines: string[] = [];
  if (usage.rn.size > 0) {
    importLines.push(
      `import { ${[...usage.rn].sort().join(', ')} } from 'react-native'`,
    );
  }
  if (usage.svg) {
    importLines.push(`import { Svg } from 'react-native-svg'`);
  }

  const componentFns = components.map((component) =>
    renderFunction(component.name, component.node, renderOptions, false),
  );
  const mainFn = renderFunction(
    toComponentName(mainRoot.name || 'Component'),
    mainRoot,
    renderOptions,
    true,
  );

  return `${importLines.join('\n')}

${[...componentFns, mainFn].join('\n\n')}
`;
}
