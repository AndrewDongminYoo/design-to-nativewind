/** @jsx h */
import {
  Button,
  Container,
  Muted,
  render,
  Text,
  Textbox,
  VerticalSpace,
} from '@create-figma-plugin/ui';
import { emit, on } from '@create-figma-plugin/utilities';
import { Fragment, h, type JSX } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';

import type { IRNode } from './core/ir';
import { refineWithLLM } from './core/llm';
import type {
  CodeGeneratedHandler,
  ConfigHandler,
  ConversionErrorHandler,
  ConvertHandler,
  GetConfigHandler,
  ImportThemeHandler,
  SetApiKeyHandler,
} from './main';

function ConvertView() {
  const [code, setCode] = useState<string>('');
  const [ir, setIr] = useState<IRNode | null>(null);
  const [error, setError] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [refining, setRefining] = useState<boolean>(false);

  useEffect(() => {
    const offCode = on<CodeGeneratedHandler>('CODE_GENERATED', (payload) => {
      setError('');
      setCode(payload.code);
      setIr(payload.ir);
    });
    const offError = on<ConversionErrorHandler>(
      'CONVERSION_ERROR',
      (message) => {
        setCode('');
        setIr(null);
        setError(message);
      },
    );
    const offConfig = on<ConfigHandler>('CONFIG', (config) => {
      setApiKey(config.apiKey);
    });
    emit<GetConfigHandler>('GET_CONFIG');
    return () => {
      offCode();
      offError();
      offConfig();
    };
  }, []);

  const handleConvert = useCallback(() => {
    emit<ConvertHandler>('CONVERT');
  }, []);

  const handleCopy = useCallback(() => {
    if (code) void navigator.clipboard.writeText(code);
  }, [code]);

  const handleApiKey = useCallback((value: string) => {
    setApiKey(value);
    emit<SetApiKeyHandler>('SET_API_KEY', value);
  }, []);

  const handleRefine = useCallback(async () => {
    if (!ir || !apiKey || refining) return;
    setRefining(true);
    setError('');
    try {
      const refined = await refineWithLLM({ apiKey, ir, generatedCode: code });
      setCode(refined);
    } catch (e) {
      // Keep the deterministic code; surface the failure in the error slot.
      setError(e instanceof Error ? e.message : 'LLM refinement failed');
    } finally {
      setRefining(false);
    }
  }, [ir, apiKey, code, refining]);

  return (
    <Container space="medium">
      <VerticalSpace space="large" />
      <Text>
        <Muted>
          Select a frame, then convert it to React Native + NativeWind.
        </Muted>
      </Text>
      <VerticalSpace space="medium" />
      <Button fullWidth onClick={handleConvert}>
        Convert selection
      </Button>
      <VerticalSpace space="medium" />
      <Text>
        <Muted>Anthropic API key (optional, for LLM cleanup)</Muted>
      </Text>
      <VerticalSpace space="small" />
      <Textbox
        password
        placeholder="sk-ant-…"
        value={apiKey}
        onValueInput={handleApiKey}
      />
      <VerticalSpace space="medium" />
      {error ? (
        <Text>
          <Muted>{error}</Muted>
        </Text>
      ) : null}
      {code ? (
        <Fragment>
          <Button secondary fullWidth onClick={handleCopy}>
            Copy code
          </Button>
          {apiKey ? (
            <Fragment>
              <VerticalSpace space="small" />
              <Button
                secondary
                fullWidth
                disabled={refining}
                onClick={() => void handleRefine()}
              >
                {refining ? 'Refining…' : 'Refine with LLM'}
              </Button>
            </Fragment>
          ) : null}
          <VerticalSpace space="small" />
          <textarea
            readOnly
            value={code}
            style={{
              width: '100%',
              height: '360px',
              fontFamily: 'monospace',
              fontSize: '11px',
              whiteSpace: 'pre',
            }}
          />
        </Fragment>
      ) : null}
      <VerticalSpace space="large" />
    </Container>
  );
}

function ImportView() {
  const handleFile = useCallback(
    (event: JSX.TargetedEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        emit<ImportThemeHandler>('IMPORT_THEME', String(reader.result));
      };
      reader.readAsText(file);
    },
    [],
  );

  return (
    <Container space="medium">
      <VerticalSpace space="large" />
      <Text>
        <Muted>
          Import a tailwind.config.js or global.css to map colors to tokens.
          Only static color values are read; the file is never executed.
        </Muted>
      </Text>
      <VerticalSpace space="medium" />
      <input
        type="file"
        accept=".js,.cjs,.mjs,.ts,.css"
        onChange={handleFile}
      />
      <VerticalSpace space="large" />
    </Container>
  );
}

function Plugin(props: { mode?: 'convert' | 'import' }) {
  return props.mode === 'import' ? <ImportView /> : <ConvertView />;
}

export default render(Plugin);
