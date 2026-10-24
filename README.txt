0.11.3 设置保存与回读修复 / Settings save/read ordering
- 工具箱在开始保存前取消并作废旧读取，保存结束后再通知界面刷新，防止消息分类、通知、会话优化、设置优化、启动保护和音量等控件被旧响应覆盖；失败仍保留错误提示并重新读取实际状态。
- 开机启动和组件列表读取使用各自的版本标记，避免开关保存完成后被之前的状态请求覆盖。
- 模型设置收到已保存的开关、默认模型或排序变更时，立即作废旧目录请求；速度控件不再让迟到的 HTTP 结果覆盖更新的事件流状态。
- 审查原生主题、语言、字体、模型服务设置共用的配置保存路径，沿用 0.11.2 的规范路径修复；规则编辑继续使用原有修订检查，侧栏顺序和显示偏好同步写入本地存储。
- 此次 GitHub 同步包含本机此前未发布的 Agent接口、规则独立窗修复及整行实时排序。默认关闭的 Agent接口仅在启用时监听当前电脑，关闭立即拒绝连接并保留连接资料。
- 完成必要构建、静态语法/翻译/原生文件摘要核对和打包；本机通过 Agent 接口更新并核对设置保留，不操作鼠标、不运行界面自动化测试，不更新一键安装器。
Toolbox writes invalidate older reads and notify views after unlocking; failed saves retain errors and reconcile actual state. Autostart and component inventory use independent read generations. Models invalidate old catalog requests on saved policy events, and late speed HTTP responses cannot replace newer streamed state. Native appearance/language/font/provider settings retain the canonical-path fix. This publication also includes the previously local Agent Interface, detached Rules editor fixes and live full-row sorting. Local deployment uses the Agent API; no mouse automation, UI tests or installer changes.

0.11.2 修复日间模式回退 / Light-mode persistence fix
- 保护启动先规范安装目录与 profile 的实际磁盘路径，快捷方式管理也保留实际路径大小写。避免 Windows 下以另一种大小写启动后，Node ESM 将原生模块视为两个实例，丢失配置重载根节点，导致主题短暂变亮后回退及插件热重载失败。
- Agent 接口增加严格限定的原生主题偏好读写（light/dark/system），通过 DSH 原生设置服务保存并校验版本；不开放任意设置或账号数据。
- 本机更新与正常重启通过 Agent 接口执行，已将日间偏好保存为 light 并读取持久化结果。必要构建/打包与操作回执核对完成；未运行界面自动化测试，未上传 GitHub，未更新一键安装器。
Protected startup canonicalizes physical installation/profile paths, and shortcut management preserves their on-disk spelling. This prevents Windows path-case variants from splitting native ESM singleton state and breaking the root Include registry used for settings persistence and hot reload. The Agent API adds narrowly scoped native light/dark/system preference reads/writes with revision checks. Local update/restart and saving the requested light preference use the API. Build/package and operation-receipt verification only; no UI automation, GitHub publication or installer changes.

0.11.1 修复 Agent接口启用 / Agent Interface startup fix
- 修复将 Cordis Fiber 直接作为启动结果返回而触发 Invalid effect、导致开关启用回滚的问题；等待子运行时启动，但不返回内部生命周期对象。
- 接受 Node 自带 fetch 的 Sec-Fetch-Mode，仍检查密钥、本机地址、Host、Origin 和 Sec-Fetch-Site，避免误拦本机 Agent。
- 桌面适配使用 Electron original-fs 读取原始 ASAR，避免虚拟目录误判；先生成适配文件，Electron 退出后由 profile 内的原生程序验证摘要并原子写入，避免安装进程占用自身归档。路径按 Windows 实际文件身份比较，不因大小写差异误报适配被改动。
- 连接说明预览默认遮住密钥；用户明确复制说明时包含真实密钥。
Fixes Cordis Invalid effect by awaiting runtime readiness without returning a Fiber. Accepts Node fetch's Sec-Fetch-Mode while retaining auth, loopback/Host and browser-origin checks. Raw archive work uses Electron original-fs without changing global noAsar. Instruction previews mask the key; explicit copying includes the credential.
- 已通过真实 Cordis 隔离回归，以及本机 DSH 验收：组件开启及设置页正常、正确/错误密钥、来源限制、关闭即断连、重新开启/重启保留连接，以及通过公开接口正常重启并确认新进程恢复。未上传 GitHub，未改一键安装器。
Real-Cordis regression and live DSH acceptance passed: startup/settings UI, valid/invalid credentials, origin restrictions, immediate disconnect on disable, retained connection on reopening/restart, and public-API graceful restart confirmed by a new main process. Native setup stages archive bytes with original-fs, waits for Electron to exit, then commits from the private profile helper with hash verification. Windows paths are compared by canonical file identity. No GitHub or installer update.

0.11.0 Agent接口 / Agent Interface
- 新增默认关闭的 Agent接口组件；开启后显示当前电脑的地址、密钥和可复制的连接说明。每台安装插件的电脑均可使用自身接口，关闭立即停止监听及连接，保留密钥与地址，重开、重启及升级后沿用。
- 提供经过 Bearer 密钥校验的本机 HTTP JSON API：状态、原生组件/插件列表、工具箱配置读写、插件安装/更新/移除、配置重载和接口操作日志。修改请求使用 UUID 去重与最近 200 份持久回执；不导出账号密钥、执行 Shell 或任意代码。
- Windows 正常退出/重启通过原生任务检查、准入锁及清理流程；首次启用后由单次隐藏程序等待正常退出，再备份并安装精确版本适配，下次启动生效。不强制关闭、不操作鼠标、不修改 EXE/fuses；未知版本明确标记不支持，基础 API 保留。
- 设置细节按展开加载、主题和中英文跟随 DSH；接口停用释放监听、连接、请求及队列，不在后台预热或扫描。已开始的安全文件/安装事务允许完成。
A default-off component exposes each installation's own loopback address, persistent management key and copyable Agent instructions. Disabling immediately disconnects clients while preserving details for re-enable/restart/update. Authenticated, bounded JSON operations reuse native plugin management, durable idempotent receipts and Toolbox preferences. The Windows graceful lifecycle adapter uses native inspection/admission/cleanup; one hidden setup transaction waits for normal exit and applies an exact-version backed-up adapter for the next launch. No mouse control, force-kill, EXE/fuse changes, account-secret export, eval or shell endpoint. Other systems/versions retain the base API. Details load only when expanded, use DSH's language/theme, and release activity when disabled.
- 仅做必要构建、静态语法/翻译/原生摘要核对、打包及本机更新。未运行接口功能测试、退出/重启或浏览器验收；未上传 GitHub，未改一键安装器。
Build/static parsing/translation/native-hash validation, packaging and local update only. No functional API, quit/restart or browser acceptance tests, GitHub publication or installer changes.

0.10.10 整行实时排序 / Live row sorting
- 侧栏工作区入口始终显示，不再允许隐藏；以前保存的隐藏状态不再影响该入口。
- 侧栏显示设置、模型服务商和模型目录统一采用整行实时换位、轻微回弹动画；移出所属列表框立即预览复原，只有在框内松手才保存。取消、失焦或关闭同样不保存中间排序。
- 跨组拖动的指针捕获放在稳定的列表容器，整行动画由共享工厂生成；动画中的位移不参与命中判断。遵循系统减少动画设置。
The Workspace sidebar entry is always visible, including for older saved hidden preferences. Sidebar visibility rows, model providers and model entries now preview full-row reordering with the same subtle spring motion. Leaving a list restores the original order; only an in-bounds release saves. Cancellation, focus loss and closing discard intermediate positions. Stable container pointer capture supports cross-group movement; one shared animation factory excludes temporary transforms from hit testing and honors reduced motion.
- 必要构建、静态语法/翻译核对、打包和本机更新；本版未运行交互测试。未上传 GitHub，未修改一键安装器。Build, static syntax/translation validation, packaging and local update only; no functional interaction tests, GitHub publication or installer changes.

0.10.9 规则窗跟随拖动修复 / Rules owner-movement fix
- 主窗口位置事件不再同步移动规则窗；只排队一次短时更新，合并中间位置并读取主窗口最新坐标，避免密集事件重入窗口拖动。
- 跟随移动保留焦点、尺寸以及两个窗口的层级，明确禁止重新调整主窗口的 Z 顺序及同步重绘消息。保持重叠时跟随、完全移出后独立放置的规则。
- 计时器只在收到位置事件后短时启动，完成即停止；关闭窗口时一并释放，无空闲位置轮询。
Owner location events now schedule one short deferred update instead of synchronously moving the Rules window from inside the event callback. Intermediate positions are coalesced and the latest owner coordinates are used. Follow moves preserve focus, size and both windows’ Z order, suppressing owner repositioning and synchronous paint requests. Overlapping windows still follow the owner; fully separated windows retain their independent position. The one-shot timer stops after processing and is disposed on close, with no idle position polling.
- 本机编译、构建、打包和更新；未上传 GitHub，未修改一键安装器。Local build/package/update only; no GitHub publication or installer changes.

0.10.8 修复原生规则窗启动 / Native Rules editor startup fix
- 原生编辑器改为固定的虚拟主机本地页面，不再因 NavigateToString 产生 data: 导航而被自身导航检查拦截。只允许该编辑页面，继续禁止外部内容；两种规则窗仍共用相同布局、样式和翻译。
- 宿主退出监听改用原生进程句柄，避免 .NET Framework 进程枚举误报不存在。
- 独立窗拖动采用鼠标按下瞬间的抓取点，异步回调到达后也保留已移动的距离，避免快速拖动丢失位移。
- 准备期间保留页面内拖动和关闭能力；新手势更新当前放置，失败后仅保留可编辑浮窗，不再每拖一次就自动重新进入等待。显式重试仍可再次启动。
The native editor now loads one fixed local virtual-host document, avoiding the self-blocked data: navigation produced by NavigateToString. External content remains blocked and both editors share their UI sources. Native process-handle monitoring replaces unreliable framework process enumeration. Native dragging preserves the original pointer-down grab offset through async callbacks. Pending preparation permits dragging/closing, tracks replacement gestures and no longer automatically retries on every drag after failure.
- Local native compilation/build/package/install; no GitHub publication or installer changes.

0.10.7 规则窗连续拖动与窗口联动 / Continuous Rules window drag and grouping
- 清空回收站采用无描边、无阴影的红底白字按钮。
- 规则栏展开时按需准备隐藏的原生编辑窗；首次拖动保持鼠标捕获及页面内跟随，原生窗就绪后接续同一次按住动作。松手位置按该次手势同步，不需要再次按下。
- 修复将 WebView 初始化取消导航误判为致命错误的问题，保留真正失败时的页面内编辑与重试。
- 原生规则窗保留统一编辑布局和圆角，以 DSH 所属窗口方式显示在本体上方，随本体最小化；与本体重叠时一起移动，完全移出后保持独立位置。
The Recycle Bin clear button now has a flat red fill and white text. Opening Rules prepares its hidden native editor on demand. One held drag continues from the popup into the native window, with gesture-matched drop positioning. Canceled bootstrap navigations no longer count as fatal WebView failures. The rounded native editor remains owned by DSH: it sits above its owner and follows owner movement only while overlapping; fully separate placement stays fixed. Both modes retain the same shared UI.
- Native compilation/build/package/local update only; no functional tests, GitHub publication or installer changes.

0.10.6 侧边栏图标颜色 / Sidebar icon colors
- 未选中的侧边栏图标进一步调淡；选中时日间使用完整的深色主题文字颜色，夜间使用白色。主页图标同步采用相同的状态配色。
- 保持 1.4px 实际描线、图标尺寸、侧边栏宽度及原有按钮和气泡背景。
Idle sidebar icons are softer. Selected icons use the full primary text color in light mode and white in dark mode, including the home glyph. The 1.4px rendered outline, icon sizes, sidebar width and existing button/bubble backgrounds are retained.
- Build/package/local update only; no functional tests, GitHub publication or installer changes.

0.10.5 侧边栏描线 / Sidebar outline weight
- 侧边栏 SVG 图标在当前 21.6px 尺寸下的实际描线调整为 1.4px；共享图标及选中状态的挖空细节同步使用相同权重。
- 保留图标大小、侧边栏宽度、按钮占位和日夜主题配色。
The shared sidebar SVG outline now renders at 1.4px at the current 21.6px rail icon size. Matching cutouts share the same weight. Icon size, rail/button layout and theme colors are retained.
- Build/package/local update only; no functional tests, GitHub publication or installer changes.

0.10.4 侧边栏描线 / Sidebar outline weight
- 按用户提供的 Codex 截图调整 SVG 图标描线，统一使用 24 单位画布下的 2.0 描线，在当前 21.6px 图标上约为 1.8px；管理菜单、选中填充的挖空细节和圆点同步调整。
- 保留图标当前大小、侧栏宽度、按钮占位及日夜颜色，纯 SVG 代码绘制，不增加图片资源或运行任务。
- Build/static checks/package/local update only; no functional tests, GitHub publication or installer changes.
Uses a shared two-unit SVG outline (about 1.8px at the current rail size), with matching menu glyphs, selected cutouts and dots, guided by the supplied Codex screenshot. Existing icon size, rail/button layout and theme colors are retained. No bitmap assets or runtime work are added.

