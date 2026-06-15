import { emit, on, showUI } from '@create-figma-plugin/utilities'

import { extract } from './core/extract'
import { generateRN } from './core/generate-rn'

export interface ConvertHandler {
  name: 'CONVERT'
  handler: () => void
}

export interface CodeGeneratedHandler {
  name: 'CODE_GENERATED'
  handler: (code: string) => void
}

export interface ConversionErrorHandler {
  name: 'CONVERSION_ERROR'
  handler: (message: string) => void
}

function convertSelection(): void {
  const selection = figma.currentPage.selection
  if (selection.length === 0) {
    emit<ConversionErrorHandler>('CONVERSION_ERROR', 'Select a frame to convert.')
    return
  }

  // v1: convert the first top-level selected node. Multi-frame handling is a future milestone.
  const root = selection[0]
  const ir = extract(root)
  const code = generateRN(ir)
  emit<CodeGeneratedHandler>('CODE_GENERATED', code)
}

export default function main(): void {
  on<ConvertHandler>('CONVERT', convertSelection)
  showUI({ width: 420, height: 600 })
}
