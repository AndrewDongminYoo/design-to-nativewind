// Optional LLM-assisted cleanup pass via the Claude API.
// Off by default. The API key is read from figma.clientStorage by the caller and passed in.
// This refines naming/structure only — it must not change the visual result.

import type { IRNode } from './ir';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

export interface RefineInput {
  apiKey: string;
  ir: IRNode;
  generatedCode: string;
}

const SYSTEM_PROMPT = [
  'You refine auto-generated React Native + NativeWind components.',
  'Improve component and variable names and extract obviously repeated subtrees into local sub-components.',
  'Do NOT change className values, layout, or any visual output.',
  'Return only the code, no explanation.',
].join(' ');

/** Returns refined code, or throws on a network/API error so the caller can fall back. */
export async function refineWithLLM({
  apiKey,
  ir,
  generatedCode,
}: RefineInput): Promise<string> {
  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // The plugin UI is a browser iframe; the API blocks browser-origin calls
      // via CORS unless this opt-in header is present.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `IR:\n${JSON.stringify(ir)}\n\nGenerated code:\n${generatedCode}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
  };
  const text = data.content.find((block) => block.type === 'text')?.text;
  if (!text) throw new Error('Anthropic API returned no text block');
  return stripCodeFence(text);
}

/** Removes a surrounding ```lang … ``` fence the model often wraps code in, so
 * the textarea and "Copy code" get compilable source rather than markdown. */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```[^\n]*\n([\s\S]*?)\n?```$/.exec(trimmed);
  return fenced ? fenced[1].trim() : trimmed;
}
