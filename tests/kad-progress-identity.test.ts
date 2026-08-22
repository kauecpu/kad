import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

const themeSource = readFileSync(new NodeURL('../constants/theme.ts', import.meta.url), 'utf8');

const semanticTokens = [
  'brandSurfaceStrong',
  'brandSurfaceDeep',
  'onBrand',
  'onBrandMuted',
  'brandTrace',
  'tabActiveSurface',
] as const;

function themeBlock(name: 'light' | 'dark') {
  const declaration =
    name === 'light'
      ? /const light = \{([\s\S]*?)\n\};/
      : /const dark: ThemeColors = \{([\s\S]*?)\n\};/;
  const match = themeSource.match(declaration);
  assert.ok(match, `tema ${name} precisa continuar declarado`);
  return match[1];
}

function tokenValue(block: string, token: (typeof semanticTokens)[number]) {
  const match = block.match(new RegExp(`${token}:\\s*'([^']+)'`));
  assert.ok(match, `token ${token} precisa existir`);
  return match[1];
}

function relativeLuminance(hex: string) {
  assert.match(hex, /^#[0-9A-F]{6}$/i);
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    );

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(foreground: string, background: string) {
  const light = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const dark = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (light + 0.05) / (dark + 0.05);
}

test('os temas expõem a mesma identidade semântica de progresso', () => {
  for (const theme of ['light', 'dark'] as const) {
    const block = themeBlock(theme);
    for (const token of semanticTokens) {
      assert.ok(tokenValue(block, token));
    }
  }
});

test('os textos do destaque forte mantêm contraste AA em todo o gradiente', () => {
  for (const theme of ['light', 'dark'] as const) {
    const block = themeBlock(theme);
    for (const foregroundToken of ['onBrand', 'onBrandMuted'] as const) {
      for (const backgroundToken of ['brandSurfaceStrong', 'brandSurfaceDeep'] as const) {
        const ratio = contrastRatio(
          tokenValue(block, foregroundToken),
          tokenValue(block, backgroundToken)
        );
        assert.ok(
          ratio >= 4.5,
          `${theme}.${foregroundToken} precisa contrastar com ${backgroundToken}; recebeu ${ratio.toFixed(2)}`
        );
      }
    }
  }
});

test('a assinatura de progresso é puramente decorativa', () => {
  const componentUrl = new NodeURL(
    '../components/ui/kad-progress-signature.tsx',
    import.meta.url
  );
  assert.ok(existsSync(componentUrl), 'o componente de assinatura precisa existir');

  const progressSignature = readFileSync(componentUrl, 'utf8');
  assert.match(progressSignature, /export function KadProgressSignature/);
  assert.match(progressSignature, /pointerEvents="none"/);
  assert.match(progressSignature, /accessibilityElementsHidden/);
  assert.match(progressSignature, /importantForAccessibility="no-hide-descendants"/);
  assert.equal(progressSignature.match(/styles\.rail,/g)?.length, 2);
  assert.match(progressSignature, /colors\.brandTrace/);
});
