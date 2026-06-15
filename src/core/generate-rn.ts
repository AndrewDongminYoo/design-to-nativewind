// IR → React Native + NativeWind JSX string. Pure and unit-testable.

import type { IRNode } from './ir'
import { mapClasses, SNAP_TOLERANCE_PX } from './map-styles'

const INDENT = '  '

function rnTag(node: IRNode): 'View' | 'Text' | 'Image' | 'ScrollView' {
  switch (node.type) {
    case 'text':
      return 'Text'
    case 'image':
      return 'Image'
    default:
      return 'View'
  }
}

function escapeText(content: string): string {
  return content.replace(/[{}]/g, (c) => `{'${c}'}`)
}

function renderNode(node: IRNode, depth: number, tolerance: number): string {
  const pad = INDENT.repeat(depth)
  const tag = rnTag(node)
  const classes = mapClasses(node, tolerance)
  const className = classes.length ? ` className="${classes.join(' ')}"` : ''

  if (tag === 'Text' && node.text) {
    return `${pad}<Text${className}>${escapeText(node.text.content)}</Text>`
  }
  if (tag === 'Image') {
    return `${pad}<Image${className} />`
  }
  if (node.children.length === 0) {
    return `${pad}<${tag}${className} />`
  }

  const children = node.children
    .map((child) => renderNode(child, depth + 1, tolerance))
    .join('\n')
  return `${pad}<${tag}${className}>\n${children}\n${pad}</${tag}>`
}

function toComponentName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9]+/g, ' ').trim()
  const pascal = cleaned
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('')
  return /^[A-Za-z]/.test(pascal) ? pascal : `Component${pascal}`
}

/** Collects the RN primitives used so the import line is accurate. */
function collectImports(node: IRNode, set: Set<string>): void {
  set.add(rnTag(node))
  node.children.forEach((child) => collectImports(child, set))
}

export interface GenerateOptions {
  tolerance?: number
}

export function generateRN(root: IRNode, options: GenerateOptions = {}): string {
  const tolerance = options.tolerance ?? SNAP_TOLERANCE_PX
  const componentName = toComponentName(root.name || 'Component')

  const imports = new Set<string>()
  collectImports(root, imports)
  const importLine = `import { ${[...imports].sort().join(', ')} } from 'react-native'`

  const body = renderNode(root, 2, tolerance)

  return `${importLine}

export function ${componentName}() {
  return (
${body}
  )
}
`
}