0.10.3 侧边栏图标与仓库更名 / Sidebar icons and repository rename
- 回收站列表的三个点改用工作区同款原生图标与尺寸。
- 回收站入口选中时填充桶身、挖空两条竖杠；侧边栏图标缩为原来 90%，描线减细 1px，保留侧栏宽度及按钮占位，继续跟随日夜主题。
- GitHub 仓库改名 dsh-tanuki-toolbox，同步中英文安装链接及包的来源信息；包名 dsh-local-plugin-center 保持不变，支持原位升级。
- 本次同时发布此前本机交付的规则、会话优化和回收站等更新；保留规则分叉复制、原生会话／轨迹和底部／右侧插件挂载、永久删除确认。
- Necessary build/static checks/package/local update; no functional tests or installer changes.
Uses the native workspace ellipsis in Recycle Bin rows, adds a filled selected trash can with two cutout slots, and reduces sidebar icon size to 90% with thinner strokes while preserving rail/button dimensions and theme colors. Renames the repository to dsh-tanuki-toolbox and updates bilingual installation/source links without changing the installable package identity. Also publishes the previously local Rules, Conversation Enhancements and Recycle Bin deliveries, including forked rule states, native conversation/trajectory and plugin-panel integration, and confirmed permanent deletion.

0.10.2 回收站操作细节 / Recycle Bin actions
- 列表操作区与按钮使用透明背景，灰色描线，悬停仅提亮图标，跟随日夜主题。
- 回收站右键／三个点菜单增加“永久删除”，逐条确认并绑定该次移入记录，复用原生写锁与精确日志清理。
- 会话页倒计时统一使用“永久删除”。
- Build/static checks/package/local update only; no functional tests, publication or installer changes.

0.10.1 回收站工作区布局 / Workspace-style Recycle Bin
- 回收站左侧为任务列表，右侧复用原生会话绑定及对话／轨迹页面，不复制简化文本，保留原生插件挂载位置及底部统计。
- 输入区替换为恢复按钮与秒级完全删除倒计时；列表悬停位置显示恢复按钮，平时显示剩余小时／天数，恢复后返回原工作区继续会话。
- 左侧顶部增加红色清空按钮，确认后只永久清除确认时的精确列表；内容变化要求重新确认，无法安全释放的会话保留并重试。
- 只读浏览不改变宿主归档状态或任务派发限制；离开／停用恢复原生导航、视图和方法，取消订阅、计时器及请求。
- Build/static checks/package/local update only; no functional tests, GitHub publication or installer update.


0.10.0 会话优化与回收站 / Conversations and Recycle Bin
- 修正规则窗的隐藏初始化等待，以及 WebView 回调内同步拖动导致的重入卡顿；两种规则编辑器继续使用同一份 UI。
- 对话框优化更名会话优化，新增会话列表子开关；右键直接触发原生三个点菜单，归档只在菜单内显示，已置顶标记使用蓝色。
- 新增回收站组件；原生会话菜单支持移入回收站，保留原工作区归属，只读查看/引用，恢复后继续会话。组件启用期间调度 30 天到期清理，停用时停止清理，下次启用补处理。
- 原生归档集合保留只读限制。永久清理仅处理回收站中到期的精确会话，获取原生写锁后删除已核验的日志；不能安全处理时保留并稍后重试。
- No functional tests or browser acceptance were run for this release; build and local update only.

0.9.2 统一规则编辑器与分叉复制 / Shared Rules editor and fork copying
- 再次点击规则按钮会保存并收回独立编辑窗；移除对已可见窗体的重复 Show 调用，异常不再通过 .NET 对话框显示。
- 独立窗改为系统 WebView2 承载的本地页面，两种模式从 lib/rules-editor-client.cjs、rules.css 和同一翻译文件生成，统一图标、粗体标题、排版、字号、行号和按钮。保留 owner 层级、圆角、拖出动效及边缘缩放。
- 每行增加绿点启停与垃圾桶；停用行保留但不加入请求，悬停超过 1 秒显示完整规则。旧规则在读取时兼容为全部启用，用户修改时原子保存新结构。
- 原生分叉操作返回之前复制源会话规则快照，包含内容、顺序与逐条开关；先冲刷当前浏览器/独立窗的未保存编辑，分叉后各自独立。规则继续不写入对话正文或压缩来源。
- 仅构建、静态检查、打包和本机更新；未运行功能测试，未上传 GitHub 或更新一键安装器。
Uses a single DOM/CSS editor in the popup and a local WebView2-owned window, eliminating separate WinForms layout and repeated Show calls. Adds one-second full-text tooltips, per-rule enabled states and trash actions. Native session forks copy an independent snapshot of all rule contents/order/states before returning, with pending editor changes flushed first. Old records remain readable; rules are still request-only and excluded from compaction input. Build/static checks/package/local update only; no functional tests, publication or installer changes.

0.9.1 规则注入与独立窗交接 / Rules dispatch and detached editor
- 修复已保存规则可能因内部请求身份识别而被跳过：经宿主模块加载器获取 LLM API，并以官方 agent/request 事件和请求信号确认正式任务派发。LLM 注入不再等待可选计量服务；压缩等辅助请求仍跳过，规则不归档到聊天记录。
- 显示注入未就绪状态，避免规则静默失效；正式派发后以规则版本标记显示“当前规则已加入最近一次任务请求”，不记录额外的对话正文。
- 拖出时保留原面板尺寸和鼠标抓取位置，180ms 移动淡入，并接续拖动；独立窗保持圆角、同款 Segoe UI 字体、13px 正文和 11px 辅助文字，匹配当前窗口缩放。
- 保留既有规则及组件设置；必要构建、静态检查、打包和本机更新，未运行功能测试，未上传 GitHub 或更新安装器。
Fixes silently skipped rules by using the host module loader and public agent/request provenance. LLM injection no longer depends on optional token accounting; compaction and other auxiliary calls remain excluded. Adds hook readiness and attached-revision status. Detachment preserves panel size/grab offset, animates over 180ms and retains rounded corners and matching font sizes at the current window scale. Existing rules/settings are preserved. Build/static checks/package/local update only; no functional tests, publishing or installer changes.

0.9.0 规则组件 / Rules component
- 新增天平图标与任务独立规则；输入框权限按钮右侧显示规则入口和有效条数，向上展开、逐行编辑、回车换行、自动保存。
- 最新完整规则仅在正式任务派发时注入一次，不归档到上下文或压缩输入；空规则沿用原生逻辑。支持服务商压缩后重新附带规则，保留原生系统和权限约束。
- Windows 原生独立规则编辑窗归属 DSH，可拖动和边缘缩放；随宿主最小化，可被其他应用遮挡。其他平台使用应用内浮窗。
- 组件停用清理前后端注入、请求、订阅和窗口，保留用户规则文件。必要构建、静态检查、独立打包与本机更新；未运行功能测试，未上传 GitHub、未更新安装器。
Adds per-task autosaved rules, scale icons and a composer editor. Current rules are attached once at formal dispatch without entering history or compaction input; empty rules preserve native requests. Includes an owned, resizable Windows editor and an in-app fallback elsewhere. Disabling removes runtime hooks and closes editors while retaining saved rules. Build/static checks/package/local update only; no functional tests, publishing or installer changes.

0.8.33 组件移除 / Component removal
- 按用户要求移除独立陪伴组件的入口、设置、前后端实现、动画素材、原生程序和本机运行数据；移除前已另存完整离线组件备份及恢复说明。
- 保留七个现有组件、模型/速度/通知功能及其他配置。仅构建、打包和本机更新；未运行功能测试，未上传 GitHub，未更新一键安装器。
Removed the optional companion component, its UI, host code, artwork, native executable and local runtime data after creating a separate offline backup with restoration instructions. Keeps the seven other components and their settings. Build/package/local update only; no functional tests, GitHub publication or installer update.

0.7.9 中英文介绍与公开发布 / Bilingual descriptions and public release
- 中英文介绍页标题统一增加 dsh- 前缀，更新七个组件、默认功能、平台限制和安装说明的介绍；插件包名保持 dsh-local-plugin-center，支持原地升级。
- 本次发布包含此前本机交付的设置优化、服务／模型排序与开关、默认模型、对话框选择卡片、中枢速度控制、主题适配和通知修复，以及 1 秒长按与后台保护重启。
- 同步中英文插件描述与本机启用的推荐插件；新增 dsh-plugin 仓库 topic，为插件市场收录准备资料。仅声明实际提供的能力，不将收录准备描述为已收录。
- 必要构建、静态核查、独立打包及本机更新；按本次要求发布 GitHub。未运行功能测试或实际触发重启；不更新一键安装器。
Adds the dsh- prefix to the bilingual introduction titles and refreshes descriptions of the seven components, default behavior, installation and platform limits. Publishes the previously local-only model/settings, gateway speed, notification/theme and one-second protected-restart changes. Preserves the package identity for in-place upgrades, adds the repository topic required for catalog submission, and prepares a catalog entry. Build/static checks and local update only; no functional tests or live restart. One-click installer unchanged.

0.7.8 一秒长按与后台重启 / One-second hold and background restart
- 重启长按时间改为 1 秒，保留松开回退与再次接续；中英文说明同步更新。
- 去掉点击链路里的重复 PowerShell/WMI 检查与固定 1.5 秒等待。独立原生程序完成当前实例和重开入口的必要验证后，先终止当前 DSH，再由原有保护启动入口在后台完成检查并重新打开。
- 使用原生进程快照、创建时间与固定句柄确认目标，只处理当前实例及其同程序子进程；发现其他 DSH 实例或入口不一致时拒绝操作。HTTP 回执完成即继续关闭，丢失回执最多短暂等待，不自动重试。
- 外部程序仅在长按完成后启动，随单次重启结束退出；不增加关闭组件的后台消耗。源码、编译产物与摘要一起打包，常规构建只校验不执行重启。
- 仅构建、静态检查、独立打包及本机更新；未实际执行重启或功能测试，未上传 GitHub、未更新一键安装器。
Restart now uses a one-second hold. A one-shot native worker replaces repeated PowerShell/WMI probes and the fixed 1.5-second delay. After checking the exact instance and reopen entry, it closes DSH before the existing protected launcher performs preflight and reopens the app. Native identities and pinned handles prevent targeting unrelated instances; accepted transactions finish independently without automatic retries or a resident watcher. Source/binary hashes are checked during packaging. Local build/package/update only; no live restart or functional tests.

0.7.7 快速闪电实心配色 / Solid Fast lightning icon
- 中枢速度按钮开启快速时改为蓝色实心闪电，颜色复用推理等级的 DSH 业务主色变量；模型卡片和原生选择旁保持一致，关闭时继续描线。
- 按用户与接口方确认的契约补充说明：接口强制速度策略优先；接口为默认时按 DSH 请求的速度执行。闪电表示请求选择，实际档位仍以服务端返回为准；不改写服务商策略。
- 仅样式、提示与说明更新；必要构建、静态检查、独立打包与本机更新。未运行功能测试或真实服务联调，未上传 GitHub，未更新一键安装器。
Fast now uses a solid lightning icon with the same DSH color token as reasoning effort, including the inline control. Clarifies that enforced API speed policies take precedence; otherwise the DSH selection applies. The button represents the requested mode. Local build/package/update only; no functional or live-provider tests.

0.7.6 闪电直接切换速度 / Direct lightning speed toggle
- 支持速度的模型点击闪电直接在标准与快速之间切换，移除速度菜单及其定位、外部关闭和键盘监听。原生选择旁的速度按钮同步采用直接切换。
- 灰色表示未选择快速，点亮表示请求快速；悬停保留当前选择、下轮生效与上游实际确认/标准降档/失败状态。默认和还原仍保留中枢继承语义，首次点击明确请求快速，再次点击明确请求标准。
- 查询能力或保存期间禁止重复提交；无能力或读取失败时禁用，并在设置模型服务中保留重读入口。服务商拒绝快速会保留任务错误，服务商返回实际标准会显示标准降档，不自动降级重试，不凭响应耗时推测实际速度或限制。
- 仅构建、静态检查、独立打包与本机更新；未运行功能测试或真实服务联调，未上传 GitHub、未更新一键安装器。
Lightning now directly toggles Standard/Fast without a popup. Hover details keep the selected request tier separate from upstream confirmation, downgrade or failure. Gateway-default/reset semantics and per-turn isolation remain intact; the first click explicitly requests Fast. Removed popup listeners and preserved capability refresh in Models settings. Local build/package/update only; no functional or live-provider tests.

0.7.5 中枢模型速度接入 / Gateway model speed integration
- “设置优化 → 模型”内接入兼容 OpenAI Chat Completions 的模型目录扩展。根据 /models 的 capabilities.service_tiers 中 priority/fast 能力显示速度，不按服务商 ID 或 GPT 名称猜测。保留模型完整 ID 与现有服务配置。服务展开区增加重新读取速度能力入口。
- 模型卡片闪电菜单及原生模型选择旁提供继承中枢、标准、快速；分别省略速度参数、明确发送 service_tier=default、发送 service_tier=priority。不向未声明能力的本地/PC/DeepSeek 模型新增速度字段。
- 偏好按当前 profile 的会话＋提供商＋模型保存；任务开始捕获快照，重试和工具续写沿用，子任务继承创建者的速度快照（明确设置的子任务偏好优先）。中途改档影响下一轮。原有默认模型还原会将目标模型速度恢复为继承中枢。
- 复用原生 pi-ai 的完整流式适配器，仅为单次请求扩展最终 payload/headers/fetch；不修改全局 fetch 或共享服务商 headers。保留取消、工具、用量与正常错误流程；从 SSE 读取非空 gateway.generation 与 service_tier，区分等待确认、快速确认、上游标准、未确认及失败/中断。
- 凭据由宿主已有服务解析，不返回前端；磁盘只保存有界能力快照和速度偏好。目录失败保留旧设置但停用能力，提供重读入口；不自动降级或切换其他账号。关闭模型优化/组件时还原适配器、移除 UI 并取消目录请求与订阅，无更新轮询。
- 仅必要构建、静态检查、独立打包与本机更新。未做 GUI、模拟功能测试或真实中枢/模型联调；未上传 GitHub、未更新一键安装器。
Adds capability-based gateway speed controls inside Settings Enhancements → Models. Per-session/provider/model preferences map gateway default, Standard and Fast to omitted, default and priority tiers. Native pi-ai requests keep tools, usage and cancellation; request-local hooks observe gateway confirmation without patching global fetch. Capabilities and UI load on demand and clean up on disable. Local build/package/update only; no functional or live gateway tests.

