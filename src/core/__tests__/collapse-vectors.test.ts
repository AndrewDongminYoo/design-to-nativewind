import { describe, expect, it } from 'vitest';

import { collapseVectors } from '../collapse-vectors';
import { generateRN } from '../generate-rn';
import type { IRNode } from '../ir';

const baseStyle = { background: null, cornerRadius: 0, opacity: 1 } as const;

function node(partial: Partial<IRNode>): IRNode {
  return {
    type: 'frame',
    name: 'Node',
    width: 'hug',
    height: 'hug',
    style: { ...baseStyle },
    children: [],
    ...partial,
  };
}

function vector(name = 'Vector'): IRNode {
  return node({
    type: 'vector',
    name,
    width: { fixed: 12 },
    height: { fixed: 12 },
  });
}

describe('collapseVectors', () => {
  it('collapses an unstyled group of vectors into a single vector node', () => {
    const group = node({
      name: 'Icon',
      children: [vector(), vector(), vector()],
    });
    const result = collapseVectors(group);
    expect(result.type).toBe('vector');
    expect(result.children).toHaveLength(0);
  });

  it('keeps a styled container and collapses only the vector group inside', () => {
    const badge = node({
      name: 'Badge',
      style: { background: '#df0011', cornerRadius: 16, opacity: 1 },
      width: { fixed: 52 },
      height: { fixed: 52 },
      children: [node({ name: 'Logo', children: [vector(), vector()] })],
    });
    const result = collapseVectors(badge);
    expect(result.type).toBe('frame'); // styled badge preserved
    expect(result.children).toHaveLength(1);
    expect(result.children[0].type).toBe('vector'); // inner logo collapsed
  });

  it('does not collapse a group mixing vectors and other nodes', () => {
    const mixed = node({
      name: 'Row',
      children: [
        vector(),
        node({
          type: 'text',
          name: 'Label',
          width: 'hug',
          height: 'hug',
          style: { ...baseStyle },
          text: {
            content: 'hi',
            typography: {
              fontSize: 12,
              fontWeight: 400,
              lineHeight: null,
              color: null,
            },
          },
        }),
      ],
    });
    expect(collapseVectors(mixed).type).toBe('frame');
  });
});

describe('generateRN with vectors', () => {
  it('imports and emits an <Svg> placeholder with fixed dimensions', () => {
    const root = node({
      name: 'Icon',
      width: { fixed: 24 },
      height: { fixed: 24 },
      children: [vector(), vector()],
    });
    const code = generateRN(root);
    expect(code).toContain("import { Svg } from 'react-native-svg'");
    expect(code).toContain('<Svg width={24} height={24} />');
  });

  it('inlines injected react-native-svg JSX and imports its components', () => {
    const root = node({
      name: 'Row',
      style: { background: '#ffffff', cornerRadius: 0, opacity: 1 },
      children: [
        {
          ...vector('Icon'),
          svg: {
            jsx: '<Svg width="12" height="12">\n  <Path d="M0 0" />\n</Svg>',
            components: ['Path', 'Svg'],
          },
        },
      ],
    });
    const code = generateRN(root);
    expect(code).toContain("import { Path, Svg } from 'react-native-svg'");
    expect(code).toContain('<Path d="M0 0" />');
    // placeholder form is not used when real JSX is present
    expect(code).not.toContain('<Svg width={12} height={12}');
  });

  it('aliases react-native-svg Text/Image to avoid colliding with react-native', () => {
    const root = node({
      name: 'Row',
      children: [
        {
          type: 'text',
          name: 'Label',
          width: 'hug',
          height: 'hug',
          style: { ...baseStyle },
          text: {
            content: 'hi',
            typography: {
              fontSize: 12,
              fontWeight: 400,
              lineHeight: null,
              color: null,
            },
          },
          children: [],
        },
        {
          ...vector('Icon'),
          svg: {
            jsx: '<Svg>\n  <SvgText>x</SvgText>\n  <SvgImage href="data:..." />\n</Svg>',
            components: ['Svg', 'SvgImage', 'SvgText'],
          },
        },
      ],
    });
    const code = generateRN(root);
    expect(code).toContain("import { Text, View } from 'react-native'");
    expect(code).toContain(
      "import { Svg, Image as SvgImage, Text as SvgText } from 'react-native-svg'",
    );
    // no duplicate bare `Text`/`Image` specifier
    expect(code).not.toMatch(
      /import \{[^}]*\bImage\b[^}]*\} from 'react-native'/,
    );
  });

  it('passes a leaf vector fill color through as the Svg color prop', () => {
    const root = node({
      name: 'Row',
      style: { background: '#ffffff', cornerRadius: 0, opacity: 1 },
      children: [
        { ...vector('Icon'), vectorColor: '#55555a' },
        { ...vector('Icon'), vectorColor: '#55555a' },
      ],
    });
    const code = generateRN(root);
    expect(code).toContain('<Svg width={12} height={12} color="#55555a" />');
  });
});
