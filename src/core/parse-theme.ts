// Tolerant, eval-free extraction of color tokens from a user's Tailwind config
// or CSS theme. Pure and unit-testable. Anything we cannot parse is skipped, so
// callers degrade gracefully to arbitrary hex values.
//
// Returns a map of normalized hex (#rrggbb, lowercase) -> token name, e.g.
//   { "#3b82f6": "primary-500" }

/** Normalizes a hex string to #rrggbb lowercase, or null if not a 3/6-digit hex. */
function normalizeHex(raw: string): string | null {
  const match = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(raw.trim());
  if (match === null) {
    return null;
  }
  let hex = match[1].toLowerCase();
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return `#${hex}`;
}

/** Returns the inner text of the brace block that starts at `openIndex`. */
function matchBraces(source: string, openIndex: number): string | null {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    if (source[i] === '{') {
      depth++;
    } else if (source[i] === '}') {
      depth--;
      if (depth === 0) {
        return source.slice(openIndex + 1, i);
      }
    }
  }
  return null;
}

const KEY_RE = /^(?:'([^']+)'|"([^"]+)"|([A-Za-z0-9_-]+))\s*:\s*/;
const VALUE_RE = /^(?:'([^']*)'|"([^"]*)"|([^,}\s]+))/;

/** Walks a `colors`-style object body, emitting hex->token entries. */
function parseColorEntries(
  body: string,
  prefix: string[],
  out: Record<string, string>,
): void {
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /[\s,]/.test(body[i])) {
      i++;
    }
    if (i >= body.length) {
      break;
    }
    const keyMatch = KEY_RE.exec(body.slice(i));
    if (keyMatch === null) {
      i++;
      continue;
    }
    const key = keyMatch[1] ?? keyMatch[2] ?? keyMatch[3];
    i += keyMatch[0].length;

    if (body[i] === '{') {
      const inner = matchBraces(body, i);
      if (inner === null) {
        break;
      }
      parseColorEntries(inner, [...prefix, key], out);
      i += inner.length + 2;
      continue;
    }

    const valueMatch = VALUE_RE.exec(body.slice(i));
    if (valueMatch === null) {
      i++;
      continue;
    }
    const raw = valueMatch[1] ?? valueMatch[2] ?? valueMatch[3];
    const hex = normalizeHex(raw);
    if (hex !== null) {
      const name = [...prefix, key].join('-').replace(/-DEFAULT$/i, '');
      out[hex] = name;
    }
    i += valueMatch[0].length;
  }
}

/** Parses a Tailwind `colors: { ... }` object literal (flat or nested). */
function parseTailwindColors(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  const keyRe = /(?:^|[\s,{])colors\s*[:=]\s*\{/g;
  const match = keyRe.exec(source);
  if (match === null) {
    return out;
  }
  const openIndex = match.index + match[0].length - 1;
  const body = matchBraces(source, openIndex);
  if (body !== null) {
    parseColorEntries(body, [], out);
  }
  return out;
}

/** Parses CSS `--color-<name>: #hex` custom properties (incl. NativeWind @theme). */
function parseCssColorVars(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /--color-([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const hex = normalizeHex(match[2]);
    if (hex !== null) {
      out[hex] = match[1].toLowerCase();
    }
  }
  return out;
}

/** Extracts a hex -> token-name map from a Tailwind config or CSS theme. */
export function parseThemeColors(source: string): Record<string, string> {
  return { ...parseCssColorVars(source), ...parseTailwindColors(source) };
}
