import { describe, expect, it } from 'vitest';

import { toComponentName } from '../names';

describe('toComponentName', () => {
  it('PascalCases multi-word layer names', () => {
    expect(toComponentName('product card')).toBe('ProductCard');
    expect(toComponentName('Frame 2147226707')).toBe('Frame2147226707');
  });

  it('prefixes names that do not start with a letter', () => {
    expect(toComponentName('123 list')).toBe('Component123List');
    expect(toComponentName('')).toBe('Component');
  });

  it('avoids shadowing imported RN primitives', () => {
    expect(toComponentName('View')).toBe('ComponentView');
    expect(toComponentName('text')).toBe('ComponentText');
    expect(toComponentName('Image')).toBe('ComponentImage');
  });

  it('avoids reserved keywords (case-insensitive)', () => {
    expect(toComponentName('default')).toBe('ComponentDefault');
    expect(toComponentName('Class')).toBe('ComponentClass');
    expect(toComponentName('function')).toBe('ComponentFunction');
    expect(toComponentName('type')).toBe('ComponentType');
  });

  it('leaves ordinary names untouched', () => {
    expect(toComponentName('Card')).toBe('Card');
    expect(toComponentName('Rectangle 34625979')).toBe('Rectangle34625979');
  });
});
