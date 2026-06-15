/** @jsx h */
import {
  Button,
  Container,
  Muted,
  render,
  Text,
  VerticalSpace,
} from '@create-figma-plugin/ui';
import { emit, on } from '@create-figma-plugin/utilities';
import { Fragment, h } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';

import type {
  CodeGeneratedHandler,
  ConversionErrorHandler,
  ConvertHandler,
} from './main';

function Plugin() {
  const [code, setCode] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const offCode = on<CodeGeneratedHandler>('CODE_GENERATED', (generated) => {
      setError('');
      setCode(generated);
    });
    const offError = on<ConversionErrorHandler>(
      'CONVERSION_ERROR',
      (message) => {
        setCode('');
        setError(message);
      },
    );
    return () => {
      offCode();
      offError();
    };
  }, []);

  const handleConvert = useCallback(() => {
    emit<ConvertHandler>('CONVERT');
  }, []);

  const handleCopy = useCallback(() => {
    if (code) void navigator.clipboard.writeText(code);
  }, [code]);

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

export default render(Plugin);
