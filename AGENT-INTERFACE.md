# Agent接口 / Agent Interface · protocol 1

在「设置 → 黎猫工具箱 → Agent接口」开启并展开卡片，复制地址、密钥或连接说明给本机 Agent。每台安装插件的电脑都生成自己的信息，不绑定开发者电脑、Codex、模型或路径。默认关闭。

Enable **Settings → Tanuki Toolbox → Agent Interface** and expand the card. Copy its address, key or instructions to an Agent on that computer. Every installation creates its own connection, independently of the developer's computer, Codex, model or paths. Disabled by default.

关闭立即停止监听、断开现有连接并拒绝新请求；地址、密钥和回执保留。重新开启、重启 DSH 或更新工具箱沿用这些信息。端口冲突会报告错误，不静默改地址。已经开始的安全配置/安装事务可以完成；关闭后不启动排队的新操作。停用后需用户在 DSH 重新开启，接口无法自行开启。

Disabling immediately closes the listener and sockets, retaining address, key and receipts across re-enabling, restarts and Toolbox updates. Port conflicts are reported without changing the address. Already-started safe file/package transactions may finish; queued actions do not start after disabling. Only the user can re-enable this component in DSH while it is offline.

## Connection

Use the saved `http://127.0.0.1:<port>` and `Authorization: Bearer <key>` on every request. Every computer can run its own interface; loopback is not a machine binding. No DSH login cookie is needed. Query-string keys, browser Origin/Sec-Fetch requests and CORS preflight are refused. The UI masks the key; explicitly copying connection instructions includes it. The key grants DSH management access. Credentials and machine configuration are never bundled into the plugin.

First GET `/v1/status` and `/v1/operations`, then use the returned JSON request shapes. Every PATCH/POST needs a UUID in `X-Request-ID`. HTTP 202 means accepted: poll `/v1/jobs/<UUID>`. Retry the same operation using the same ID; reusing an ID with changed content returns 409. Inspect `state`, native `application` and `restartReason`; saved configuration and disconnects do not prove live application.

| Operation | Request |
| --- | --- |
| Versions, paths, capabilities | `GET /v1/status` |
| Native plugin/component inventory | `GET /v1/plugins` |
| Toolbox settings | `GET` / `PATCH /v1/settings`; one section per patch: island, composer, startup or settingsEnhancements |
| Native appearance | `GET /v1/appearance`; `PATCH /v1/appearance`: preference (`light`, `dark`, `system`), optional revision from the read |
| Enable/disable component | `POST /v1/plugins/enable`: entryId, enabled |
| Select/deselect bundle | `POST /v1/bundles/enable`: name, enabled |
| Inspect package | `POST /v1/plugins/inspect`: spec |
| Install/update package | `POST /v1/plugins/install`: spec, optional enabled; native package/GitHub/local archive specs |
| Uninstall bundle | `POST /v1/plugins/remove`: name |
| Reconcile saved profile | `POST /v1/reload`: {} |
| Recent API action metadata | `GET /v1/logs`; current runtime only, no bodies/prompts/credentials/full native log export |
| Native task state | `GET /v1/desktop/status` |
| Graceful quit | `POST /v1/desktop/quit`: {}; optional allowScheduled:true explicitly permits quitting with scheduled work |
| Graceful restart | `POST /v1/desktop/restart`: {} |

The latest 200 receipts are in `<profile>/.tanuki-toolbox/agent-interface/jobs/`. Self-update, disabling and quit may disconnect HTTP; use local file tools to inspect receipts. Unfinished jobs from a previous host report interrupted and are not replayed. Native `accepted:true` means admission only: verify process exit and reconnect/read status to confirm restart. Native management retains management-required entries, compatibility checks and build-script approval. Edit source with the Agent's own local file tools, then package/install/reload. No eval, shell, arbitrary HTTP proxy, account-secret export or task submission is provided. Reopen ordinary settings pages to see changed values; existing configuration events remain in use.

## Desktop lifecycle

基础配置和插件管理随开关立即启动，使用 DSH 自带运行环境。Windows 正常退出/重启需主进程适配：首次开启后，无界面单次程序等待 DSH **正常退出**，再校验、备份并修改支持版本的 app.asar，下次启动生效。不关闭 DSH、不抢鼠标、不改 EXE/签名/fuses、不在主进程运行时替换归档。权限不足或占用时报告未完成。关闭取消可取消的安装；已提交的原子写入安全完成，适配保持无效。

The base API starts immediately using DSH's runtime. Windows graceful quit/restart needs a tiny main-process adapter. First enablement starts a hidden one-shot installer waiting for DSH to **exit normally**, then verifying/backing up/modifying a supported app.asar. It takes effect next launch. It never closes DSH, controls input, changes EXE/signatures/fuses, or replaces the archive while the main process runs. Permissions/locked files cause explicit failure. Disabling cancels setup where possible; accepted atomic writes finish safely with the adapter inactive.

原生适配目前只匹配已审查的 Windows DSH **0.2.1-rc.2** 主文件摘要，未知版本不套用。其他版本和 macOS 保留基础 API，退出/重启显示 unsupported。DSH 更新可能覆盖适配，需要重新适配；不会用旧备份覆盖新版本。

The native adapter currently matches the reviewed Windows DSH **0.2.1-rc.2** main-file digest only. Other versions and macOS retain the base API with unsupported desktop lifecycle. DSH upgrades may replace the adapter and require a compatibility revision; old backups never overwrite upgrades.

退出/重启复用原生任务检查、准入锁和保存清理，拒绝活动任务、未知状态、安装事务和系统更新安装中操作，不强制终止。启动保护开启时必须使用已验证保护入口，不降级绕过。原生适配平时无监听或轮询，明确请求时才加载，通过第二实例消息传递且不激活主窗口。

Lifecycle uses native inspection, admission lock and shutdown cleanup, refusing active work, unknown state, package operations and system-update installation. No force-kill. Protected startup requires its verified entry and never falls back to bypassing protection. The adapter has no idle listener/polling; explicit requests lazily load it and use second-instance IPC without focusing the main window.

`scripts/build-agent-setup.ps1` compiles the one-shot Windows helper and records source/binary hashes. Regular builds verify them and parse JavaScript/translations without starting the API or lifecycle operations. Functional testing requires the owner's explicit request.
