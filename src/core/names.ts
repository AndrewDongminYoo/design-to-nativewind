// Shared naming helpers. Pure; no Figma/Preact dependency.

/** Converts an arbitrary layer name into a valid PascalCase component identifier. */
export function toComponentName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9]+/g, ' ').trim();
  const pascal = cleaned
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');
  return /^[A-Za-z]/.test(pascal) ? pascal : `Component${pascal}`;
}
