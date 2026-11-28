// Feature: scenebeat-pwa, Property 64: Manifest URLs stay under the Deployment_Base.
// For any Deployment_Base (`/`, `/scenebeat/`, and generated paths of one to
// four URL-safe segments ending in `/`), resolving every URL in
// manifestUrls(MANIFEST) against `https://example.test<base>manifest.webmanifest`
// (and `id` against the resolved `start_url`) yields a URL whose path starts
// with that base; and every such URL is relative (does not start with `/` or a
// scheme).
// **Validates: Requirements 4.2, 4.4, 17.4**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { MANIFEST, manifestUrls } from '../../src/pwa/manifest';
import { deploymentBaseArb } from './arbitraries';

const ORIGIN = 'https://example.test';
const SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

function checkBase(base: string): void {
  const manifestUrl = `${ORIGIN}${base}manifest.webmanifest`;
  const startUrl = new URL(MANIFEST.start_url, manifestUrl);

  for (const raw of manifestUrls(MANIFEST)) {
    expect(raw.startsWith('/'), `${raw} must not be root-absolute`).toBe(false);
    expect(SCHEME.test(raw), `${raw} must not carry a scheme`).toBe(false);
    expect(raw.startsWith('//'), `${raw} must not be protocol-relative`).toBe(false);

    const resolved = new URL(raw, manifestUrl);
    expect(resolved.origin).toBe(ORIGIN);
    expect(resolved.pathname.startsWith(base), `${raw} -> ${resolved.pathname} under ${base}`).toBe(true);
  }

  // `id` resolves against the resolved start_url, not the manifest URL.
  const id = new URL(MANIFEST.id, startUrl);
  expect(id.origin).toBe(ORIGIN);
  expect(id.pathname.startsWith(base)).toBe(true);
}

describe('Property 64: Manifest URLs stay under the Deployment_Base', () => {
  it('holds for / and /scenebeat/', () => {
    checkBase('/');
    checkBase('/scenebeat/');
  });

  it('holds for generated deployment bases', () => {
    fc.assert(
      fc.property(deploymentBaseArb, (base) => {
        checkBase(base);
      }),
      { numRuns: 100 },
    );
  });
});
