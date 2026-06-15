// Shared naming helpers. Pure; no Figma/Preact dependency.

// React Native primitives generate-rn imports — a component must not shadow them.
const RN_PRIMITIVES = new Set(['View', 'Text', 'Image', 'ScrollView']);

// ECMAScript/TypeScript reserved words, literals, and contextual keywords.
// Compared case-insensitively so a layer named "class" / "Class" is both caught.
const RESERVED_WORDS = new Set([
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'new',
  'null',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'as',
  'implements',
  'interface',
  'let',
  'package',
  'private',
  'protected',
  'public',
  'static',
  'yield',
  'await',
  'async',
  'of',
  'any',
  'boolean',
  'number',
  'string',
  'symbol',
  'object',
  'unknown',
  'never',
  'undefined',
  'type',
  'namespace',
  'declare',
  'readonly',
  'abstract',
  'is',
  'keyof',
  'infer',
  'satisfies',
]);

/** Converts an arbitrary layer name into a valid, collision-safe PascalCase identifier. */
export function toComponentName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9]+/g, ' ').trim();
  const pascal = cleaned
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');

  // Must start with a letter to be a valid identifier and an uppercase JSX tag.
  let result = /^[A-Za-z]/.test(pascal) ? pascal : `Component${pascal}`;

  // Avoid shadowing imported RN primitives or matching a reserved keyword.
  if (RN_PRIMITIVES.has(result) || RESERVED_WORDS.has(result.toLowerCase())) {
    result = `Component${result}`;
  }

  return result === '' ? 'Component' : result;
}
