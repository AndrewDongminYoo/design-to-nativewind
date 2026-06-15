import { describe, expect, it } from 'vitest';

import { parseThemeColors } from '../parse-theme';

describe('parseThemeColors', () => {
  it('parses a flat Tailwind colors object', () => {
    const source = `module.exports = {
      theme: { extend: { colors: { brand: '#3B82F6', accent: "#ff0" } } },
    };`;
    expect(parseThemeColors(source)).toEqual({
      '#3b82f6': 'brand',
      '#ffff00': 'accent',
    });
  });

  it('parses one level of nesting and strips DEFAULT', () => {
    const source = `const colors = {
      primary: { DEFAULT: '#3b82f6', 500: '#3b82f6', 700: '#1d4ed8' },
    }`;
    const result = parseThemeColors(source);
    expect(result['#1d4ed8']).toBe('primary-700');
    // DEFAULT and 500 share the hex; the last write wins, both names are valid.
    expect(['primary', 'primary-500']).toContain(result['#3b82f6']);
  });

  it('parses CSS --color-* custom properties', () => {
    const source = `@theme {
      --color-primary: #3b82f6;
      --color-surface-muted: #F3F4F6;
    }`;
    expect(parseThemeColors(source)).toEqual({
      '#3b82f6': 'primary',
      '#f3f4f6': 'surface-muted',
    });
  });

  it('returns an empty map for input with no parseable colors', () => {
    expect(
      parseThemeColors('export default function App() { return null }'),
    ).toEqual({});
  });

  it('skips non-hex color values (named colors, functions)', () => {
    const source = `colors: { sky: 'cornflowerblue', dynamic: rgb(1,2,3), ok: '#abc' }`;
    expect(parseThemeColors(source)).toEqual({ '#aabbcc': 'ok' });
  });
});
