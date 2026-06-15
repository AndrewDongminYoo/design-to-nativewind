import { describe, expect, it } from 'vitest';

import { svgToJsx } from '../svg-to-jsx';

describe('svgToJsx', () => {
  it('maps elements to react-native-svg components and camelCases attributes', () => {
    const svg =
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M1 2H3" fill-rule="evenodd" clip-path="url(#a)" stroke-width="2"/>' +
      '</svg>';
    const { jsx, components } = svgToJsx(svg);

    expect(components).toEqual(['Path', 'Svg']);
    expect(jsx).toContain(
      '<Svg width="24" height="24" viewBox="0 0 24 24" fill="none">',
    );
    expect(jsx).toContain('fillRule="evenodd"');
    expect(jsx).toContain('clipPath="url(#a)"');
    expect(jsx).toContain('strokeWidth="2"');
    expect(jsx).not.toContain('xmlns'); // namespace declaration dropped
  });

  it('rewrites xlink:href to href and handles self-closing + nested elements', () => {
    const svg =
      '<svg><defs><clipPath id="c"><path d="M0 0"/></clipPath></defs>' +
      '<use xlink:href="#c"/></svg>';
    const { jsx, components } = svgToJsx(svg);

    expect(components).toContain('ClipPath');
    expect(components).toContain('Use');
    expect(jsx).toContain('<Use href="#c" />');
    expect(jsx).toContain('<ClipPath id="c">');
  });

  it('converts the SVGR playground example without throwing', () => {
    const svg = `<svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
<g clip-path="url(#clip0)">
<path d="M0 13.5757C0 6.07807 6.07807 0 13.5758 0Z" fill="url(#pattern0)"/>
</g>
<defs>
<pattern id="pattern0" patternContentUnits="objectBoundingBox" width="1" height="1">
<use xlink:href="#image0" transform="translate(-0.388889) scale(0.00326797)"/>
</pattern>
<clipPath id="clip0"><path d="M0 0H100V100H0Z" fill="white"/></clipPath>
<image id="image0" width="544" height="306" xlink:href="data:image/png;base64,iVBORw0KGgo="/>
</defs>
</svg>`;
    const { jsx, components } = svgToJsx(svg);

    expect(components).toEqual(
      expect.arrayContaining([
        'Svg',
        'G',
        'Path',
        'Defs',
        'Pattern',
        'Use',
        'ClipPath',
        'SvgImage',
      ]),
    );
    expect(jsx).toContain('patternContentUnits="objectBoundingBox"');
    expect(jsx).toContain('<SvgImage'); // <image> aliased to avoid RN collision
    expect(jsx).toContain('href="data:image/png;base64,iVBORw0KGgo="');
    expect(jsx).not.toContain('xmlns:xlink');
  });

  it('returns null for non-SVG input', () => {
    expect(svgToJsx('not svg')).toBeNull();
  });
});
