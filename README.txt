黎猫工具箱 / Tanuki Toolbox 0.5.25

0.5.25 第三方插件图标 / Third-party plugin artwork
- 修复未声明包图标的第三方插件在插件中心只显示宿主默认图案的问题；插件列表和包详情页使用同一套图标补全。
- 优先保留宿主已正确显示的插件原图；补充读取已安装包声明的 icon、dsh.icon 和导出的 ./icon，不执行第三方插件代码。
- 插件市场使用上游 assets/logo.svg 方块标志；技能管理器使用其设置页的清单星芒图标。兼容资源的来源、固定提交及许可证随包保留。
- 当前 ModLens 和 Free Search 未提供独立图标，使用名称缩写兜底，不以作者头像或 DeepSeek 标志冒充插件图标。
- 资源从本机读取，无运行时 GitHub 图标请求；仅启用插件中心并进入管理页时加载，离开或停用取消读取、清理挂载图层。复用现有 DOM 观察器，不增加轮询。
- 仅必要构建、打包、GitHub 发布与本机更新；未运行功能测试或浏览器验收。
Preserve working native artwork, resolve declared local package/exported icons, and use verified Market and Skills settings marks when the manifests omit them. Keep lists and package details consistent; use name initials when a plugin has no dedicated icon. Read artwork locally on demand, cancel on exit, and restore native DOM on cleanup. Sources and licenses are included. Built and packaged without functional or browser tests.

0.5.24 GitHub 首次公开发布 / First public GitHub release
- 仓库：https://github.com/TanukiRei/tanuki-toolbox。补齐包的仓库、作者、主页和问题反馈地址，使 Git 页面及 GitHub 更新来源可识别。
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
