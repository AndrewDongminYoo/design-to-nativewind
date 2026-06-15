import { emit, on, showUI } from '@create-figma-plugin/utilities';

import { collapseVectors } from './core/collapse-vectors';
import { extract } from './core/extract';
import { generateRN } from './core/generate-rn';
import type { IRNode } from './core/ir';
import { DEFAULT_OPTIONS, type GenOptions } from './core/options';
import { parseThemeColors } from './core/parse-theme';
import { svgToJsx } from './core/svg-to-jsx';

const COLOR_TOKENS_KEY = 'colorTokens';

export interface ConvertHandler {
  name: 'CONVERT';
  handler: () => void;
}

export interface CodeGeneratedHandler {
  name: 'CODE_GENERATED';
  handler: (code: string) => void;
}

export interface ConversionErrorHandler {
  name: 'CONVERSION_ERROR';
  handler: (message: string) => void;
}

export interface ImportThemeHandler {
  name: 'IMPORT_THEME';
  handler: (source: string) => void;
}

/** Exports each vector node's SVG and converts it to react-native-svg JSX in place. */
async function injectSvg(node: IRNode): Promise<void> {
  if (node.type === 'vector') {
    if (node.id === undefined) return;
    const figmaNode = await figma.getNodeByIdAsync(node.id);
    if (figmaNode !== null && 'exportAsync' in figmaNode) {
      try {
        const svg = await (figmaNode as SceneNode).exportAsync({
          format: 'SVG_STRING',
        });
        const rendered = svgToJsx(svg);
        if (rendered !== null) node.svg = rendered;
      } catch {
        // Leave the placeholder if export fails (e.g. unsupported node).
      }
    }
    return;
  }
  await Promise.all(node.children.map((child) => injectSvg(child)));
}

async function nodeToCode(
  node: SceneNode,
  options?: Partial<GenOptions>,
): Promise<string> {
  const ir = collapseVectors(extract(node));
  await injectSvg(ir);
  return generateRN(ir, options);
}

/** Maps the `snap` codegen preference to a px tolerance. */
function snapTolerance(snap: string | undefined): number {
  switch (snap) {
    case 'strict':
      return 0;
    case 'loose':
      return 2;
    default:
      return 1;
  }
}

async function codegenOptions(): Promise<GenOptions> {
  const colorTokens = await figma.clientStorage.getAsync(COLOR_TOKENS_KEY);
  const { snap, reuse } = figma.codegen.preferences.customSettings;
  return {
    ...DEFAULT_OPTIONS,
    tolerance: snapTolerance(snap),
    extractComponents: reuse !== 'off',
    colorTokens:
      typeof colorTokens === 'object' && colorTokens !== null
        ? (colorTokens as Record<string, string>)
        : {},
  };
}

async function storeImportedTheme(source: string): Promise<void> {
  const colorTokens = parseThemeColors(source);
  await figma.clientStorage.setAsync(COLOR_TOKENS_KEY, colorTokens);
  const count = Object.keys(colorTokens).length;
  figma.notify(
    count > 0
      ? `Imported ${count} color token${count === 1 ? '' : 's'}`
      : 'No color tokens found in the imported file',
  );
  figma.ui.close();
  figma.codegen.refresh();
}

async function convertSelection(): Promise<void> {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    emit<ConversionErrorHandler>(
      'CONVERSION_ERROR',
      'Select a frame to convert.',
    );
    return;
  }

  // v1: convert the first top-level selected node. Multi-frame handling is a future milestone.
  emit<CodeGeneratedHandler>('CODE_GENERATED', await nodeToCode(selection[0]));
}

export default function main(): void {
  // Dev Mode code generator: register the generate callback and stay resident.
  // figma.showUI is not allowed inside the generate callback, so this branch
  // never opens the run UI.
  if (figma.mode === 'codegen') {
    figma.codegen.on('generate', async ({ node }): Promise<CodegenResult[]> => {
      const options = await codegenOptions();
      return [
        {
          title: 'React Native + NativeWind',
          language: 'TYPESCRIPT',
          code: await nodeToCode(node, options),
        },
      ];
    });

    // The "Import theme" action opens the import UI. showUI is not allowed
    // inside the generate callback, so it lives here in preferenceschange.
    figma.codegen.on('preferenceschange', async ({ propertyName }) => {
      if (propertyName === 'import') {
        showUI({ width: 420, height: 240 }, { mode: 'import' });
      }
    });

    on<ImportThemeHandler>('IMPORT_THEME', (source) => {
      void storeImportedTheme(source);
    });
    return;
  }

  // Run plugin (design mode / Dev Mode run): show the preview + copy UI.
  on<ConvertHandler>('CONVERT', () => {
    void convertSelection();
  });
  showUI({ width: 420, height: 600 });
}
