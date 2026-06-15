// Intermediate representation (IR): framework-agnostic node tree.
// Pure types only — no Figma or Preact dependency, so downstream modules stay testable.

export type IRNodeType = 'frame' | 'text' | 'image' | 'vector' | 'unknown';

/** A vector converted to react-native-svg JSX plus the components it references. */
export interface SvgRender {
  jsx: string;
  components: string[];
}

export type Axis = 'row' | 'column';

export type Sizing = 'fill' | 'hug' | { fixed: number };

export interface IRLayout {
  direction: Axis;
  /** main-axis distribution */
  justify: 'start' | 'center' | 'end' | 'space-between';
  /** cross-axis alignment */
  align: 'start' | 'center' | 'end' | 'stretch';
  gap: number;
  padding: { top: number; right: number; bottom: number; left: number };
}

export interface IRStyle {
  /** hex string like #RRGGBB, or null when no solid fill */
  background: string | null;
  cornerRadius: number;
  opacity: number;
}

export interface IRTypography {
  fontSize: number;
  fontWeight: number;
  lineHeight: number | null;
  color: string | null;
}

export interface IRNode {
  type: IRNodeType;
  name: string;
  layout?: IRLayout;
  width: Sizing;
  height: Sizing;
  style: IRStyle;
  /** present when type === 'text' */
  text?: { content: string; typography: IRTypography };
  /** Figma node id; used by the host to export vectors. Excluded from hoisting signatures. */
  id?: string;
  /** primary solid fill of a leaf vector (#rrggbb); absent for collapsed groups */
  vectorColor?: string;
  /** react-native-svg JSX for a vector, injected by the host after SVG export */
  svg?: SvgRender;
  /** when set, the node renders as a reference to a hoisted sub-component (`<Name />`) */
  componentName?: string;
  children: IRNode[];
}
