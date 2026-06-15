// IR → React Native + NativeWind JSX string. Pure and unit-testable.

import {
  extractComponents,
  type ExtractedComponent,
} from './extract-components';
import type { IRNode } from './ir';
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

/** Collects the RN primitives used so the import line is accurate. */
function collectImports(node: IRNode, set: Set<string>): void {
  if (node.componentName) {
    return; // reference to a hoisted sub-component, not an RN primitive
  }
  set.add(rnTag(node));
  node.children.forEach((child) => collectImports(child, set));
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
  const {
    tolerance,
    colorTokens,
    extractComponents: doExtract,
  } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  const renderOptions: RenderOptions = { tolerance, colorTokens };

  let mainRoot = root;
  let components: ExtractedComponent[] = [];
  if (doExtract) {
    const result = extractComponents(root);
    mainRoot = result.root;
    components = result.components;
  }

  const imports = new Set<string>();
  collectImports(mainRoot, imports);
  components.forEach((component) => collectImports(component.node, imports));
  const importLine = `import { ${[...imports].sort().join(', ')} } from 'react-native'`;

  const componentFns = components.map((component) =>
    renderFunction(component.name, component.node, renderOptions, false),
  );
  const mainFn = renderFunction(
    toComponentName(mainRoot.name || 'Component'),
    mainRoot,
    renderOptions,
    true,
  );

  return `${importLine}

${[...componentFns, mainFn].join('\n\n')}
`;
}
