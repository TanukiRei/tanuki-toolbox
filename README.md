# 黎猫工具箱 · Tanuki Toolbox

<img src="assets/toolbox.png" width="144" alt="Tanuki Toolbox">

集成了各种小组件，让 DeepSeek Harness 更好用。持续扩展中。

A growing collection of small components that make DeepSeek Harness easier to use.

## 安装 / Install

在 DSH 的「插件 → 添加插件」中填写仓库地址：

```text
https://github.com/TanukiRei/tanuki-toolbox
```

安装后启用「黎猫工具箱」，再按需要开关各组件。仓库包含构建结果，不需要在安装时编译。直接填写仓库地址需要本机可用的 Git；如果电脑没有 Git，请使用 [最新 Release 说明](https://github.com/TanukiRei/tanuki-toolbox/releases/latest)中的「免 Git 安装地址」。这个地址直接从 GitHub 下载指定提交，插件市场也能据此识别仓库更新。

Enter the repository URL in DSH's **Plugins → Add plugin**, then enable Tanuki Toolbox. Built files are included. If Git is not installed, use the commit-specific archive URL in the latest Release notes; it downloads directly from GitHub and preserves the repository identity for update checks.

本项目保留包名 `dsh-local-plugin-center`。从旧版本更新时请直接安装上述地址，无需卸载，以保留现有组件设置。离线安装包见 [Releases](https://github.com/TanukiRei/tanuki-toolbox/releases)。

The package name remains `dsh-local-plugin-center` for in-place upgrades. Install over an existing version without uninstalling first. Offline packages are available under Releases.

## 组件 / Components

| 组件 | 功能 |
| --- | --- |
| 启动保护 · Startup Guard | 启动前检测并停用会导致闪退的第三方插件。 |
| 快捷栏 · Quick Bar | 将常用功能集成到可编辑的左侧快捷栏。 |
| 起始页 · Start Page | 增加一页起始页面，提供多种有效信息。 |
| 对话框优化 · Composer Enhancements | 优化对话框页面的各种排布和功能显示。 |
| 消息中心 · Message Center | 增加消息推送功能。 |
| 插件中心 · Plugin Center | 重新排列插件页面，优化显示方式，兼容「插件市场」。 |

组件按需加载；关闭组件不会在冷启动时预载该组件的功能代码。已加载模块可能仍保留在引擎缓存中，详见 [生命周期说明](LIFECYCLE.txt)。界面随 DSH 切换中文和英文。

Features load on demand, and disabled features are not preloaded on a cold start. Previously loaded modules can remain in the engine cache. The interface follows DSH's Chinese/English language setting.

## 更新 / Updates

安装并启用「插件市场」后，可以在插件中心查看仓库发布的更新并点击更新。经所有者明确要求发布后，才同步到 `main`，并保留版本标签和 `.tgz` 发布包；版本规则见 [VERSIONING.txt](VERSIONING.txt)。不会后台静默安装更新。

With Plugin Market enabled, Plugin Center can check this GitHub source and offer updates. Releases are published to `main` with version tags and downloadable packages only when explicitly requested by the owner. Updates are not installed silently in the background.

## 兼容性 / Compatibility

包声明支持 DSH `>=0.2.0-rc.2 <0.3.0`。部分界面功能依赖 DSH 当前页面结构，宿主更新后可能需要适配。快捷方式接管和保护启动工具用于 Windows。

启动保护仅检查明确声明的版本不兼容，不保证拦截未声明的运行时故障。直接启动 DSH 原始程序不会经过快捷方式保护；Windows 缓存的固定入口可能需要重新固定。

The declared DSH range is `>=0.2.0-rc.2 <0.3.0`. UI integration may need changes after host updates. Shortcut management and the protected launcher are for Windows. Startup Guard checks declared version compatibility, not every possible runtime failure.

## 开发 / Development

```text
node scripts/build.cjs
```

该命令使用仓库内的模板和资源重新生成 `client.js` 与 `client-chunks/`，无需安装构建依赖。保护启动器的 C# 源码和 Windows 可执行文件一起保留；需要修改启动器时运行 `scripts/build-launcher.ps1`。

The build uses checked-in templates and assets without additional build dependencies. Run `scripts/build-launcher.ps1` on Windows to rebuild the protected launcher from its included C# source.

详细变更记录见 [README.txt](README.txt)，全局消息接口见 [NOTIFICATIONS.txt](NOTIFICATIONS.txt)。遵循项目默认偏好，未明确要求时不运行功能测试；构建与打包不代表功能验收。

MIT License. This is a community plugin, not an official DeepSeek product.
