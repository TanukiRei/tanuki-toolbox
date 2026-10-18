# Tanuki Toolbox / 黎猫工具箱

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