0.7.4 模型排序光标与原位置提示 / Model drag cursor and original-position indicator
- 模型服务与模型目录排序改用侧栏同类的指针捕获交互，移除原生 HTML 拖放及其逐元素放置判定；拖动期间统一使用抓取光标，穿过输入框、按钮和行间空隙持续定位。
- 指针回到原行时在该行下方显示白线；其他位置按白线计算最终顺序，保持原顺序时不发起保存。
- 拖动到设置滚动区域边缘可自动滚动；仅拖动时监听位置变化，结束、取消、失焦、隐藏或卸载时释放指针、监听、动画帧与光标标记。
- 仅必要构建、静态检查、打包与本机更新；未运行功能测试，未上传 GitHub，未更新一键安装器。
Provider and model ordering use pointer capture instead of native HTML drag/drop, maintaining a grabbing cursor across controls and gaps. Returning to the source row shows a white line below it without saving an unchanged order. Edge scrolling and all temporary drag resources stop on completion, cancellation, hiding, blur or unmount. Local build/package/update only; no functional tests or publishing.

0.7.3 拖动位置提示与设置间距 / Drag indicators and settings spacing
- 模型设置的服务与模型目录均使用侧栏同款六点拖动手柄；拖动时以白色横线提示最终插入位置，支持行间空隙，松手才保存顺序。保留 Alt＋上下键排序。
- 取消、失焦、隐藏设置或关闭组件时清理拖动预览与临时监听；不增加后台扫描或轮询。
- 工具箱卡片内边距、标题与描述、子功能行和分隔线间距略微缩小；保留原来的整行点击区域、开关与收拢按钮高度。
- 仅必要构建、静态检查、打包与本机更新；未运行功能测试，未上传 GitHub，未更新一键安装器。
Uses the same six-dot drag grips as the sidebar, with white insertion indicators for provider and model ordering. Dragging saves only on drop and releases its preview/listeners when canceled or hidden. Toolbox card padding and subsetting gaps are slightly tighter. Local build/package/update only; no functional tests, publishing or installer changes.

0.7.2 模型设置重构与设置窗口保留 / Models editor and persistent Settings
- 模型页顶部增加添加服务与默认模型/推理等级选框，对话框还原按钮读取设置的默认选择。
- 服务与模型的三横手柄可拖动排序，Alt＋上下键可微调；顺序保存到当前 profile，并在宿主目录和对话框模型选择中使用。停用保留行位置。
- 服务展开后只显示 Provider ID、编辑和删除按钮；服务身份/密钥/地址/协议与模型详细设置改为弹窗，保存/取消独立，点外部或取消遇到未保存修改时提示。
- 列表名称输入结束、开关与排序自动保存；模型目录恢复默认/获取可用模型提供明确按钮，删除重复的底部模型启用区。
- 设置关闭改为动画隐藏并保留当前页、滚动和展开状态；隐藏释放焦点约束，模型页暂停自己的读取和监听。默认功能，无新增组件或子项。
- 使用原生配置修订号、字段路径和凭据接口，不读取已存 API 密钥。仅必要构建、静态检查、打包与本机更新；未运行功能测试，未上传 GitHub，未更新一键安装器。
Adds default model selection, persistent provider/model ordering, autosaved inline fields, and provider/model dialogs with unsaved-change prompts. Settings hides with animation and retains its current page. Native revision checks and credential storage are preserved. Local delivery only; no functional tests, publishing or installer update.

0.7.1 设置优化启用修复 / Settings Enhancements startup fix
- 修复模型设置首次渲染时展开空数据导致的异常，读取完成前显示空的补充服务列表，原生模型表单继续可用。
- 设置页发现运行中的宿主尚未登记新增组件时显示完整退出后重开的说明，避免只留下不可操作的灰色开关。
- 构建、静态检查、独立打包与本机更新；不上传 GitHub、不更新一键安装器。
Fixes the initial Models render when provider data is still loading, and explains when a newly added component needs a full DSH restart. Local delivery only.

0.7.0 设置优化与系统更新入口 / Settings Enhancements and system update controls
- 新增“设置优化”组件及“模型”子项：服务标题行展开原生编辑表单；服务开关位于最右侧，保留原生删除与保存操作；文本/图片输入类型改用绿色点亮按钮，保存下方增加整行收拢箭头。
- 整个模型服务禁用状态原子保存，关闭后过滤目录并在实际派发前拒绝新调用；保留原有单模型限制、草稿与已选禁用模型的灰色占位。默认模型管理可重新启用服务，不因关闭设置优化而无法恢复。
- 默认设置头部显示 DSH 版本和系统更新按钮，接入原生更新状态与更新窗口，不增加后台检查。消息中心“更新”改名“系统更新”，设置入口的更新气泡随对应类别与气泡总开关切换。
- 工具箱组件卡片改为透明底色、仅描边，缩小卡片间距。新增组件代码按开关加载，模型页关闭后释放页面订阅、观察器和请求。
- 推理等级沿用 DSH 自带翻译，不增加自定义命名输入框。
- 仅构建、静态语法检查、独立打包与本机更新；未运行功能测试，未上传 GitHub，未更新一键安装器。
Adds Settings Enhancements with provider-wide model switches and native expandable editors. Adds a default DSH version label and native update entry, with category-aware Settings bubbles. Retains native reasoning translations. Component cards use outlines and tighter spacing. Local build/package/update only; no functional tests, GitHub publishing, or installer changes.

0.6.24 模型选择卡片恢复与实机验证
- 在真实 DSH 桌面复现卡片回退为原生菜单，控制台明确报错 cannot get property "remote.session" without inject；补齐模型卡片和默认模型禁用占位两处调用模型目录所需的 remote.session、remote 与 sessions 注入声明。
- 去掉 0.6.23 中重复声明原生 conversation.input.model.label 的代码，修复宿主以 already declared 拒绝注册卡片的问题；卡片自己渲染标签，不重复拥有原生标签槽。
- 读取提供方偏好时保留注册项顶层 locale/inject 元数据；options 仅作旧封装兼容，避免丢失 Codex 的高速与输出详略控制。
- 保留原有卡片、推理滑条、模型/速度/输出详略选择、外侧重置和连续操作交互；不依赖全局刷新掩盖渲染异常。
- 在本机真实 DSH 窗口验收并留存截图，结果与范围见本次交付说明；不将此前静态构建当成功能验证。不上传 GitHub、不更新一键安装器。


0.6.23 macOS 适配核查与模型选择入口恢复
- 灵动岛使用宿主随窗口/全屏切换的 overlay-top 安全区，修复 Mac 全屏后仍保留 48px 标题栏间距，进入动画也按当前安全区从窗口外侧开始。
- Mac 在快捷栏关闭时，主页与插件中心独立避让标题栏；快捷栏已开启时不重复计算间距。模型卡片、模型选项、文件右键菜单及侧栏管理菜单避免进入原生标题栏区域；菜单可用高度相应收紧，保留日夜主题和减少动画偏好。
- 非 Windows 的快捷方式保护详情明确显示不支持入口接管，并停止无效状态轮询；不读取或展示从 Windows 同步过来的快捷方式状态。Mac 的强制重启按钮置灰并说明限制，不再引导安装 Windows 工具。运行中已声明的插件版本检查保留；不新增 macOS 登录项或 Dock 接管。
- Mac 点击系统通知时，改用固定 /usr/bin/open 和当前已验证 .app 路径请求 Launch Services 激活现有应用，再沿用原有条目定位，不接受用户传入可执行文件或参数。
- 模型卡片的注册不再等待默认模型屏蔽 UI 服务就绪；服务可用时原位连接禁用状态与占位处理，宿主拦截不变。同步当前原生模型标签子插槽声明，并兼容新旧注册项中的提供方偏好元数据。
- 稳定客户端协调器允许读取经同源授权资源接口返回的当前版本脚本，避免热更新后协调器仍保留旧版本号而拒绝重新启用的卡片/组件；继续 no-store 按需读取，不整页刷新，不缓存关闭组件工厂。
- 仅本机构建、静态语法/双语文案核查、打包与更新。未运行功能测试、浏览器模拟或 Mac 实机验收；未上传 GitHub，未更新一键安装器。


0.6.22 自启动修复、灵动岛双消息与插件搜索
- 修复通用快捷方式保护再次改写专用自启动入口，导致误报“手动修改”。专用入口不再参与通用接管/还原；旧入口仅在当前文件摘要与本 profile 管理日志完全一致时识别为工具箱改写，可正常关闭或重新开启，真正的用户改动仍不覆盖。
- 灵动岛每条显示 8 秒，不再因鼠标悬停或焦点遗留暂停。消息由应用顶部外侧进入，新消息位于上方，旧消息向下移；同时保留最新两条，第三条挤出最旧消息并向下淡出，不积攒隐藏队列。关闭/停用取消全部显示计时器，恢复前台清理过期消息。
- 插件更新查询不再产生蓝色进行中气泡，仅在插件中心显示“正在检查插件更新…”。真正安装/更新操作的进度气泡保留。
- 官方插件使用等高卡片，上方正式版，下方用横线分隔实验性插件；沿用原生官方分类、可选更多目录与详情功能。官方/第三方标签下新增搜索栏，可匹配插件自定义昵称、显示名和包原名。
- 每次实际开始插件更新查询时，复用核心开关协调器核对组件并清理已关闭的残留实例；无需新增周期定时器。关闭组件本来就会释放业务资源，再开重新请求脚本；不清空 Node/浏览器全局缓存，不承诺引擎代码内存立即归零。
- 本机更新并按明确指令发布 GitHub，不更新一键安装器；仅必要构建和静态检查，未运行功能测试或开机登录验收。


0.6.21 通知分类联动气泡与文档语言切换
- “允许通知”的插件、任务、更新分类同时控制对应提醒与全局气泡。插件类包括侧栏、插件详情和更新全部提示；关闭任务类也隐藏原生任务状态点，避免替代气泡消失后露出原提示。
- 重新开启分类后恢复最新且仍有效的气泡状态，不补播旧消息，不复活已读或已清除的任务提示；全局气泡总开关与固定状态配色保留。无新增后台请求、扫描或定时器，不改动独立任务栏完成计数。
- 简体中文 README 去掉逐段英文重复，保留顶部中英文页面切换链接；英文文档单独保留并同步说明。
- 必要构建、打包、本机更新并按本次明确指令发布 GitHub；未运行功能测试，不更新一键安装器。


0.6.20 消息中心设置与英文页面 / Message Center settings and English documentation
- “通知分类”改成“允许通知”；插件/任务/更新改为绿色启用、灰色关闭的按钮，悬停显示说明。更新指 DSH 本体更新，通知来源按钮保留原有提醒过滤范围，全局气泡独立控制。
- 新增“灵动岛”子开关和说明，仅控制应用内顶部消息。系统通知、全局气泡、提示音增加灰色小字说明；关闭灵动岛不会影响其他独立启用的通道，不补播旧消息。
- 所有组件关闭时自动收起细分设置。重新展开查看时选项为灰色且不可修改；保留已保存的子项选择。提示音关闭时音量与文件选项同样禁用。
- 全部工具箱自有界面统一为中文族（简体/繁体/地区变体）中文、其他语言英文，动态跟随 DSH，不改写宿主语言。补齐自有账号退出按钮与通知/主页/推荐信息的映射；第三方及用户内容保留原文。构建时核对 310 个中英文文案键和插值变量。
- 新增完整 README.en.md 英文页面与顶部语言切换链接，英文页面包含安装、六组件、默认模型屏蔽、通知设置、性能及兼容说明。按本次明确指令发布 GitHub；一键安装器不变。
- 完成必要构建与静态核对，未运行功能测试、浏览器验收或性能测试。
Allow notifications now uses green/grey source buttons with hover descriptions. Add an independent Dynamic Island switch and explanatory text for system notifications, global bubbles and sound. Disabling a component collapses its settings and makes child controls read-only without changing their saved values. Toolbox-owned UI follows DSH with Chinese for all zh variants and English otherwise; building validates all 310 bilingual keys and parameters. Add a complete linked English README. Publish this authorized release to GitHub; no installer update or functional/browser/performance tests.


0.6.19 安全启动消息目标 / Protected launch notification target
- 点击安全/保护启动消息固定进入插件中心 → 已安装 → 第三方列表。复用既有插件导航、返回列表和分类切换，灵动岛及系统通知保持一致；不再进入启动保护设置。
- 本机插件市场通过官方终端安装入口从 1.66.40 更新至 npm latest 1.66.42；保留升级前备份。一键安装器及其中第三方备用包不变。
- 工具箱仅必要构建、打包和本机更新；未运行功能测试，未上传 GitHub。
Protected launch notifications now open Plugin Center → Installed → Third-party, consistently from the island or system notifications. Reuse existing list/category navigation. Local marketplace updated separately through the official CLI to npm latest 1.66.42, with a backup. No functional tests, GitHub publishing or installer changes.


0.6.18 禁用模型占位与发送限制 / Disabled model selection and composer blocking
- 已有对话选中禁用模型时，模型名显示灰色，并为该对话保留一个不可选择的占位；其他禁用模型仍隐藏。切换可用模型后占位自动移除并解除限制，重新启用也可恢复。
- 使用原生 conversation.blocks 禁止发送按钮和回车发送，保留草稿、模型切换入口及其他插件的阻止状态，显示“该模型已禁用”；宿主仍拒绝禁用模型派发。不强制中断已发送请求。
- 属于默认功能，不增加组件或组件子项。默认状态脚本独立加载，仅挂载的输入框借用目录投影；读取小型本地开关、无后台扫描或轮询。适配原生与工具箱模型选择、中英文、日夜主题。
- 仅必要构建、语法检查、独立打包与本机更新，未运行功能测试，未上传 GitHub，未更新一键安装器。
Retain a grey, non-selectable placeholder for a disabled model already selected in a conversation; block sending using native composer blocks and show “This model is disabled”. Preserve drafts and model switching. Choosing another model removes the placeholder, and re-enabling restores access. Default Toolbox behavior without a new component, with scoped subscriptions and no polling. Local delivery only; no functional tests, publishing or installer update.


