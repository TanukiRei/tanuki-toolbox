# dsh-tanuki-toolbox · Tanuki Toolbox

[简体中文](README.md) · **English**

<img src="assets/toolbox.png" width="144" alt="Tanuki Toolbox">

A collection of independently switchable UI and interaction enhancements for **DeepSeek Harness (DSH)**: an editable quick bar, start page, composer controls, model settings, notifications, and plugin management, plus protected startup on Windows. Supports light/dark themes and follows DSH's Chinese or English UI language.

Current version: **0.7.9**. Includes redesigned model settings, compatible gateway speed controls, and a one-second hold for Windows background protected restart. This is a community plugin, not an official DeepSeek product.

## Install

In DSH, open **Plugins → Add plugin** and enter:

```text
https://github.com/TanukiRei/tanuki-toolbox
```

Then enable **Tanuki Toolbox** and choose your components in **Settings → Tanuki Toolbox**. Built client files are included; installation does not require compiling the plugin.

If Git is unavailable on your computer, open the [latest release](https://github.com/TanukiRei/tanuki-toolbox/releases/latest) and use its **Install without Git** URL, or download `tanuki-toolbox.tgz` and install the local package. A release's commit-specific download URL preserves the source repository for subsequent update checks.

To update an existing installation, install over it. Keep the package name `dsh-local-plugin-center`; uninstalling first is unnecessary and may discard host-managed settings.

## Components

| Component | What it does |
| --- | --- |
| **Startup Guard** | Checks declared version compatibility before protected startup and disables incompatible third-party plugins. On Windows, it can manage existing DSH shortcuts and optionally start DSH after sign-in. |
| **Quick Bar** | Provides editable navigation for Home, conversations, workspaces, scheduled tasks, skills when available, plugins, settings, and other shortcuts. Supports ordering, visibility, and a collapsible, resizable workspace sidebar. |
| **Start Page** | Displays a calendar, conversation/task totals, recorded token usage, recent activity, recent conversations, live tasks, and supported account allowance information. |
| **Composer Enhancements** | Adds time statistics, a compact model/effort/speed/output-detail selector, and file context-menu actions. Each subfeature has its own switch. |
| **Settings Enhancements** | Offers a compact Models page with provider/model switches, six-dot grips with pointer-captured dragging and white insertion indicators (including the original row), default model selection, and separate provider/model editing dialogs. |
| **Message Center** | Provides top-of-app Dynamic Island banners, system notifications, persistent status bubbles, and notification sounds. |
| **Plugin Center** | Combines plugin management with optional [Plugin Market](https://github.com/dsh-market/dsh-market) integration, update indicators, custom names, repository links, and recommendations. |

On Windows, hold Restart for **1 second**. A one-shot background worker checks the current instance and reopen entry, closes DSH, and then uses the existing protected launcher to prepare and reopen it. There is no extra fixed delay or automatic retry. Finish tasks and plugin installations first.

Plugin Center includes a search field for custom and original plugin names. Official cards have consistent sizes, with stable plugins above a divider and experimental plugins below. Update checks display text inside Plugin Center rather than a blue progress bubble; actual update/install operations retain their progress indicators.

Plugin Center works without Plugin Market. Install and enable `dshmarket` to add its market tab and supported online update features.

Settings shows the DSH version beside its title. An **Update system** button beside **Open config file** opens the native updater when an update is available; otherwise it displays a disabled **Up to date** status. The Settings update bubble follows Message Center’s **System updates** category and global bubble switch.

Provider switches preserve credentials, model configuration, and individual model restrictions. Disabled providers disappear from model selection and cannot receive new calls through DSH. A previously selected disabled model remains grey and blocks sending until another model is selected. Saved restrictions remain enforceable when Settings Enhancements is disabled; enable its Models view to change them. Reasoning levels use DSH’s own translations.

The Models header selects the default model and reasoning level used by the composer’s Reset button. Drag provider or model handles to reorder them, or use Alt + arrow keys; the composer follows the saved order. Disabled rows keep their positions. Inline fields and switches save automatically, while provider credentials and detailed model settings use Save/Cancel dialogs with unsaved-change prompts. The former duplicate model switches footer is removed.

After its first opening, Settings hides with an animation instead of unmounting its current page. Reopening resumes that page and its state. The hidden window releases its focus trap, and the Models page pauses its own reads and subscriptions. This is default Toolbox behavior, with no extra component switch.

Choosing a default in Models pins it separately and also updates the native DSH configuration. Later session-level model or effort changes stay local to that session. New sessions and Reset use the pinned default.

The Start Page reports recorded data, rather than estimating unrecorded usage. Missing or partial history is identified in the UI. Account allowance is available through a supported enabled provider integration, such as a signed-in Codex Subscription plugin.

## Default toolbox behavior: model switches

Enable **Settings Enhancements → Models**, then use the switches beside providers and models in **Settings → Models**. Enforcement of saved restrictions is default toolbox behavior, independent of the optional UI component.

- Disabled models are hidden from DSH's model catalogs and refused before model request dispatch.
- If a conversation already uses a disabled model, its selection remains as a grey, non-selectable placeholder. Sending is blocked with **“This model is disabled”** and the draft is preserved.
- Choosing an enabled model removes that placeholder and restores sending. Re-enabling the original model also restores access.
- The toolbox does not silently choose a different model, rewrite your default model, or forcibly interrupt requests already dispatched.
- Disabling the toolbox itself removes its model enforcement.

## Message Center settings

**Allow notifications** uses three toggle buttons. Green means enabled; hover over a button for its description:

| Source | Description |
| --- | --- |
| **Plugins** | Plugin updates available, update errors, updates in progress, and related plugin activity. |
| **Tasks** | Tasks in progress, completed, awaiting input, failed, and related task activity. |
| **System updates** | Updates to the DeepSeek Harness application itself. |

Dynamic Island banners enter from above the application and remain for eight seconds each, without hover/focus pauses. The newest banner pushes the previous one down. At most two live banners are retained; a third pushes out the oldest with a short downward fade, without a hidden backlog.

Message presentation has separate switches:

- **Dynamic Island:** banners at the top of the application. Turning this off hides in-app banners and discards their queue; it does not replay old messages when turned back on.
- **System notifications:** notifications when the app is unfocused, minimized, or hidden, where the platform supports them and permission has been granted.
- **Global bubbles:** persistent status badges beside relevant items. These have their own display switch and do not install updates or run tasks.
- **Notification sound:** sound accompanying notifications, with volume control and an optional MP3, WAV, or OGG file up to 5 MiB.

The source buttons control both reminder messages and matching persistent bubbles. Turning off Plugins hides plugin navigation/detail and update-all bubbles; turning off Tasks hides task bubbles. Re-enabling a source restores its current valid state, without replaying old messages or reviving cleared/read completions. The Global bubbles switch must also be enabled. Badge colors are unchanged. Protected-startup confirmation is a general message. Clicking it opens **Plugin Center → Installed → Third-party**. Task notifications open the associated conversation or task; plugin notifications open the appropriate installed plugin list. Clicking a notification does not automatically install anything or rerun a task.

When a component is disabled, its expanded settings automatically collapse. If you reopen them for inspection, its controls are greyed out and cannot be edited. Saved choices are retained.

## Language and themes

Toolbox-owned UI follows DSH's active language automatically:

- Simplified Chinese, Traditional Chinese, and other `zh` variants use Chinese text.
- All other languages use English text.

This does not change DSH's language preference. Third-party plugin names, descriptions, user-defined names, and conversation content remain their source text where no translation is supplied. Toolbox UI supports DSH's light and dark themes; status badge colors intentionally remain consistent.

## Loading and performance

Disabled optional components do not preload their feature code or start background work on a fresh launch. Enabling loads their code on demand. Disabling releases listeners, timers, cancellable requests, UI nodes, and feature state.

Each actual plugin-update check also asks the existing coordinator to recheck component switches and dispose any lingering disabled instances, without adding another periodic timer or clearing shared engine caches. Re-enabling requests the feature script again.

The default model policy and lightweight settings/coordinator remain active while the toolbox is enabled. JavaScript engines may cache code that was previously loaded; immediate zero memory usage is not guaranteed. See [LIFECYCLE.txt](LIFECYCLE.txt) for implementation details.

The native restart worker is rebuilt with `scripts/build-restart-worker.ps1`. Its source, executable and hash manifest are delivered together; the regular build checks them without running a restart.

## Compatibility and protected startup

The declared host range is **DSH `>=0.2.0-rc.2 <0.3.0`**. UI integrations may need adapting after DSH changes its page structure.

Windows shortcut protection, sign-in startup and force restart are platform-specific; unsupported controls are disabled on macOS. Runtime declared-version compatibility checking remains available. macOS layout respects window/fullscreen titlebar space, and notification activation uses Launch Services. Startup Guard checks **explicitly declared version incompatibility**; it cannot guarantee prevention of undeclared runtime crashes. Launching the original executable directly bypasses the shortcut launcher. Cached Windows pins may require repinning. Manually modified shortcuts are preserved rather than overwritten blindly.

## Updates and development

Released versions are published to [GitHub Releases](https://github.com/TanukiRei/tanuki-toolbox/releases). With Plugin Market enabled, Plugin Center can offer supported repository updates. There is no silent background installation.

```text
node scripts/build.cjs
```

This regenerates `client.js` and `client-chunks/` from the checked-in templates and assets, checks JavaScript syntax, and checks Chinese/English dictionary keys and interpolation parameters. No additional build dependency installation is required. Functional tests are separate from building and are not implied by a successful build.

The Windows protected launcher's C# source and executable are included together. To rebuild it on Windows, use `scripts/build-launcher.ps1`.

See [README.txt](README.txt) for the release history, [VERSIONING.txt](VERSIONING.txt) for version rules, and [NOTIFICATIONS.txt](NOTIFICATIONS.txt) for notification integration details.

## License

[MIT](LICENSE)


## Gateway speed integration

With **Settings Enhancements → Models** enabled, compatible OpenAI Chat Completions providers can read `capabilities.service_tiers` from `{baseURL}/models`. Only directly routed models explicitly advertising `priority` or `fast` expose speed controls. Provider IDs and full model IDs are preserved. Use **Refresh speed capabilities** in an expanded provider, or **Fetch available models**, to refresh the catalog. The compact card’s lightning button directly toggles **Standard / Fast**, sending `default` or `priority`. A matching control is used beside the native selector when the card is disabled. Initial/reset selections still inherit the gateway by omitting the tier; the first click explicitly requests Fast. Preferences are isolated by session, provider and model, and captured per task turn for retries, tool continuations and inherited child tasks.

Under the agreed gateway contract, enforced server speed policies take precedence. With the server policy set to default, the DSH-requested tier applies. A solid blue lightning icon represents the Fast request and uses the same color as reasoning effort; actual execution follows the API response.

The lightning button’s hover text reports actual gateway SSE confirmation, keeping waiting/unconfirmed distinct from confirmed Fast and preserving failure/interruption status. Credentials stay in the DSH host. Capability failures preserve existing configuration and offer an explicit refresh. There is no automatic account/model fallback, global fetch patch, or background capability poll. This integration has received build/static checks only, not live gateway or functional acceptance.
