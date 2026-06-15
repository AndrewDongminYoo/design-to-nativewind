import { emit, on, showUI } from '@create-figma-plugin/utilities';

import { extract } from './core/extract';
import { generateRN } from './core/generate-rn';
import { DEFAULT_OPTIONS, type GenOptions } from './core/options';
import { parseThemeColors } from './core/parse-theme';

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

function nodeToCode(node: SceneNode, options?: Partial<GenOptions>): string {
  return generateRN(extract(node), options);
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
  return {
    ...DEFAULT_OPTIONS,
    tolerance: snapTolerance(figma.codegen.preferences.customSettings.snap),
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

function convertSelection(): void {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    emit<ConversionErrorHandler>(
      'CONVERSION_ERROR',
      'Select a frame to convert.',
    );
    return;
  }

  // v1: convert the first top-level selected node. Multi-frame handling is a future milestone.
  emit<CodeGeneratedHandler>('CODE_GENERATED', nodeToCode(selection[0]));
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
          code: nodeToCode(node, options),
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
  on<ConvertHandler>('CONVERT', convertSelection);
  showUI({ width: 420, height: 600 });
}