0.6.17 默认模型屏蔽 / Default model blocking
- 原生设置 → 模型底部增加每个提供方模型的启用开关；工具箱默认能力，不增加独立组件或组件子项。全部组件关闭时仍运行，工具箱本体关闭后停止。
- 按精确 provider/model 保存，关闭后从 DSH 模型目录和选择列表隐藏；宿主在请求准备、统一流入口及最后派发前拦截旧选择、默认选择与其他通过 DSH LLM 服务的调用。不自动改选模型，不删除提供方/模型配置，不强制中断已发出的流。
- 开关原子保存至当前 profile；管理页读取未过滤元数据，关闭的模型仍可重新启用。目录变化使用既有推送，无重组刷新或后台扫描；中英文及日夜配色适配原生设置。
- 仅构建、语法检查、独立打包和本机更新；未运行功能测试，未上传 GitHub，未更新一键安装器。
Default Toolbox behavior adds persistent provider/model switches inside native Settings → Models. Disabled models are hidden and refused at host request/dispatch boundaries, including stale selections; no automatic fallback or forced cancellation of in-flight calls. The management view retains disabled models for re-enabling. UI loads on demand; no polling or composition rewrite. Local delivery only, without functional tests, publishing or installer updates.


0.6.16 灵动岛悬停样式 / Notification island hover
- 去掉灵动岛消息主体与关闭按钮的悬停背景高亮和变色，保留手形光标、点击跳转、悬停暂停消失及键盘焦点提示。日夜主题和状态气泡颜色规则不变。
- 完成构建、独立打包和本机更新；未运行功能测试，未上传 GitHub 或更新一键安装器。
Remove hover highlighting from notification island content and dismiss controls. Preserve pointer cursors, navigation, hover-to-pause and keyboard focus indication. Local build/package/install only; no functional tests, publishing or installer updates.

0.6.15 登录自启动与技能入口 / Login startup and Skills shortcut
- 启动保护增加独立小项“开机自动启动DeepSeek Harness”，默认关闭，当前支持 Windows 当前用户登录后启动。明确开启时才在当前用户 Startup 文件夹创建指向现有稳定 ProtectedLauncher.exe 的快捷方式，须先启用并完成保护入口配置；未启用时不写自启动、不启动检查任务。
- 关闭小项删除工具箱自己的自启动快捷方式；显式关闭启动保护也清理该入口，普通退出、热更新不误删除。不替换或删除其他软件/用户创建的启动项；使用独占创建、文件摘要与所有权记录，手动改过的同名入口保留并报告。该开关表示工具箱入口状态，系统启动项禁用策略仍可阻止自动运行。没有管理员提权，不保证 macOS 登录自启动。
- 快捷栏新增可隐藏、可排序的“技能”，默认放在工具箱上方，保留已有顺序偏好。只订阅原生设置注册表：Skills Manager 注册了技能设置时显示，点击直接打开 skills-manager；未安装或停用时隐藏快捷图标，管理菜单保留灰色不可显示项。复用设置中的原生 IconSkillOutlineRegular，同一主题图标颜色规则。
- 文件小项改名“文件右键”，说明改为“任务中的文件增加右键操作。”，同步英文。
- 底部收拢设置只显示居中的上箭头，悬停不高亮或变色，保留整行可点、原文字行高度对应的点击范围、手形光标、键盘标签与焦点和收放动画。
- 完成构建、独立打包和本机更新；未运行功能或开机登录测试，未上传 GitHub 或更新一键安装器。
Add an opt-in Windows login-startup setting under Startup Guard, using the existing protected launcher. Own only the created Startup shortcut; preserve manual edits and remove the owned entry on explicit disable, never on normal shutdown/hot reload. Add an optional sortable Skills shortcut, using the native settings icon and live Skills Manager settings registration. Rename File right-click and simplify the full-width collapse action to an arrow without hover highlighting. Local build/package/install only; no functional/login-startup tests, GitHub publishing or installer updates.

0.6.14 组件标题悬停样式 / Settings heading hover
- 移除工具箱设置中可展开组件标题整行的悬停背景高亮与变色，保留点击展开/收起、手形光标、箭头动效和键盘焦点提示。启用开关和底部收拢按钮保持原有行为。
- 完成构建、独立打包和本机更新；未运行功能测试，未上传 GitHub 或更新一键安装器。
Remove hover highlighting from expandable component headings. Preserve the clickable row, pointer cursor, disclosure animation and keyboard focus indication. Local build/package/install only; no functional tests, publishing or installer updates.

0.6.13 主页信息看板 / Home dashboard
- 起始页改为可适应窄窗口和日夜主题的卡片看板：日期与本周日历、总对话（任务）、昨日任务、昨日 Token 消耗、今日任务、最近七天活动、我的额度、最近对话、进行中与待处理任务、常用入口。主页鲸鱼入口直接打开该页；不复制原生会话树或额外启动模型。
- 使用 DSH 当前 sessionQuery 的公开会话列表和可释放观察接口读取本机记录，统计有任务记录的普通对话（含归档，不含子智能体）；昨日任务按本机时区自然日内发起过 turn 的独立对话数计。最近对话可点击继续，正在运行或等待处理的任务复用原生实时状态并可点击进入。
- Token 按已记录请求的报告归属日期汇总，包含输入、输出、缓存输入及子智能体，排除分支继承事件的重复计算；不把 reasoning 再加到 output 之外。优先校验 totalTokens，缺失时仅在缓存读写等桶完整时求和。缺失或损坏数据明确显示 —、部分读取或 ≥ 下限，不将未知计为已确认零。
- 额度使用已启用 Codex Subscription 的现有受保护 RPC 与当前账号，不读取凭据、不切换账号、不另行调用 OpenAI。不提供该接口或未登录时显示不可用说明，不能据此推断其他提供方额度为零。
- 首次打开时才统计历史，最多并行读取两个会话并定期让出事件循环，每次完成释放观察句柄；宿主只短时缓存精简汇总，45 秒内重复访问可复用，明确刷新绕过缓存。离开主页/隐藏或停用取消未完成读取；没有后台历史扫描或额度轮询。只在可见主页恢复焦点、明确刷新或跨日时更新。
- 三个点管理菜单的功能图标与外侧快捷栏使用同一混色后的主题颜色，移除因不同底色叠加透明度造成的深浅差异。菜单文字和锁定眼睛的灰色状态独立保留；状态气泡不变。
- 完成构建、独立打包和本机更新；本次未运行功能测试，未上传 GitHub 或更新一键安装器。
Replace the existing Home page with a responsive themed dashboard: calendar, conversation/task totals, yesterday/today activity, recorded token use, seven-day activity, available Codex allowance, recent conversations, live tasks and shortcuts. Use cancellable public DSH history observations and the installed provider’s existing quota RPC, never credentials or fabricated numbers. Exclude inherited fork events and distinguish missing/partial usage. Read only while Home is open; bound concurrency, release observations and cache only a compact summary briefly, with no background history scan or quota polling. Match menu glyph colors exactly to the outer rail. Local build/package/install only; no functional tests, GitHub publishing or installer update.

0.6.12 通知唤起与主题适配 / Notification activation and theme support
- 灵动岛背景、边框、文字、数量、关闭与悬停状态改为 DSH 主题变量；全局状态气泡的固定颜色不变。
- 灵动岛主体点击跳转延续 0.6.9 的实现。系统通知改为先请求桌面宿主唤起已有 DSH 窗口，再复用同一导航；不再只依赖网页 window.focus。宿主仅从当前已识别的 DSH 桌面 Host 启动同一个安装位置的外壳，利用 DSH 自带单实例锁恢复、显示并聚焦已有窗口，不重启后端、不改写 DSH 安装文件，也不接受自定义程序、参数或 URL。
- 任务按 sessionId 打开对应对话，插件切到已安装及相应官方/第三方分类，并定位具体卡片；插件中心关闭时仍可在原生列表定位。可选 scheduleId 用于自动化任务页选中条目，无目标或已删除的条目仅进入所属页面。插件行变更补充 entryId，卸载通知不试图打开已不存在的插件。
- 桌面唤起仅在点击系统通知时发生；新增接口复用 DSH 连接授权并要求非简单 POST。只在消息中心开启时注册，点击串行去重，无额外后台扫描。支持已核实的 Windows/macOS 桌面 Host 形态，普通浏览器使用浏览器聚焦；操作系统前台策略仍可能限制抢占焦点。
- 有细分设置的组件，标题、图标、留白直到箭头组成同一个可键盘操作的展开按钮，开关独立。保留收放动画和底部收拢。
- 日间模式主页图标与其他快捷栏图标同色同浓度；三个点管理菜单的图标使用主题文字色，保留不可隐藏项的灰色眼睛。夜间主页原有配色不变。
- 完成构建、独立打包和本机更新；未运行功能测试或实机通知点击验收，未上传 GitHub 或更新一键安装器。
Theme the notification island while keeping global bubble colors. Clicking an OS notification requests the existing desktop window through DSH's verified single-instance shell, then routes to the conversation, plugin/category, task or settings destination. Only fixed local shell activation is allowed, from the recognized desktop Host and an authorized POST; browser-only clients retain browser focus behavior. No installation patch or background activation work. Make expandable settings headers one accessible button, separate from enable switches, and normalize daytime home/menu artwork ink. Built, packaged and installed locally; no functional/OS-click tests, GitHub publishing or installer updates.

0.6.11 日间配色适配 / Theme-aware controls
- 侧边栏展开与收起按钮共用主题背景与悬停色，取消展开按钮写死的深色背景；保留尺寸、位置和收放动效。
- 快捷栏选中图标的填充与未选中线条保持相同视觉浓度，选中状态仍有背景区别；气泡不受图标透明度影响。
- 插件中心已安装页的原生添加插件分体按钮改用随主题变化的背景、文字与分隔边框，保留原有操作和菜单。
- 清理不存在的侧栏主题变量，链接、键盘焦点、名称输入框、开关悬停、错误文字、模型控件强调色、滑条刻度与时间统计文字改用有效主题变量。气泡与灵动岛配色保留，图像素材、阴影及滑条白色滑块不作机械替换。
- 完成构建、独立打包和本机更新；未运行功能测试，未上传 GitHub 或更新一键安装器。
Use shared theme colors for workspace toggles, consistent selected/idle icon ink, and a theme-aware native add-plugin split control. Replace invalid sidebar aliases and fixed UI accents/timing text with native theme tokens. Keep notification colors and artwork. CSS-only changes; no new runtime work. Local build/package/install only, without functional tests, publishing or installer updates.

0.6.10 文件右键菜单 / File context menu
- 对话框优化新增可独立开关的“文件右键菜单”。在回答中的原生文件卡片上右键，可预览、打开、另存为、打开所在文件夹、复制路径和复制文件名；原生提供打开方式时也显示该入口。支持 Shift+F10、方向键与 Esc，中英文跟随 DSH。
- 复用原生文件槽、预览及打开接口，不拦截普通网页链接。另存为仅在点击后按段读取文件，检查文件版本与完整性；优先使用保存选择框，不支持时采用浏览器下载方式（该回退限制为 128MiB，保存位置遵循当前下载设置）。
- 子功能关闭时不加载代码，停用后移除菜单与卡片监听、中止读取并清理临时下载资源；保留现有原生文件操作。
- 完成构建、独立打包和本机更新；本次未运行功能测试，未上传 GitHub 或更新一键安装器。
Add an independent File context menu switch under Composer enhancements for native reply file cards. Reuse native preview/open/reveal and Open with when available; include Save as and copy path/name, with keyboard and bilingual support. Read bytes only on Save as, verify identity/version/completeness and prefer a save picker. Otherwise use browser download settings with a 128MiB memory limit. Disable unloads listeners, menu and active reads. Local build/package/install only; no functional tests, publishing or installer updates.

0.6.9 灵动岛消息跳转 / Notification navigation
- 灵动岛消息主体可点击，也支持 Tab、Enter 和空格；关闭按钮独立，不触发跳转。成功发起跳转后移除对应消息，系统通知复用相同跳转规则。
- 任务消息优先打开对应对话；未提供对话目标的任务消息进入自动化任务页。
- 插件消息进入原生已安装列表，由插件中心切到官方或第三方分类；可定位仍安装的目标插件，卸载通知保留原分类。
- 保护启动消息定位到工具箱的启动保护设置；DSH 更新消息打开原生更新窗口；模型、侧栏与名称设置错误分别进入对应设置或列表。未来消息可显式携带受限 destination 对象。
- 复用原生页面和设置 store，不通过临时切回对话强行重置插件页。定位设置项的临时观察器最多保留 5 秒，关闭组件立即清理；不加载关闭组件的业务代码。
- 完成构建、独立打包和本机更新；本次未运行功能测试，未上传 GitHub 或更新一键安装器。
Clickable, keyboard-accessible notification content opens the related conversation, plugin list/category, settings section, or native update window. Dismiss stays separate. OS notifications share the same routing. Use existing native stores and bounded click-time location work; retain disabled-component loading rules. Local build/package/install only; no functional tests, publishing or installer updates.
0.6.8 修复详情页组件图标及本体隐藏 / Detail row identity matching
- 原生组件行在挂载后使用带父级前缀的 entryId，未挂载时才使用短 rowId。组件图标规则现同时匹配两者，继续复用设置页的同一套六个组件图标。
- 工具箱本体隐藏规则同步兼容带前缀的运行时 ID，避免本体及其开关再次出现在包含组件列表中。
- 保留 tanuki-toolbox-core 固定 Loader ID，不恢复匿名条目；不增加扫描、轮询或加载关闭组件的代码。
- 完成构建、独立打包和本机更新；本次未运行功能测试，未上传 GitHub 或更新一键安装器。
Match both short row IDs and parent-prefixed runtime entry IDs for component artwork and internal-core hiding. Keep the stable core Loader ID to avoid profile-reconciliation flicker. Local build/package/install only; no functional tests, publishing or installer updates.
0.6.7 组件说明、顺序与细分设置 / Component descriptions, order and collapsible settings
- 组件顺序统一为：启动保护、快捷栏、起始页、对话框优化、消息中心、插件中心；同步原生组件列表与工具箱设置列表。
- 六个组件的中文说明按用户指定文案替换，同步英文说明及组件清单；快捷侧栏改称快捷栏。
- 有细分设置的组件默认收起，在标题开关旁显示展开箭头；展开区域底部增加收拢按钮，使用高度和透明度过渡，遵循系统减少动态效果偏好。
- 收起后释放细分设置控件，收起时停止音频试听；不加载被关闭组件的业务模块。设置展开不改变组件启用状态。
- 完成构建、独立打包和本机更新；未运行功能测试，未上传 GitHub 或更新一键安装器。
Update bilingual component descriptions and order. Detailed settings start collapsed, expand from the heading arrow and collapse from a bottom action, with motion preferences respected. Collapsed controls unmount after their closing transition, and sound previews stop. Local build/package/install only; no functional tests, publishing or installer updates.

