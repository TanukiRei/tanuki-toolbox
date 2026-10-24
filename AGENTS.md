# Tanuki Toolbox / 黎猫工具箱

## Agent Interface

- Owner workflow (2026-10-24): use local file tools for source edits and the enabled Agent API for runtime settings, plugin installation/update/reload and graceful quit/restart. Discover credentials privately from the active profile, read status/operations first and verify durable receipts. Do not use mouse automation for routine management; explain any necessary UI operation to the owner first. Earlier one-time mouse permission does not authorize future routine control.
- Keep physical Windows installation/profile paths in their real on-disk spelling. Lowercasing the path used to start Electron can split Node ESM singleton modules, losing app-boot's root Include registry and breaking settings persistence/HMR. Case-insensitive comparisons do not authorize rewriting executable/import paths to lowercase.

- Do not return ctx.inject()/ctx.plugin() Fibers directly from apply or its startup promises. Cordis Fibers resolve to a Fiber, which is an invalid effect. Await readiness/errors and discard the value, returning void or a valid disposer. Test startup against the real Cordis lifecycle when authorized; parsing alone cannot catch this.
- Raw ASAR work must use Electron original-fs. Even an Electron Node-mode preparer holds its own app.asar open; generate staged bytes, wait for that process to exit and commit from the copied native helper in the private profile snapshot. Never run the write phase from the OneDrive development executable or change global process.noAsar. Canonicalize Windows archive paths before identity comparisons.

- Default off. Never embed generated connection keys, ports, machine paths or user receipts in source/packages. Keep stable per-profile key/port across disable/re-enable/restart/update.
- Closing must synchronously revoke HTTP listener/keep-alive clients and refuse new/queued operations; already-started safe package/file transactions may finish with durable receipts. Agent access must use the explicit allowlist, loopback binding, Bearer auth and browser-origin rejection, never eval/shell/arbitrary proxy or native auth bypass.
- Settings details are lazy and share DSH's locale/theme. Do not run functional API or native lifecycle tests without explicit user permission.
- Native desktop setup is exact-version and digest checked, waits for normal main-process exit, backs up originals and preserves ASAR offsets. Never change EXE/fuses, patch unknown versions, force-kill DSH, restore an old backup over an upgrade or use mouse automation for routine lifecycle operations. Keep AgentSetup.cs/exe/build hashes together using scripts/build-agent-setup.ps1. The native dispatcher must remain dormant without requests.

## Version and delivery

- Read the current version from package.json. Keep the package and every component manifest on the same version.
- Small changes, bug fixes and UI adjustments increment only the last number.
- A new component increments the middle number and resets the last number to zero.
- Change the first number only with the owner's explicit permission. Bump once per delivery.
- Preserve the package name dsh-local-plugin-center so existing installations upgrade in place.
- Build the generated client.js and client-chunks/ before publishing; GitHub installation must work without install-time build scripts.
- Latest owner instruction (2026-10-18): DO NOT publish/push/tag/release to GitHub unless explicitly requested for the current delivery. Local edits/build/package/install are the default. Keep main installable when publishing; never force-push or replace published tags.
- Update the one-click installer only when explicitly requested. In an authorized installer update, replace only the Toolbox package by default; retain third-party archives unless the owner explicitly requests updating all installation packages.
- Do not publish user profiles, credentials, conversations, backups or machine-specific installation scripts.
- Unless explicitly requested, do not run functional tests, browser acceptance or test installations. Necessary build, packaging and the requested local plugin update are allowed. State whether tests ran.

## Component lifecycle

- Read LIFECYCLE.txt before changing loading behavior. Disabled components must not preload feature code or run background work.
- Browser features live in client-src/ and are built into lazily loaded client-chunks/. Keep the client.template.js coordinator small.
- Import host feature code only when its component applies. Dispose requests, listeners, timers, DOM and state on disable; asynchronous callbacks must check lifecycle state.
- Global messages use NOTIFICATIONS.txt and Message Center, without adding another notification bar.
- Startup Guard restores managed shortcuts on explicit disable, not on normal shutdown or hot reload. Preserve manually changed shortcuts.
- recommendations.json is built into the release. The developer syncs installed and enabled third-party plugins at release time, excluding this toolbox. No runtime inventory scanner.

## Build

Run `node scripts/build.cjs` to regenerate browser files from checked-in source and assets. This parses generated JavaScript without executing plugin components. No dependency installation is required for this build. Windows launcher source and its compiled executable are checked in together; `scripts/build-launcher.ps1` rebuilds it on Windows.
The one-shot native restart worker uses `scripts/build-restart-worker.ps1`. Keep its C# source, executable and source/binary hash manifest together; the regular build rejects stale artifacts without executing the worker.

## Shared settings controls (owner request, 2026-10-20)

- All Toolbox settings dropdowns use `lib/settings-select-client.cjs` via the `__SETTINGS_SELECT_FACTORY__` build token and `client-src/settings-select.css`. Reuse it for future settings fields; do not introduce native OS select popups or hard-coded dark/black field backgrounds.
- Match rounded trigger and popup borders, theme-token gray surfaces, disabled states, grouped options and keyboard navigation. Models and provider/model dialogs share the same component.
- Notification bubble colors keep their existing status palette; number ink is black in light mode and white in dark mode.

## Shared Rules editor (owner request, 2026-10-23)

- Popup and detached Rules windows MUST share lib/rules-editor-client.cjs, client-src/rules.css and rules.locale.json. scripts/build.cjs embeds these same sources into client-chunks/rules.js and launcher/RulesEditor.html. Do not implement a second native layout or separate translations.
- RulesWindow.cs owns only native grouping/geometry/pipe/WebView hosting. Keep its SDK DLLs, license and build hashes together; never download/install the WebView2 Runtime silently. Preserve the in-app editor if the Runtime is unavailable.
- Forking must copy all row contents, order and enabled states at creation, with independent parent/child storage. Disabled rows must never reach the request-only rules block.

## Shared live sorting (owner request, 2026-10-24)

- All Toolbox drag sorting previews the full row at its live list position, with no insertion lines. Keep the original order until an in-bounds release; leaving the whole list, cancellation or loss of focus restores it without saving.
- Use lib/sort-motion-client.cjs through __SORT_MOTION_FACTORY__ for the same short spring-like row movement in the sidebar and provider/model lists. Keep React responsible for DOM order, capture pointers on a stable list container, and exclude animated transforms from hit testing. Honor reduced motion and clean up temporary listeners/frames/animations on cancellation or disposal.
- The Workspace sidebar entry is always visible; ignore older saved hidden values for it.
