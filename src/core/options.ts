// Generation options threaded from the Figma runtime into the pure pipeline.
// Keeping behavior data-driven here means generate-rn/map-styles stay testable
// without Figma: a test just passes options directly.

export interface GenOptions {
  /** snap tolerance in px (0 = exact, higher = snap more aggressively) */
  tolerance: number;
  /** lowercased hex (#rrggbb) -> token name; reserved for theme import (feature B) */
  colorTokens: Record<string, string>;
  /** hoist repeated subtrees into sub-components; reserved for style reuse (feature C) */
  extractComponents: boolean;
}

export const DEFAULT_OPTIONS: GenOptions = {
  tolerance: 1,
  colorTokens: {},
  extractComponents: false,
};