0.6.6 对话框优化设置层级 / Composer settings hierarchy
- 对话框优化大类与时间统计之间增加全宽横线，时间统计与模型选择之间增加内缩横线；沿用消息中心已有的颜色、间距和线条长度。
- 完成构建、独立打包和本机更新；本次未运行功能测试，未上传 GitHub 或更新一键安装器。
Reuse Message Center dividers: a full-width line below the Composer category and an inset line between Timing and Model selection. Local build/package/install only; no functional tests, publishing or installer updates.
0.6.5 弹框右移 / Popup offset
- 弹框右边缘改为对齐模型与恢复默认按钮组的右边缘，较上一版右移约 30px，保持位于原生语音/发送控件左侧；名称变化不参与宽度居中计算。
- 完成构建、独立打包和本机更新；本次未运行功能测试，未上传 GitHub 或更新一键安装器。
Anchor the popup to the right edge of the model/reset group, shifting it right by about 30px while retaining the native voice/send controls outside that edge. Local build/package/install only; no functional tests, publishing or installer updates.
0.6.4 模型卡片排版 / Model card layout
- 加高模型卡片到 126px，扩大标题行并禁止文字行被 flex 压缩，避免蓝色推理等级被裁切。
- 模型名称与推理等级交换位置：模型在上，蓝色推理等级在下。
- 弹框固定按输入框模型选择按钮的右边缘对齐，替代随名称宽度变化的居中定位；靠近窗口边缘时仍自动避让。
- 完成构建、独立打包和本机更新；本次未运行功能测试，未上传 GitHub 或更新一键安装器。
Increase the fixed card height and prevent label shrinking, with the model above the blue reasoning level. Anchor the popup's right edge to the composer model button instead of centering on its variable label width. Local build/package/install only; no functional tests, publishing or installer updates.
0.6.3 修复设置变更时界面重载 / Stable bundle lifecycle
- 为工具箱本体增加固定 Loader ID（tanuki-toolbox-core）。旧版匿名条目在 DSH 重新组合 profile 时会被删除并重新创建，可能导致浏览器卸载并重新挂载整套工具箱，短暂露出原生界面。
- 普通模型/速度等设置保存现在可复用本体的既有条目，而不因匿名身份丢失重建本体；真正关闭或卸载插件时仍按正常生命周期释放组件。
- 本体管理行继续在工具箱详情中隐藏，不增加独立的本体开关；不修改 DSH 或第三方插件的文件，不增加保活定时器或后台轮询。
- 本次完成源码链路排查、构建、独立打包和本机更新；未运行功能测试，未上传 GitHub 或更新一键安装器。
Give the bundle core a stable Loader entry ID. Previously, profile reconciliation treated its anonymous declaration as a new entry, disposing the previous host and potentially removing/re-adding the whole client bundle. The core row stays hidden in Toolbox details. Normal disable/uninstall cleanup remains intact. Local build/package/install only; no functional tests, publishing or installer updates.
0.6.2 恢复默认入口 / Reset button placement
- 恢复默认按钮移至输入框中模型选择按钮的右侧，无需展开卡片即可点击；保留悬停高亮与中英文提示。
- 弹出卡片移除外侧重置按钮与多余宽度，与输入框模型选择按钮水平居中对齐，贴近窗口边缘时自动避让；卡片展开时点击恢复默认不会关闭卡片。
- 完成构建、独立打包和本机更新；本次未运行功能测试，未上传 GitHub 或更新一键安装器。
Move Reset beside the composer model trigger, available even when the popup is closed. Remove the popup's external reset area; resetting while open keeps the popup visible. Local build/package/install only; no functional tests, publishing or installer updates.
0.6.1 模型卡片连续操作 / Continuous model selection
- 模型卡片缩至 260×100px（右侧重置按钮独立），不支持的控件继续保留位置。
- 暂时锁定仅阻止修改，不关闭卡片；模型、输出详略列表选择后保留展开，支持连续修改。切换会话、点击外部或 Esc 才主动关闭。
- 保存期间保持正常亮度，滑条提交后不跳回旧值；相同选择不重复写入。保存期间焦点丢失后 Esc 仍可关闭。
- 使用真实组件代码完成 Chromium 浏览器回归：连续修改、锁定、保存失败、默认重置、窄屏、中英文与清理；旧版临时锁定关闭问题已在模拟宿主中复现。尚未在真实 DSH 窗口复现用户所述整页闪动，浏览器组件测试不代表整机验收。
- 本机更新与独立打包；不更新一键安装器，不上传 GitHub。
Compact persistent model picker. Keep menus open during edits and transient host locks, avoid dimming during saves and redundant writes, and preserve Escape dismissal after temporary focus loss. Real component browser regression uses simulated host stores; full DSH-window flicker remains unverified. Local build/package/install only.
0.6.0 对话框优化 / Composer enhancements
- 新增独立组件“对话框优化”，包含可分别开关的“时间统计”和“模型选择”，中英文跟随 DSH。
- 原消息中心的任务计时迁入时间统计，继续依据真实回合开始/结束记录显示进行时间及成功完成耗时；关闭消息中心不影响该子项。
- 点击输入框模型按钮弹出固定大小的卡片：左上角闪电切换标准/高速，右上角展开输出详略，中部选择模型，下方滑条吸附模型实际支持的推理等级。所有按钮支持悬停高亮。
- 不支持的控件隐藏但保留位置；模型列表沿用已安装提供方的可用模型与隐藏偏好。速度、输出详略复用 Codex Subscription 的原有偏好控制器，不创建虚假设置。
- 卡片右侧独立重置按钮读取 DSH 配置的默认模型与推理等级，同时恢复标准速度和模型默认输出详略；不改写 DSH 全局默认模型。
- 两个子项分别按需加载，关闭即卸载界面、监听及计时器；冷启动不加载已关闭子项的业务代码。新增本地小型设置字段，保留现有声音及通知配置。
- 仅构建、打包和本机更新；未进行功能测试、浏览器或实机验收，未更新一键安装器，未上传 GitHub。
Add Composer enhancements with independent timing and model-selection switches. Move the existing turn timer out of Message Center. The fixed-size popup offers a fast-mode lightning toggle, output-detail menu, model picker and discrete reasoning slider; unsupported controls retain their spaces. Reuse the host model directory and provider preferences, including hidden models. Reset restores the configured DSH default selection and standard/default provider options without changing the global default model. Each subfeature loads on demand and disposes on disable. Built and installed locally, without functional/UI tests, installer updates or GitHub publishing.

0.5.33 插件版本展示 / Installed version labels
- 插件中心第三方插件卡片在名称下方以小字显示已安装版本，保留自定义名称与统一卡片高度；复用现有插件清单，不增加请求或后台扫描。
- 黎猫工具箱基础设置总标题旁增加小号版本号，随构建版本自动同步。
- 仅构建、打包及本机更新；未运行功能测试，未更新一键安装器，未上传 GitHub。
Show installed versions beneath third-party plugin names using existing inventory data, preserving aliases and consistent card heights. Add the build version beside the Toolbox settings heading. Built and installed locally without functional tests, installer updates or GitHub publishing.

0.5.32 侧栏排序菜单精简 / Compact sidebar arrangement menu
- 移除顶部、底部说明文字，仅保留分组横线；下方列表与实际侧栏按同一上下顺序显示，最后一项位于最底部。
- 兼容上一版保存的排序，转换底部分组的存储顺序，保留原侧栏位置。
- 显示状态改为睁眼，隐藏状态改为闭眼，不可隐藏项目显示灰色睁眼；悬停提示支持中英文。
- 菜单宽度由 310px 缩至 210px，减少名称和状态图标之间的留白。
- 仅构建、打包及本机更新；未运行功能测试，未更新一键安装器，未上传 GitHub。
Remove group captions while retaining the divider. Both lists now follow the actual rail's visual order; migrate the previous bottom-up preference without moving existing rail icons. Use open/closed eyes for visibility and a muted open eye for required entries. Narrow the menu to 210px. Built and installed locally without functional tests, installer updates or GitHub publishing.

0.5.31 快捷侧栏分组排序 / Sidebar groups and ordering
- 三个点菜单在图标前增加拖动手柄，可调整组内顺序或跨横线移动；拖动时显示插入位置，松开后保存。
- 横线上方按顶部向下排列，下方按底部向上排列；每组第一项分别最靠近顶部或底部。保留原显示开关与初始布局。
- 恢复主页、新建会话、侧栏显示设置和系统设置等不可隐藏项目，标记“始终显示”；仍可拖动排序，不能隐藏。
- 顺序在重新打开 DSH 后保留；空组保留拖入区域，菜单过长时支持拖动边缘滚动。Esc、失焦、关闭菜单或停用组件取消未完成拖动。
- 排序手柄支持 Alt + ↑/↓ 调整顺序、Alt + ←/→ 切换到顶部/底部组；中英文跟随 DSH。
- 仅必要构建、打包及本机更新；未运行功能测试或浏览器验收，未更新一键安装器，未上传 GitHub。
Add drag handles before sidebar icons, move entries within or across top/bottom groups, and persist the layout on drop. The first entry in each group sits closest to its corresponding edge. Restore required entries as always visible while allowing reordering. Preserve visibility choices, handle empty groups and scrolling, cancel unfinished gestures on dismissal, and support keyboard reordering. Built and installed locally without functional/browser tests, installer updates or GitHub publishing.

0.5.30 macOS 插件中心操作栏 / macOS plugin toolbar
- 修复 Mac 原生插件页顶部避让样式覆盖工具箱定位规则的问题：刷新、更新全部、添加插件不再因额外 76px 顶部内边距而下移。
- 对旧 Mac 导出包 0.5.14 进行隔离模拟，复现主页/工作区与窗口按钮重叠；当前版保留已加入的 48px 标题区避让，全屏取消该留白。
- 使用真实 React、插件侧栏代码和 DSH 原生 CSS，在 Windows Chromium 中完成 5 组布局模拟：Mac 深浅色、窗口/全屏、800/900/1280px 宽度和 Windows 对照；覆盖操作栏对齐、侧栏拖动、收放、宽度重载及停用清理。
- 模拟不等同于 Mac 实机验证；窗口按钮与内容是示例，不覆盖 Cocoa 窗口行为、原生字体、第三方插件交互或 Mac 安装流程。
- 仅打包独立 .tgz 并更新本机；未改动 Mac/Windows 一键安装包，未上传 GitHub。
Fix native macOS page-header padding overriding the anchored plugin toolbar. The old Mac bundle (0.5.14) reproduces the traffic-light overlap; current versions reserve a 48px titlebar area outside fullscreen. Five isolated Chromium layout scenarios passed using real React, plugin sidebar code and DSH CSS, covering toolbar alignment, resizing, collapse/expand, reload persistence and cleanup. This is Windows-based layout simulation, not real macOS verification. No installer refresh or GitHub publishing.

0.5.29 设置齿轮中心镂空 / Settings gear cutout
- 选中齿轮的中心镂空沿用原中心圆的半径与位置，取消孔边描线对镂空尺寸的挤占；齿轮外轮廓保持原样。
- 仅本地构建、打包并更新本机；未更新一键安装器，未上传 GitHub，未运行功能测试。
Keep the selected gear's center cutout at the original circle's radius and position, with no inner stroke shrinking the opening. Preserve the outer outline. Built and installed locally without functional tests, installer updates or GitHub publishing.

0.5.28 快捷栏选中图标 / Selected navigation icons
- 定时任务改为圆形时钟：未选中描线，选中填充表盘并镂空指针。
- 工作区选中时填充文件夹下半部；插件中心选中时填充四个方框；设置选中时填充齿轮，中心孔保留镂空。
- 主页保持原鲸鱼图标，选中时在头顶增加小喷水图案；黎猫工具箱入口也增加选中填充状态，随实际打开的工具箱设置页切换。
- 图标沿用当前主题色，使用本地 SVG；没有新增后台扫描或加载其他组件。
- 仅本地构建、打包并更新本机；未更新一键安装器，未上传 GitHub，未运行功能测试。
Navigation icons now reflect the current page with outline and filled variants: a round clock with cutout hands, a folder with its lower body filled, four filled plugin squares and a filled gear with an open center. The original home whale gains a small water spout when selected. The toolbox shortcut also follows its settings page. Local SVG artwork uses the current theme without background polling. Built and installed locally without functional tests, installer updates or GitHub publishing.

