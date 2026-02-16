/**
 * Runtime guard for plugin API v0.2.
 *
 * Compile-time structural checks live in v0.2.ts (included by tsconfig).
 * This test ensures removing 0.2 from SUPPORTED_API_VERSIONS is a
 * deliberate, visible act.
 */

import { SUPPORTED_API_VERSIONS } from '../../renderer/plugins/manifest-validator';

describe('Plugin API v0.2 contract', () => {
  it('v0.2 is still a supported API version', () => {
    expect(SUPPORTED_API_VERSIONS).toContain(0.2);
  });
});
