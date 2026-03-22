---
id: vitest-extensive-dependency-mocking
trigger: when testing complex React components with many external library dependencies
confidence: 0.7
domain: testing
source: session-observation
scope: project
project_id: dc7b32441e61
project_name: harness
---

# Extensive Vi.mock Setup for Complex Components

## Action
Mock each external library dependency separately using vi.mock() at the top of test files to isolate component behavior and simplify testing.

## Evidence
- Observed 7+ files with 5-15 vi.mock() calls each across multiple sessions
- Session 6148e335-52e0-4235-83b4-e8810fdf5c9e: Lexical components (LexicalComposer, ContentEditable, etc.), BeautifulMentions, and UI library components mocked individually
- Session 4856ee0a-a85e-44ce-988d-133f25f77051:
  - Plugin helper tests extensively mock: cast-device-manager, device-alias-manager, youtube-music-client, playback-controller, oauth helpers, etc.
  - Music plugin index.test.ts (21:07-21:08) expanded mocks with new functions: updatePlaybackSettings, getActiveSessionIds, identifyDevice, settingsSchema, device-alias-manager, oauth-routes, device-routes
  - Playback-controller.test.ts (21:09) demonstrates multiple vi.mock() calls at module level for all external dependencies (castv2-client, youtube-music-client, cast-device-manager)
- Mocks often capture state or callbacks for test manipulation (e.g., capturedMenuCallbacks in BeautifulMentionsPlugin mock)
- Allows tests to focus on business logic without worrying about nested dependency implementations
- Last observed: 2026-03-16T21:09:55Z (playback-controller.test.ts async timing)