0.5.27 分割线悬停样式 / Divider hover appearance
- 鼠标悬停或拖动工作区分割线时仅显示调宽指针，不再高亮分割线；保留键盘操作时的焦点提示。
- 本地构建、打包及更新本机；未更新一键安装器，未上传 GitHub，未运行功能测试。
Show only the resize cursor during pointer hover and dragging, retaining keyboard focus feedback. Built, packaged and installed locally without functional tests, installer synchronization or GitHub publishing.

0.5.26 工作区拖动调宽 / Resizable workspace sidebar
- 工作区与对话之间的分割线支持鼠标或触控拖动，松开后保存宽度；收起再展开、切换页面和重新打开 DSH 沿用保存值。
- 拖动时关闭收放过渡，使用动画帧合并更新；支持方向键微调、Home/End 调到边界、Esc 取消本次拖动。小窗口临时限制显示宽度，不改写保存值。
- 分割线仅在工作区展开时可用；停用侧栏清理拖动、指针捕获及监听，恢复原生布局。中英文提示随 DSH 切换。
- 按最新交付要求，本版仅本地构建、打包并更新本机，不自动上传 GitHub。本次另外按明确要求更新一键安装器，第三方备用包固定为本次下载版本；以后需再次明确要求才更新安装器或发布。
- 未运行功能测试或浏览器验收。
Drag the workspace divider to resize it and save the width for reopening, navigation and restart. Support keyboard adjustments and Escape cancellation, clamp temporarily for narrow windows, and clean up pointer capture and listeners on disable. Built and packaged locally without functional or browser tests. GitHub publishing and installer updates now require an explicit request for each delivery.

0.5.25 第三方插件图标 / Third-party plugin artwork
- 修复未声明包图标的第三方插件在插件中心只显示宿主默认图案的问题；插件列表和包详情页使用同一套图标补全。
- 优先保留宿主已正确显示的插件原图；补充读取已安装包声明的 icon、dsh.icon 和导出的 ./icon，不执行第三方插件代码。
- 插件市场使用上游 assets/logo.svg 方块标志；技能管理器使用其设置页的清单星芒图标。兼容资源的来源、固定提交及许可证随包保留。
- 当前 ModLens 和 Free Search 未提供独立图标，使用名称缩写兜底，不以作者头像或 DeepSeek 标志冒充插件图标。
- 资源从本机读取，无运行时 GitHub 图标请求；仅启用插件中心并进入管理页时加载，离开或停用取消读取、清理挂载图层。复用现有 DOM 观察器，不增加轮询。
- 仅必要构建、打包、GitHub 发布与本机更新；未运行功能测试或浏览器验收。
Preserve working native artwork, resolve declared local package/exported icons, and use verified Market and Skills settings marks when the manifests omit them. Keep lists and package details consistent; use name initials when a plugin has no dedicated icon. Read artwork locally on demand, cancel on exit, and restore native DOM on cleanup. Sources and licenses are included. Built and packaged without functional or browser tests.

0.5.24 GitHub 首次公开发布 / First public GitHub release
- 仓库：https://github.com/TanukiRei/dsh-tanuki-toolbox。补齐包的仓库、作者、主页和问题反馈地址，使 Git 页面及 GitHub 更新来源可识别。
- 仓库同时包含源码和已构建文件，可直接在 DSH 添加仓库地址或 GitHub 源码下载地址，无需安装时编译。
- 增加中英安装说明、MIT 许可证和可移植构建脚本；以后每次交付同步 main、版本标签和发布安装包。
- 本机插件从本地 .tgz 改为 GitHub 下载来源，保留原包名及已有配置；本地 .tgz 继续作为离线备份。
- 仅必要构建、打包与发布、本机来源迁移；未运行功能测试或浏览器验收。
Publish source and built files to GitHub, add repository metadata, installation documentation, MIT license and portable build scripts. Future deliveries update main, a version tag and a release package. Migrate this computer's existing package to a GitHub download source without uninstalling. No functional or browser tests were run.

0.5.23 消息中心子功能文字 / Message Center subfeature labels
- “系统通知”和“提示音”改为 13px、普通字重，与通知分类、全局气泡提示等子功能保持相同的视觉层级，中英文统一应用。
- 仅必要构建、打包及本机更新；未运行功能测试或浏览器验收。
Use regular-weight 13px labels for System notifications and Sound, matching the other Message Center subfeatures in both languages. Built and packaged without functional or browser tests.

0.5.22 工作区收放动效 / Workspace transitions
- 工作区收起和展开增加约 220ms 的宽度过渡与内容淡入淡出，内容保持原宽度，避免动画过程中挤压换行。
- 展开箭头同步滑入淡入，展开时淡出；保持 18px 宽、28px 高及与收起按钮相同的高度位置。
- 展开按钮移除普通和悬停边框，背景为 #1b1b1c，悬停背景为 #2d2d2e；保留键盘操作的焦点提示。
- 隐藏过程立即禁止工作区交互，停用组件时恢复原交互状态；动画由 CSS 驱动，不增加后台计时器、监听或轮询。遵循系统减少动态效果设置。
- 仅必要构建、打包及本机更新；未运行功能测试或浏览器验收。
Animate workspace width and content opacity over about 220ms without squeezing the rows. Fade and slide the narrow expand arrow with the pane, remove normal/hover borders, and use #1b1b1c / #2d2d2e backgrounds. Disable input to the fading workspace immediately and restore its original interaction state on cleanup. Use CSS transitions with reduced-motion support and no new background work. Built and packaged without functional or browser tests.

0.5.21 展开按钮对齐 / Workspace toggle alignment
- 展开按钮与原收起按钮保持相同的垂直位置，外框及可点击区域高度统一为 28px。
- 侧边展开标签缩窄为 18px，仅保留向右箭头；左侧贴齐分割线，右侧圆角，不占用对话标题布局空间。
- 展开与收起按钮共享高度参数；保持原有按需加载与停用清理，不增加监听、测量或后台任务。
- 仅必要构建、打包及本机更新；未运行功能测试或浏览器验收。
Align the floating expand tab with the original collapse control using shared header and button dimensions. Both controls have a 28px outer/clickable height; the expand tab is 18px wide with a single right chevron. Keep the tab outside title layout and within its left gutter, with no additional observers or background work. Built and packaged without functional or browser tests.

0.5.20 侧边展开标签 / Workspace edge tab
- 工作区收起后，展开按钮独立贴在对话区左侧分割线上，改为左侧平直、右侧圆角的带边框小标签。
- 按钮脱离对话标题栏布局，位于标题行下方；不再挤动标题，也不随对话内容滚动。
- 保留中英提示、键盘焦点切换和收起状态；复用现有观察器，停用快捷侧栏时清理挂载节点及定位样式。
- 仅必要构建、打包及本机更新；未运行功能测试或浏览器验收。
Replace the header-leading expand control with an independent bordered edge tab, flush with the conversation divider and rounded on the right. It stays below the title row without shifting the title or scrolling with messages. Preserve focus handoff, collapse preference and cleanup; no additional observers or polling. Built and packaged without functional or browser tests.

0.5.19 展开按钮位置 / Workspace expand placement
- 工作区展开按钮从左侧图标栏移至对话页左上角，使用原生对话头部的前置区域；空白新会话和已有会话均可显示。
- 按钮只在工作区收起时显示，沿用收起按钮的尺寸和风格；放在正常布局内，为会话标题留出空间。
- 保留收起状态、键盘焦点切换及隐藏工作区入口后的展开能力；随快捷侧栏停用清理自有节点，不增加观察器或轮询。
- 仅必要构建、打包及本机更新；未运行功能测试或浏览器验收。
Move the workspace expand control from the icon rail into the conversation header's leading area. Preserve collapse preference, focus handoff and the recovery path when the workspace shortcut is hidden. Built and packaged without functional or browser tests.

0.5.18 自动化入口与侧栏收起 / Automations and workspace collapse
- 快捷侧栏在工具箱设置上方增加“自动化任务”，直接进入 DSH 原生 schedules 页面；随原生页面注册/移除更新可用状态。
- “更多”的侧栏显示设置新增自动化任务，并仅列出可隐藏项目；主页、新建会话、系统设置保持固定显示，不再占用设置列表。
- 工作区“添加工作区”按钮右侧增加收起图标；收起时左侧图标栏保留展开按钮，即使工作区入口被隐藏也能恢复。
- 收起偏好单独保存，切换主页面、打开设置或热重载不丢失；点击工作区入口主动展开。原生工作区树保持挂载，不复制会话列表。
- 新增 UI、订阅与挂载节点归快捷侧栏组件管理，停用全部清理；不加载自动化任务业务代码或增加后台扫描。
- 推荐名单随构建按本机已安装且启用插件同步。本次仅必要构建、打包和本机更新；未运行功能测试或浏览器验收。
Add a native Automations shortcut above Toolbox settings and make it optional in the visibility menu. Hide fixed entries from that menu. Add a collapse button beside Add workspace, retain an expand button in the rail, and persist collapse preference independently of page navigation. Built and packaged without functional or browser tests.

0.5.17 插件管理与推荐 / Plugin management and recommendations
- “已安装与设置”改为“已安装”，其“已安装”分类改为“第三方”，中英文同步。
- 刷新与添加插件之间增加“更新全部”：仅真实可更新的第三方插件可用，官方包不参与；更新数量气泡沿用全局开关、颜色与计数规则。
- 批量更新逐个调用市场公开接口，市场自身最后更新；失败/状态未知即停止。热重载保留已提交操作与待执行队列，关闭组件清理待执行队列，不重复提交状态不明的安装请求。
- 工具箱详情中的组件图标直接复用设置页 SVG，不受宿主旧图标缓存影响。
- 每次构建从开发者本机已安装且启用的插件生成内置推荐；停用/卸载项下次交付移除。当前加入插件市场、Codex Subscription、Free Search、Skills Manager、ModLens、Better Sidebar。工具箱本身尚未在线发布，不推荐自身。
- 推荐仍只在展开时读取 GitHub 最新信息，不增加关闭组件的后台扫描。
- 本次仅必要构建、打包、同步安装器目录插件包及本机更新；未运行功能测试或浏览器验收。
Rename the management tab to Installed and its community category to Third-party. Update all uses verified Marketplace updates, serial operations and the shared bubble system. Component artwork reuses Settings assets. Every build regenerates baked-in recommendations from the developer's installed, enabled plugins; runtime metadata reads remain on demand. No functional or browser tests were run.

历史 0.5.16 DSH 0.2.1 插件分类适配 / Plugin category compatibility
- 适配 DSH 0.2.1-rc.2 的基础、扩展、更多官方分组；已安装分类只保留第三方安装列表，兼容旧版官方分组。
- 官方扩展的“更多”入口保留；从更多或详情返回，以及点击官方/已安装分类，均沿原生返回路径回到列表。
- 官方包依据宿主 official 标记识别，不因它可卸载而混入第三方 Git、更新按钮和更新气泡。
- 版本规则再次明确：新增组件第二组加1并清零第三组；小修改、修复、界面调整第三组加1；第一组只在用户明确允许时修改。
- 按要求仅必要构建、打包和本机插件更新；未运行功能测试或浏览器验收。
Recognize DSH's basic, extensions and more official groups while retaining the older official group. Keep the native More entry and return navigation. Official packages do not receive third-party update/Git controls or update counts. Built and packaged without functional or browser testing.

历史 0.5.15 对话状态与 Mac 顶部布局
- 每个对话仅显示当前状态，重新运行优先蓝圈并清理旧完成提示；查看后清除已读终态。
- 修正任务行气泡与工作区聚合提示不一致的问题。
- Mac 桌面顶部为原生窗口按钮预留空间并恢复拖动区域；不修改宿主应用。
- 仅静态检查、必要构建打包和本机插件更新；未运行功能测试或 Mac 实机验收。

历史 0.5.14 Windows 通知图标
- 通知正文图标改为透明背景、白色鲸鱼，保留原轮廓和抗锯齿边缘，移除白色方形底。
- 应用于后续新通知；不修改Windows应用分组图标、任务栏角标或已发送通知。
- 仅构建打包和本机更新，不发测试通知，不更新一键安装器。

历史 0.5.13 Windows 已完成任务角标
- Windows 任务栏数字仅统计成功完成、尚未查看的任务；打开对应对话且聚焦后减数，清零或停用消息中心时移除。
- 不同步插件更新、错误、等待输入等其他提示；颜色与完成气泡统一。
- 依赖本机授权安装的桌面受限角标接口；未具备接口的桌面不猜测调用、不启动辅助进程。
- 桌面补丁需完全退出并重新打开后生效；桌面升级可能覆盖补丁，原始备份和还原工具独立保留。
- 仅静态检查、构建打包和本机更新，未运行功能/浏览器测试，不更新一键安装器。

历史 0.5.12 更新气泡计数修正
- 更新成功记录不再持续占据气泡计数；成功/需重启或刷新信息仍保留在更新结果提示中。
- 将可更新摘要与实际已安装版本及已验证成功版本协调，过滤相同目标版本的旧摘要，统一更新按钮、通知和计数。
- 不乐观扣除失败或状态未知的操作；新的更高目标版本仍保留提示。
- 仅构建打包与本机更新，不运行功能/浏览器测试，不更新一键安装器。

历史 0.5.11 任务耗时
- 上下文百分比右侧增加本轮任务耗时：进行中蓝色 #55A9E6，成功完成绿色 #14E878，HH:MM:SS 格式。
- 计时属于消息中心组件；使用真实任务时间，成功结束后固定耗时，关闭组件清理资源。
- 仅必要构建、打包和本机更新，未运行功能/浏览器测试，不更新一键安装器。

