import { emit, on, showUI } from '@create-figma-plugin/utilities';

import { extract } from './core/extract';
import { generateRN } from './core/generate-rn';
import { DEFAULT_OPTIONS, type GenOptions } from './core/options';

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

function codegenOptions(): Partial<GenOptions> {
  return {
    ...DEFAULT_OPTIONS,
    tolerance: snapTolerance(figma.codegen.preferences.customSettings.snap),
  };
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
    figma.codegen.on('generate', ({ node }): CodegenResult[] => [
      {
        title: 'React Native + NativeWind',
        language: 'TYPESCRIPT',
        code: nodeToCode(node, codegenOptions()),
      },
    ]);
    return;
  }

  // Run plugin (design mode / Dev Mode run): show the preview + copy UI.
  on<ConvertHandler>('CONVERT', convertSelection);
  showUI({ width: 420, height: 600 });
}
