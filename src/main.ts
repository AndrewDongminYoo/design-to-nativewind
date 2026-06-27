import { emit, on, showUI } from '@create-figma-plugin/utilities';

import { collapseVectors } from './core/collapse-vectors';
import { extract } from './core/extract';
import { generateRN, generateRNMulti } from './core/generate-rn';
import type { IRNode } from './core/ir';
import { DEFAULT_OPTIONS, type GenOptions } from './core/options';
import { parseThemeColors } from './core/parse-theme';
import { svgToJsx } from './core/svg-to-jsx';

const COLOR_TOKENS_KEY = 'colorTokens';
const API_KEY_KEY = 'anthropicApiKey';

/** Payload sent to the UI after a successful conversion: the code plus the IR it
 * was generated from, so the UI can run the optional LLM refinement on the same IR. */
export interface GeneratedCode {
  code: string;
  ir: IRNode;
}

export interface ConvertHandler {
  name: 'CONVERT';
  handler: () => void;
}

export interface CodeGeneratedHandler {
  name: 'CODE_GENERATED';
  handler: (payload: GeneratedCode) => void;
}

export interface ConversionErrorHandler {
  name: 'CONVERSION_ERROR';
  handler: (message: string) => void;
}

export interface ImportThemeHandler {
  name: 'IMPORT_THEME';
  handler: (source: string) => void;
}

/** UI asks for the persisted config (currently just the Anthropic API key). */
export interface GetConfigHandler {
  name: 'GET_CONFIG';
  handler: () => void;
}

/** Host returns the persisted config to the UI. */
export interface ConfigHandler {
  name: 'CONFIG';
  handler: (config: { apiKey: string }) => void;
}

/** UI persists a new Anthropic API key into clientStorage. */
export interface SetApiKeyHandler {
  name: 'SET_API_KEY';
  handler: (apiKey: string) => void;
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

async function nodeToIr(node: SceneNode): Promise<IRNode> {
  const ir = collapseVectors(extract(node));
  await injectSvg(ir);
  return ir;
}

async function nodeToCode(
  node: SceneNode,
  options?: Partial<GenOptions>,
): Promise<GeneratedCode> {
  const ir = await nodeToIr(node);
  return { ir, code: generateRN(ir, options) };
}

/** Wraps multiple frame IRs in a synthetic container so refinement still gets a
 * single IR for context; a lone frame passes through unchanged. */
function wrapRoots(irs: IRNode[]): IRNode {
  if (irs.length === 1) return irs[0];
  return {
    type: 'frame',
    name: 'Selection',
    width: 'hug',
    height: 'hug',
    style: { background: null, cornerRadius: 0, opacity: 1 },
    children: irs,
  };
}

/** Converts every top-level selected node into one file (one component per frame). */
async function selectionToCode(
  nodes: readonly SceneNode[],
  options?: Partial<GenOptions>,
): Promise<GeneratedCode> {
  const irs: IRNode[] = [];
  for (const node of nodes) {
    irs.push(await nodeToIr(node));
  }
  return { ir: wrapRoots(irs), code: generateRNMulti(irs, options) };
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

  // Convert every top-level selected node into one file (one component per frame).
  emit<CodeGeneratedHandler>(
    'CODE_GENERATED',
    await selectionToCode(selection),
  );
}

async function sendConfig(): Promise<void> {
  const apiKey = await figma.clientStorage.getAsync(API_KEY_KEY);
  emit<ConfigHandler>('CONFIG', {
    apiKey: typeof apiKey === 'string' ? apiKey : '',
  });
}

export default function main(): void {
  // Dev Mode code generator: register the generate callback and stay resident.
  // figma.showUI is not allowed inside the generate callback, so this branch
  // never opens the run UI.
  if (figma.mode === 'codegen') {
    figma.codegen.on('generate', async ({ node }): Promise<CodegenResult[]> => {
      const options = await codegenOptions();
      const { code } = await nodeToCode(node, options);
      return [
        {
          title: 'React Native + NativeWind',
          language: 'TYPESCRIPT',
          code,
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
  on<GetConfigHandler>('GET_CONFIG', () => {
    void sendConfig();
  });
  on<SetApiKeyHandler>('SET_API_KEY', (apiKey) => {
    void figma.clientStorage.setAsync(API_KEY_KEY, apiKey);
  });
  showUI({ width: 420, height: 600 });
}