历史 0.5.10 任务已读气泡与系统通知
- 蓝色运行环独立保留；红绿完成气泡仅在对应对话未查看时显示，打开对应对话且聚焦后清除。任务左侧状态位置同步显示，避免只在工作区入口提示。
- 系统通知使用官方DSH鲸鱼图标；完成标题“已完成”，正文取本轮最后文字回复（最大8000字符，实际显示长度由Windows决定）。点击打开对应会话；插件通知定位插件列表卡片。
- 重新聚焦只清理已查看任务的系统通知，不再一次清空其他任务通知。仍尊重系统授权、横幅与勿扰规则。
- 快捷侧栏悬停文字与显示管理菜单一致；账号和余额增加退出登录按钮，复用原生DeepSeek账号退出确认，不退出Codex。
- 仅构建打包和本机更新，未运行功能/浏览器测试；不更新一键安装器，不强制退出DSH。

历史 0.5.9 统一组件图标与推荐卡片
- 五个组件使用统一24px网格、蓝绿配色的扁平图标；设置页直接复用组件SVG，不再维护另一套图形。
- 工作区侧栏只在工作区页面展开，主页/插件中心/其他页面隐藏；系统设置等弹窗不影响背后的工作区侧栏。
- 推荐插件改为容器宽度自适应、最多三列卡片：左上图标与名称，已有用户别名时显示别名及原名，下方版本与最多三行简介，右侧安装/Git按钮。
- 删除推荐区说明备注，展开后在折叠箭头左侧显示刷新图标按钮。推荐名单不变，仍只在展开时获取GitHub信息。
- 只执行必要构建、打包和本机更新，不运行功能测试/浏览器验收，不更新一键安装器。

历史 0.5.8 更新按钮配色
- 有可用更新时，更新按钮背景及边框与黄色气泡统一为 #E6E63C，文字为黑色；悬停保持同色，形状尺寸和业务不变。

历史 0.5.7 连续圆环与原位任务状态
- 导航环由26缩为22px，任务行原生状态位置使用18px环，移除右侧重复气泡。
- 合并同色相邻象限；单色直接画完整圆，不再四段拼接。多色区域采用圆角端点，保留优先级分区。
- 蓝色使用一个圆角进度块非匀速旋转；多色时以蓝区蒙版限制绘制，不覆盖其他颜色。
- 原生状态只在替代气泡实际挂载时隐藏，关闭或卸载自动恢复；保留读屏状态文本。
- 构建、打包及实际本机更新；未运行浏览器或功能测试。

历史 0.5.6 侧栏显示管理、单环气泡与通知设置
- 快捷侧栏不再因打开系统设置或页面导航收起工作区；增加工具箱设置入口及三点显示管理菜单。主页、新建会话、系统设置固定显示，其余入口可保存显示偏好。
- 气泡仅一个四色环；红>黄>蓝>绿，非最高优先级各占固定四分之一（黄左上、绿右上、蓝右下、红左下），最高优先级占剩余面积；超过一条显示实际总数，蓝色区循环进度动画。
- 无额外基础设置的组件只保留图标、标题、描述与开关。系统通知及提示音分别提供功能开关；系统通知仍需平台授权。
- 提示音按音量、文件名、三个按钮排列；恢复默认提示音并将音量保存为100，已有音量不会在升级时被覆盖。
- 按用户要求仅必要构建、打包及本机更新，不运行功能测试或浏览器验收，不更新一键安装器。

历史 0.5.5 设置卡片与 iOS 开关配色 / Settings cards and iOS switch colors
- 全局原生开关仅修改颜色：开启绿色、关闭灰色、滑块白色；保留尺寸、圆角、滑动、聚焦和禁用行为。停用工具箱时移除配色。
- 工具箱设置每个组件使用圆角边框卡片，标题左侧显示组件图标，标题及描述下有长分隔线，内部小类之间有较短分隔线。
- 仅调整样式与布局，不变更设置存储、组件启停或消息逻辑。按用户偏好仅构建、打包与本机更新，不运行功能测试或浏览器验收，不更新一键安装包。

历史 0.5.4 消息中心与统一设置 / Message Center and unified settings
- 工具箱设置内的组件开关复用原生插件详情接口；标题、灰色描述取自同一插件元数据。设置导航使用线性工具箱图标。
- “侧边栏”更名为“快捷侧栏”，“灵动岛”组件更名为“消息中心”；消息中心包含灵动岛展示和可独立关闭的全局气泡。
- 消息按插件、任务、DSH更新分类勾选；聚焦时只使用灵动岛，后台在已授权且平台支持时增加系统通知。授权必须由用户点击；不提供iOS普通网页关闭后的远程推送或服务工作线程。
- 默认合成提示音增强，默认音量50；已有保存音量保留。拖动结束可试听；音频名在滑条上，保存/选择文件/恢复默认三个等宽按钮。恢复默认原子保存默认音频和音量50，保留消息分类与气泡开关。
- 全局气泡使用绿（完成）、黄（需操作）、红（错误）、蓝（进行中）同心空心圈，最多三种颜色；同时四种状态时不显示气泡，数量大于1才显示数字。通知分类和气泡开关相互独立。
- 气泡按启用组件适配原生任务行、插件入口，以及工具箱插件中心、快捷侧栏。不会在插件中心关闭时新增网络更新扫描。当前原生接口未提供通用的插件可更新数量，不会凭空显示第三方插件尚未暴露的更新状态。
- 保留0.5.3外部重启修复。本次不执行真实DSH重启，不更新一键安装包。新功能的静态检查/构建不等于实际GUI、系统推送或跨平台验收；历史版本测试不代表本版新增功能已经过功能测试。

历史 0.5.3 Windows 外部工具启动修复 / Windows restart helper launch fix
- 已用无害marker脚本复现PowerShell 5在detached:true时静默exit 0且不执行脚本，与真实事务空日志/无回执一致。
- 改用等待型PowerShell bootstrap，通过Start-Process创建独立隐藏console worker并分别记录日志；不是仅移除detached标志，避免父进程退出时共享console结束。
- 通过无害父子进程实际验证启动及父退出后继续执行，不需要改动宿主或放宽进程身份校验。
- 重启失败提示改为警告图标，避免绿色成功勾造成误导。
- 已完成针对性回归；没有实际终止当前DSH。更新后应正常退出并从保护入口重新打开一次，加载新代码并解除旧未知事务锁。之后才使用重启按钮；不可自动清除未知事务或自动重试。
- 已生成独立包；当次本机安装被另一插件的最低发布时间策略阻止，并回退至0.5.2。一键安装包不变。
Reproduced silent exit 0 with a harmless Windows PowerShell marker. Use a waiting PowerShell bootstrap to create an independent hidden-console worker with file-backed output. Harmless production-launch-function checks passed under Node and Electron (3/3 each), including parent exit; actual DSH termination/relaunch remains untested.

历史 0.5.2 布局、基础设置与重启诊断 / Layout, settings and restart diagnostics
- 顶部菜单与内容增加分隔线，侧栏采用顶部菜单底色；底部从上到下为插件中心、设置、重启。
- 工作区面板只进入不折叠，隐藏原生收缩与拖拽柄；工作区提示行去除，搜索、视图、新建保留原生控件并移至面板顶部。当前不提供拖拽调宽。
- 插件中心移除960/1320px最大宽度，按实际面板可用宽度自动显示1/2/3列（760/1160px分界），大窗口最多3列。
- DSH设置新增“黎猫工具箱”基础设置，按五组件分区，入口不依赖组件启用；设置业务打开时按需加载。
- 灵动岛支持0–100音量、上传本地MP3/WAV/OGG（5MiB以内）与恢复默认。音频保存在当前profile，上传前浏览器解码并经后端验证；关闭组件不加载/播放，释放音频和Blob URL。
- 重启增加helper日志、参数/解析/权限/退出诊断与错误码；原生进程创建时间精确校验、无回执及时反馈、旧事务不可重放，失败未知状态不自动重试。
- 验证：隔离React/Edge布局、长按与设置交互，设置接口102项检查，音频/卸载生命周期及重启模拟测试；真实只读Probe通过。没有执行实际终止/重开，没有真实已登录GUI端到端验收（测试浏览器被现有GUI鉴权阻挡）。历史重启失败原因无法由缺失日志唯一确定，不能声称完整重启实测成功。
- 本次更新独立插件和本机，不更新一键安装包。当前进程若保留旧未知重启事务锁，请先正常退出并经保护入口重新打开一次，避免反复强制重试。
Responsive full-width center, fixed workspace rail, lazy toolbox settings, configurable notification volume/local audio, and safer restart diagnostics. Isolated browser and regression checks passed; full live-GUI and destructive restart acceptance remain unverified. Installer unchanged.

历史 0.5.1 外部重启工具 / External restart tool
- 重启按钮长按约2秒触发，圆环随按住增长，松开逐渐回退，再次按住从剩余进度继续；键盘空格/回车同样支持长按。窗口失焦取消未完成的长按。
- 这是强制重启：会终止当前 DSH 实例及其同程序子进程，再通过既有保护入口重新打开。未完成任务/插件安装可能中断，未保存内容可能丢失；请在安装和任务完成后使用。
- 外部工具随插件及本次一键安装包内置，无需手动运行工具、不需要修改宿主或应用旧安全重启补丁。无法确认当前实例或保护入口时拒绝重启。
- 工具仅在明确长按后按需启动，已接受的事务独立完成；不创建常驻监视器，不自动重试。重启事务记录留在本机 TanukiToolbox/restart-transactions 目录。
- 本次更新独立包、本机插件和一键安装包；未实际重启、未做功能测试或安装器测试。
Hold Restart for about two seconds. Releasing drains the ring; holding again resumes it. This force-terminates the identified DSH instance and reopens it via the protected launcher. Finish tasks and installations first. The external tool is bundled; no desktop patch is required. Not functionally tested.

历史 0.5.0 图标侧边栏 / Icon Sidebar
- 新增52px图标栏：主页、新会话、插件中心、工作区、重启、设置。原生工作区原位保留，设置右键打开账号菜单，关闭组件恢复原布局。
- 当时准备但未应用的宿主补丁方案已被0.5.1外部工具替代，请勿再运行旧补丁。

历史 0.4.6 灵动岛提示音 / Notification chime
- 消息实际显示时播放约 0.34 秒轻柔双音；排队消息轮到显示时再响，重绘不重复响。
- 使用本地 Web Audio 合成，无需下载音频；停用时释放音频上下文与交互监听。
- 浏览器自动播放限制可能要求先点击页面；受限的旧消息不补播。
- 仅构建、打包和更新本机插件，未运行功能测试，一键安装包不变。
A soft two-note chime plays when each notification appears. Audio is generated locally and released on disable. Browser autoplay restrictions may require a page interaction first; blocked sounds are not replayed later.

历史 0.4.5 右侧按钮间距 / Action spacing
- 已安装卡片右侧按钮间距从 8px 缩至 4px，底部命名按钮多留出 12px 空间；卡片高度及按钮尺寸不变。
- 已构建打包；不运行功能测试，不更新一键安装包。
Installed-card action gaps are reduced from 8px to 4px, leaving 12px more clearance below Name without changing card or button sizes.

历史 0.4.4 顶栏精简与名称居中 / Toolbar cleanup and centered titles
- 移除插件中心右上角刷新和返回对话按钮，保留自动刷新与有更新时的跳转入口。
- 已安装主名称改为 17px，附带原名为 15px；整行与 40px 图标上下居中，小字继续与大字基线对齐。
- 仅构建、打包和更新本机插件；不运行功能测试，不更新一键安装工具。
Removed the center's Refresh and Back to chat actions. Installed titles use 17px type, with 15px original names, vertically centered beside the icon. Automatic refresh remains unchanged.

历史 0.4.3 命名按钮与单行名称 / Naming action and inline titles
- 主标题恢复 16px，与图标底部对齐；有自定义名称时后接 14px 原名，共用文字基线。原生详情入口保留。
- Git 下方增加「命名」按钮，点击原位向左展开输入框。Enter 保存，Esc 或点击框外取消，清空并保存恢复原名；兼容中文输入法。
- 本次只更新独立插件和本机，不更新一键安装工具。未运行功能测试或界面验收。
Titles use 16px type beside the icon, followed by the original name at 14px when renamed. The Name action below Git becomes an inline input. Enter saves; Escape or blur cancels. The one-click installer is not updated.

历史 0.4.2 已安装插件自定义名称 / Custom installed-plugin names
- 已安装卡片标题改为两行：上方为自定义名字和紧随其后的笔形按钮，下方保留较小的原名，两行整体与图标垂直居中。
- 点击笔形按钮在其左侧展开输入框；Enter、再次点击笔形按钮或点击输入框外保存，Esc 取消。清空后保存可移除自定义名。中文输入法确认候选时不会误提交。
- 名称仅影响显示，原插件标识、详情入口、更新和 Git 地址保持原有逻辑。名称保存在当前 DSH 配置的 .tanuki-toolbox/plugin-aliases.json，重启及插件升级后保留。
- 仅已安装列表提供此编辑入口。保存接口与界面归属插件中心组件，随组件关闭释放，没有新增后台轮询。界面文案支持中英文。
- 按默认偏好仅做构建、语法检查、打包及本机插件更新，未运行功能测试或界面验收。
Installed cards show an editable custom name above the original name, centered vertically beside the icon. Enter, blur or the pencil saves; Escape cancels. Names persist in the current DSH profile and do not change plugin identity. The editor follows Plugin Center's on-demand lifecycle. This release has not been functionally tested.

历史 0.4.1 按需加载与关闭释放 / Lazy activation and disposal
- 功能按组件分开加载，关闭状态冷启动不预载功能代码；开启时再初始化。
- 本体不再轮询插件清单或运行启动保护、通知扫描。组件关闭会清理监听、计时器、请求和状态。
- 插件中心的周期刷新改为五分钟；灵动岛的插件清单改为事件触发；推荐列表的网络连接在读取结束后关闭。
- 启动保护保持一次性关闭还原，并串行处理快速启停，正常退出或热更新仍不还原快捷方式。
- 设置页面及图标按访问加载；小型清单和本体仍需存在。已用过的模块缓存由引擎管理，完整退出重开后才能避免加载仍关闭的功能。
- 完成必要构建与语法检查；按默认偏好未运行测试、界面验收或性能基准。详细约定见 LIFECYCLE.txt。
Features load only when enabled. Disabling releases active resources; the shared core has no idle business polling. Restart DSH after updating to benefit from the new cold-start behavior. Runtime code caches are managed by the engines. This release has not been functionally tested or benchmarked.

历史 0.4.0 灵动岛 / Dynamic Island
- 新增独立「灵动岛」组件，在整个 DSH 窗口顶部中央显示全局消息。深色胶囊弹窗依次展示，约 6.5 秒后关闭；悬停暂停，也可手动关闭。
- 正常完成的主任务，以及插件安装、卸载、启用、停用、更新成功后发送通知。取消、报错或失败的插件操作不报成功。
- 本次确实经保护入口启动时弹出通知；校验启动凭据与进程，不以组件开关作为凭证，同次启动不重复弹出。
- 移除插件中心标签下的启动状态与快捷方式提示小字。快捷方式接管详情仍在启动保护设置中查看。
- 全局消息接口见 NOTIFICATIONS.txt。后续新组件共用此入口，提示随 DSH 的中文 / English 设置切换。
- 按默认偏好，本版只修改、构建、打包及更新本机插件，未运行测试或界面验收。以下为历史版本记录，不代表本版已测试。
Dynamic Island is a separate component for queued global notifications across DSH. It reports completed tasks, successful plugin changes and validated protected launches. Text follows the DSH language. The persistent launch line has been removed from Plugin Center. This release has not been tested.

历史 0.3.0 起始页与启动状态 / Home and launch status
- 新增独立「起始页」组件：暂时留空；点击左上角 DeepSeek 图标返回起始页，「新会话」按钮保持原有功能。
- 插件开关触发界面重载时，保留当前页面画面，接好新界面后再显示，避免短暂露出其他页面；继续保留分类和滚动位置。
- 「已安装」卡片统一高度，不再由描述长度决定。
- 插件中心顶部显示本次启动方式。绿色「本次已通过保护启动」仅在启动预检记录与当前应用进程匹配时显示；悬停可查看预检时间和检查数量。
- 「本次为普通启动」表示本次没有经保护入口启动。开启组件或接管快捷方式不会追溯改变本次启动方式；需要完全退出后从已接管的快捷方式重新打开。
- 本次按要求完成独立测试和 DSH 实际界面验收，详见输出目录 0.3.0 验收记录。新增组件依版本规则升级至 0.3.0。
Home is a separate component. The DeepSeek logo returns to the blank Home page while New Chat keeps its original behavior. Installed cards have a fixed height. Plugin reloads retain the previous frame until the current view is ready. The launch indicator validates a per-launch receipt against the running process; enabling protection alone is not treated as proof of a protected launch.

0.2.4 修复 / Fixes
- 终端、Agent 循环、子智能体、网页搜索不再显示额外开关；只保留宿主原有开关。
- 修复官方和已安装列表首排裁切；官方卡片更紧凑，简介最多两行；开关增加悬停高亮。
- 插件详情和组件设置支持网页返回及 Alt+左方向键，回到当前分类列表。
- 推荐插件使用 GitHub 文件 API，并保留原始文件通道作为后备；请求与其他插件的网络连接隔离。
- 启动保护兼容桌面版和命令行的安装目录；快捷方式校验不再依赖 PowerShell 模块自动加载。失败提示保持稳定，成功后消失。
- 本次按要求运行测试并进行 DSH 实际界面验收；完整结果见输出目录的 0.2.4 验收记录。
Native setting-only entries have no artificial switches. List cards no longer clip; official descriptions use two lines, switches highlight on hover, and browser Back exits details. Recommendations use the GitHub Contents API with isolated requests. Shortcut protection resolves the desktop installation correctly and avoids PowerShell module-loading failures.
0.2.3 仓库链接、更新提示与页面状态 / Repository links, updates and navigation
- Git 链接结合安装来源、本地包声明、市场已安装仓库信息及目录匹配。来源仓库优先，多个同名仓库无法区分时不猜测。
- 仓库信息和更新检查独立加载；市场目录仅补全展示链接，更新检测及安装始终使用市场公开 v1 API，保留实际任务进度与失败提示。
- 无可用更新时按钮显示「最新」；网络或市场不可用时同样显示「最新」，悬停说明未能确认，不能把这个按钮文字当作联网检查成功。
- 保存当前页面和分类，避免开关插件引起热重载后回到插件市场。
- 页面边缘和卡片内留白进一步缩小；简介仍最多三行，更新/Git 按钮加高，宽度和圆角跟随开关。
- 官方分类及随宿主提供的内置项不显示更新/Git 按钮，继续通过 DSH 主程序更新。
- 本次未运行测试、测试安装或界面验收。
Repository links now combine installation sources, local manifests and validated Market inventory/catalog metadata. Link loading and update checks run independently; installation still uses the public update API. The selected tab survives plugin toggles and reloads. Cards are more compact with taller pill actions, and host-managed official items have no update/Git actions. “Latest” is also shown while an update cannot be confirmed; the tooltip explains that state. This release has not been tested, as requested.

0.2.2 一键启停保护入口与紧凑卡片 / One-toggle shortcut protection and compact cards
- 打开「启动保护」后，自动部署保护入口，查找可访问的桌面、开始菜单、经典固定项、用户文件夹及 Windows 搜索索引内指向当前 DSH 的快捷方式；先备份，再改写目标，保留原启动参数。
- 关闭组件或整个工具箱时，按备份还原仍由工具箱接管的入口；正常退出 DSH 和热更新不还原。被手动修改的入口保留现状并提示。
- 一键安装器与组件使用相同的快捷方式备份记录，也兼容此前安装器留下的原快捷方式备份。
- 启动保护的组件设置显示接管状态及未处理的入口。无需额外制作图标；没有找到入口时提示，不凭空宣称已完成保护。
- 无权限写入的公共入口保留原样；没有自动提权。Windows 11 开始屏幕固定项若由系统缓存管理，可能需要取消固定后重新固定。直接运行原始 DSH exe 不经过快捷方式保护。
- 卡片和页面留白缩小，简介最多三行，更新和 Git 按钮缩为接近开关的尺寸。
- 本次未运行测试、测试安装或界面验收。
Startup Guard now owns the shortcut lifecycle: enabling backs up and redirects recognized DSH links, disabling restores managed links, and normal app shutdown preserves protection. Inaccessible or manually changed links are reported. Windows 11 cached pins may require re-pinning. Cards have smaller padding, three-line descriptions and compact actions. This release has not been tested, as requested.

0.2.1 推荐插件与卡片列表 / Recommendations and card lists
- 工具箱大图标下新增可展开的「推荐插件」。名单内置于 recommendations.json，当前只包含 dsh-market/dsh-market。
- 展开时读取 GitHub 最新发布版本；没有发布版本时读取默认分支。对应版本的 npm 包经仓库归属匹配后优先安装，否则使用作者发布的 .tgz 或固定提交的源码。
- 推荐区每排两张卡片（窄窗口一列），图标在右上，安装按钮在右下；没有收藏、评论或更多菜单。
- 「官方」「已安装」列表均改为两列卡片。原生开关在右上，更新和 Git 按钮依次在下方；Git 按钮打开包声明的 GitHub 仓库，无地址时禁用。
- 终端等仅提供设置页的内置功能随 DSH 运行，开关和更新显示为不可操作；Git 打开 DSH 官方源码。
- 推荐安装沿用 DSH 的兼容性检查及构建授权，不自动批准构建脚本。
- 本次按用户要求未运行自动测试、测试安装或界面验收，由用户测试。
The built-in recommendation list is fetched from GitHub only when expanded. Cards show the latest release, an icon and an install button. Both management categories use two-column cards, retaining native controls and navigation. This release was built and packaged without running tests, as requested.

版本规则 / Version policy
小修改递增最后一位；新增组件递增中间一位并将最后一位归零；第一位仅在所有者明确允许后修改。
Patch changes increment the last number; new components increment the middle number and reset the last. Change the first number only with the owner's explicit permission.
完整规则见 VERSIONING.txt。本版统一替代此前 2.0.x / 2.1.x 开发编号，保留已有功能。

集成了各种小组件，让DeepSeek Harness更好用。持续扩展中。
A growing collection of small components that make DeepSeek Harness easier to use.

插件中心 / Plugin Center
- 左侧直达市场，集中管理插件并提示可用更新。推荐安装并启用「插件市场」（dshmarket）。
- 未安装或未启用市场时，仅显示「已安装与设置」；安装并启用市场后自动增加「插件市场」标签。
- 主界面左侧直接进入，市场与管理界面合并；管理页分为「官方」「已安装」。
- 所有工具箱界面文字跟随 DSH 的中文/English 设置即时切换。
- 只为已启用插件的可用更新显示计数；左侧入口、管理标签、分类标签同步显示。
- 更新检测使用市场公开的 v1 接口；启动时、插件变更后、窗口返回前台以及每五分钟检查。
- 无法检查时不显示“0 个更新”；更新按钮按用户要求显示「最新」，悬停提示说明未能确认。标题右侧刷新按钮可手动重试。
- 市场里的第三方插件简介由各插件作者提供，不属于工具箱的翻译内容。

Startup Guard / 启动保护
- 开启组件时自动部署快捷方式保护，同时检测宿主报告的明确版本冲突，并通过原生插件管理接口停用对应第三方包。
- 保护启动入口会在 DSH 启动前读取包的版本要求，先检查、备份、停用不兼容包，再运行 DSH。
- 保护启动同时把这个仅插入自身组件的工具箱 bundle 放在列表前面；真正的“先检查”由外部预检入口保证，而不是声称普通插件能抢在宿主前加载。
- 保护组件关闭或工具箱未启用时自动还原接管的快捷方式；仍被手动保留的旧保护入口会跳过预检。DSH 正在运行时不改兼容配置，只打开已有实例。
- 遵守 DSH 原生兼容性判断与已有的精确版本豁免；不新增兼容性豁免、不修改 DSH 安装文件、不移除依赖、不改核心官方包。
- 预检只看启用的第三方 bundle 的 DSH peerDependencies；子组件的加载前兼容性由 DSH 原生检查负责。
- 无声明、声明错误、插件代码异常、原生库损坏或宿主自身故障仍可能造成启动失败；此组件不是所有闪退的恢复器。
- 报告和备份：当前 profile 的 .tanuki-toolbox/status.json 和 .tanuki-toolbox/backups/。
- 自动停用后可在「已安装」手动重新启用；整个备份不应覆盖之后新修改的配置。

组件结构 / Components
- 工具箱基础：随整个插件启停，不显示为独立组件，也没有单独关闭开关。
- 插件中心：独立组件，dshmarket 为可选扩展；未启用市场时不检测更新。
- 启动保护：独立组件，开关控制快捷方式接管/还原以及保护入口是否执行预检。
- 起始页：独立组件，提供空白主页和左上角图标返回主页的行为。
- 灵动岛：独立组件，集中显示全局消息；关闭后不显示和积攒新消息。
- 保留 npm 包名 dsh-local-plugin-center，便于从旧版原位更新；展示名是黎猫工具箱 / Tanuki Toolbox。

Compatibility / 兼容环境
Windows; DeepSeek Harness 0.2.0-rc.2; dshmarket 1.66.21.
DSH 原生管理页尚未提供页头布局接口，因此这个组件沿用上版的局部容器附加方式。
市场通过公开 market.render() 嵌入；市场内部页面仍由 dshmarket 自己渲染。
未来 DSH 若改变页面结构或市场调整 beta 更新接口，可能需要适配工具箱。

Developer files / 旧开发版本记录（编号重置前）
2.1.4: category tabs remain visible in package, official item, and component settings; selecting either category returns to that list; a separate sticky action row sits below the categories.
2.1.4: pinned native uninstall/enable controls and direct update buttons; left-aligned toolbox artwork; revised bilingual descriptions.

client.template.js is the small browser coordinator. client-src/ contains feature sources; client-chunks/ contains on-demand builds. client.js loads only enabled feature chunks. See LIFECYCLE.txt before adding components.
components/ contains independent Host entries and localized display metadata.
lib/policy.cjs owns update-count filtering and conservative live-quarantine selection.
launcher/preflight.cjs is the testable pre-launch compatibility checker.

2.1.3 界面更新：
- 返回列表、卸载、更新、启用开关固定在同一顶栏，右侧操作保持原生行为。
- 每个已安装包的更新按钮位于启用开关左侧；有可用更新时高亮，点击直接通过市场公开 API 更新。
- 显示更新进度和结果；不强制跳过市场的发布时间限制，不自动重启 DSH。
- 更新操作无法确认时提示查看市场任务，不把未知状态当成成功。
- 大图标左对齐。
启动保护描述：启动DSH前检测并停用明确版本不兼容的第三方插件。（不保证拦截未声明的运行时故障）

2.1.4 导航更新：
- 「官方 / 已安装」在所有详情页中保持显示，返回和操作按钮另占下方一行。
- 点击分类会退出详情并返回对应列表；组件设置也会完整返回列表。
- 终端、Agent 循环、子智能体和网页搜索等官方设置使用相同导航和吸附布局。

2.1.5 可选市场：
- 插件中心不再依赖 dshmarket 即可启用，官方与已安装的管理功能始终可用。
- 市场启停时自动显示或隐藏市场标签，移除市场后保留管理页，不需重启工具箱。
- 市场不可用时停止更新检测并清除旧提示，恢复后重新检查。

2.1.6 安装助手适配：
- 保护启动支持安装助手指定的 DSH 安装目录，并转交应用启动参数。
- 安装助手使用固定保护入口，每次启动调用当前已安装工具箱的保护代码。

