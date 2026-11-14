# Tessera 工程化管理指南

## 1. 管理目标

项目始终保持四个可验证状态：`main` 可构建、自动检查通过、版本元数据一致、任意正式版本可以从对应标签重建。

## 2. 信息源与职责

- `main`：唯一稳定主线，不存放未完成实验。
- `package.json`：当前软件版本和可执行命令的权威来源。
- `package-lock.json`：依赖的可复现快照，必须随依赖变更一起提交。
- `RELEASE_NOTES.md`：下一次或当前正式发布面向用户的完整说明。
- `README.md`：产品介绍、当前版本和历史摘要。
- GitHub Release：用户下载正式安装包的唯一权威位置。

本地 `release/` 和 `out/` 都是可再生成产物，不作为发布依据，也不提交 Git。
需要手工清理产物时执行 `npm run clean`；`npm run dist` 会自动先清理再打包，避免新旧安装包混杂。

## 3. 分支与提交

日常工作使用短分支：

- `feat/<name>`：新增功能
- `fix/<name>`：缺陷修复
- `refactor/<name>`：不改变行为的重构
- `test/<name>`：测试建设
- `docs/<name>`：文档
- `chore/<name>`：构建、依赖和维护

一个分支只解决一个主题，尽量在数天内合并。提交信息说明结果，例如 `fix: prevent notes from leaking across dates`。不要提交笼统的 `update`、`final`、`fix bug`。

## 4. 自动质量门禁

本地与 CI 使用同一入口：

```bash
npm run check
```

该命令依次执行：

1. ESLint 静态检查；
2. Vitest 自动化测试；
3. npm 高危/严重依赖漏洞审计；
4. 版本、锁文件、README 和发布说明一致性检查；
5. Electron 生产构建。

不得用跳过检查、降低规则或删除测试的方式“修绿”。确需调整规则时，应在提交中说明原因。

## 5. 安装包体积与性能

安装包体积主要由 Electron 运行时决定（约 105 MB，已接近下限），可控部分如下，均有 `tests/package-size.test.mjs` 守护：

- `build.files` 只打包 `out/**/*`、`logo.ico` 和 `package.json`，不再把源码、测试、文档和日志打进 `app.asar`。
- 渲染进程由 Vite 打包，所有 UI 库放在 `devDependencies`；`dependencies` 保持为空，否则 electron-builder 会把它们再复制一份进安装包。
- `electronLanguages` 只保留 `zh-CN` 和 `en-US` 的 Chromium 语言包。
- 主题背景和预览使用 WebP（质量 90）而不是 PNG；单个图片资源不应超过 600 KB。
- 页面按路由拆分（记录页立即加载，其余页面首次打开时才加载），时间线分批渲染长历史。

验证打包产物：`npm run dist` 后，可用 `TESSERA_E2E_EXECUTABLE=release/win-unpacked/Tessera.exe npx playwright test` 对打包后的应用运行同一套 Electron 测试。不要直接运行安装程序做测试，它会覆盖本机已安装的版本。

`SEED_DAYS=1100 npm run seed:dev` 可生成三年的示例历史，用于观察大数据量下的速度和内存。

### 动效约定

- 时长与曲线统一用 `styles/tokens.css` 里的令牌：`--transition-fast/base/slow`、`--ease-out`（入场、悬停）、`--ease-in`（退场，更短，约 140 ms）。弹窗只带极轻微的回弹（`--transition-spring`），不做弹跳。
- 只动画 `transform` 和 `opacity`；需要改变高度时用 `grid-template-rows: 0fr ↔ 1fr`。不使用 `transition: all`，不对整块内容区使用 `filter: blur`，不对 `margin`、`width` 做逐帧动画。
- 弹窗、下拉、菜单的退场用 `components/Presence.jsx`：它让被移除的子元素多停留一小会儿并带上 `.presence.is-leaving`（同时 `aria-hidden` 和 `inert`），样式写在 `styles/overlays.css`。新增浮层时给它的根节点加 `.modal-overlay`、`.dropdown-menu` 等已有类，或照样补一条 `.presence.is-leaving > .你的类` 规则。
- 标签条和分段控件的滑动高亮用 `utils/useSlidingThumb.js`：把返回的 ref 挂到容器上即可，样式见 `styles/tabs.css` 的 `.has-thumb`。
- 入场动画的填充模式用 `backwards`，不要用 `both`：`both` 会在动画结束后一直锁住 `transform: none`，让元素的 `:hover` 位移失效；对页面根元素等「全屏编辑器的祖先」更是致命，会让 `position: fixed` 的全屏层被圈在该元素内，不再铺满窗口（`tests/e2e/fullscreen-editor.spec.mjs` 守护）。
- **雾化玻璃：玻璃元素（带 `backdrop-filter`）的任何祖先都不能带 `opacity < 1`、`filter` 或 `mask`，哪怕只是动画途中。** 否则浏览器只在该祖先内部取景，玻璃会在动画期间变成「平的」，动画一结束颜色突然跳变。含玻璃的容器（页面根、抽屉、设置卡片、弹窗遮罩）在该风格下只做位移动画，淡入淡出放在玻璃元素自身或遮罩的伪元素上；见 `theme/appearanceSurfaces.css` 与 `tests/e2e/frosted-glass-motion.spec.mjs`。
- 高度会变化、距离不定的动画（卡片折叠）时长要随距离伸缩，见 `utils/collapseMotion.js`，并使用起步较柔的 `--ease-travel`；时长通过 `--collapse-ms` 在切换时按内容高度写入。
- 滚动容器用 `scrollbar-gutter: stable` 预留滚动条位置，否则内容变高时滚动条中途出现会让图表、编辑器宽度抖动几个像素。
- 通用动效件（优先复用，不要各写各的）：
  - `components/Collapsible.jsx`：高度展开/收起，时长随内容高度伸缩，收起期间保留内容；自身不带透明度，淡入淡出写在 `.collapsible-inner > *` 上。
  - `utils/useFullscreenPresence.js`：全屏层退出时多停留一段时间以播放退场；使用它的页面要同时把「全屏祖先」样式（`fullscreen-active-parent` 等）保持到退场结束，否则全屏层会被动画中的祖先圈住。
  - `utils/useScrollReveal.js`：列表项滚动进入视野时才播放入场并错峰；用 `data-reveal` 属性而不是 class，避免 React 重渲染把状态冲掉。
  - `utils/useDelayedFlag.js`：加载骨架屏只在加载确实变慢（约 240 ms）后才显示，快速加载直接出内容，不闪占位。
- 全屏编辑器进出时，页面本身不能有任何「瞬变」（`tests/e2e/motion-polish.spec.mjs` 逐帧守护）：全屏祖先上的入场动画用 `animation-duration: 0s` 等方式让它失效，**不要写 `animation: none`**，否则全屏结束、动画名重新出现时入场动画会整段重播（卡片从透明淡入）；记录卡片的头部保持原样（只加 `inert`），正文用 `min-height` 占住编辑器离开文档流前的高度，下方的卡片才不会上下跳；标题栏的底色、描边、毛玻璃和纹理随全屏层同步渐变（`body.editor-fullscreen-leaving` 让退场时的渐变跟随遮罩的节奏），不要让它们在进出全屏的瞬间突变；卡片自身的 `backdrop-filter` 在全屏期间必须为 `none`，退场结束后再缓动恢复。编辑器外壳 `.tiptap-shell` 不能给 `background-color` 加过渡，否则全屏层的不透明底色会在退出后慢慢褪去，卡片闪黑。全屏的「退出」按钮固定在右上角、紧贴窗口三个按钮左侧（`--window-controls-width`），放在头部之外；头部右侧按 `--fs-controls-reserve` 与行宽自动避让，任何窗口宽度下都不重叠（`motion-polish.spec.mjs` 守护）。
- 会横向滑动或有位移的内容放在滚动容器里时，容器要 `overflow-x: hidden`（日历），带位移的子元素外层加 `overflow: clip`，否则动画途中滚动条会闪一下。被 `.collapsible-inner` 等裁剪的卡片不要用悬停位移（`translate`），边框会被裁掉一边。
- 「添加记录」的新板块放在 `.section-slot` 里（入场动画挂在 `.was-added` 上而不是 `.is-adding`：动画名一旦切回卡片的常规入场，浏览器会把它从头播放，看起来就是入场了两次），用行高 `0fr → 1fr` 生长，下方卡片随之平滑下移；页面用逐帧指数缓动跟随到新板块（用户滚轮/键盘介入即停止），动画结束后聚焦输入。
- 非常驻（「激发」）板块的出现与消失：点「添加记录」只登记「手动添加」，**不写入任何数据**（数字板块显示默认值但不落盘），用户输入后才算有数据；空内容（含空文档）的板块不会被持久化。空的激发板块可点标签上的 × 关闭（`SectionTypeBadge`），右键「关闭板块」同效；有内容时右键「清空并关闭板块」必须先二次确认。关闭/清空时数据立即删除，卡片留在 `leavingSections` 里（显示原值）并以 `.is-removing` 折叠消失，槽位 `.section-slot` 的首尾边距按「缺席时少一个间隙」计算（`--slot-mt/--slot-mb`），否则插在中间时下方卡片会跳 16px。
- 时间线预览里每个日期最多显示约 6 行文字：8 行及以上才折叠（6 到 7 行不值得折叠），折叠高度取第 6 行文字的底边（按 `Range` 测得的真实视觉行，不是行高乘 6，段距、列表、自动换行都计入），`ClampedBody` 用脚本在两个像素高度之间做过渡、展开后把高度还给 `auto`；底部的渐隐用注册属性 `--clamp-fade` 过渡。有搜索词时自动展开，避免高亮的命中被折叠。日期标题栏就是卡片的一部分，不吸顶（吸顶需要滚动容器没有上内边距、还要处理圆角与透明度，代价大于收益，已取消）。
- 减少动态效果由全局 `prefers-reduced-motion` 规则统一处理，新增动画不需要单独写。
- 评估动效时不要只凭肉眼：用 `requestAnimationFrame` 逐帧采样元素的 `opacity`/`transform` 和帧间隔（长帧即卡顿），并用 `tests/e2e/motion.spec.mjs` 守住行为（快速切日不空白、弹窗退场后卸载、侧栏与标签高亮跟随选中项）。

### 雾化玻璃的壁纸取色

`theme/frostedGlassPalette.js` 从用户导入的壁纸得到：主色相、整体鲜艳度、整体亮度，分别用于强调色与玻璃底色。关键原则：

- 玻璃底色的饱和度（`--frosted-tint-s` / `--frosted-tint-k`）随壁纸的鲜艳度连续变化，灰度、雨天、夜景等没有主色调的图片几乎不染色；不要再给饱和度设下限。强调色（`--accent` 等）用 `--frosted-accent-s`，其余玻璃底色一律用 tint 变量（`tests/frosted-glass-palette.test.mjs` 守护）。
- 过亮的壁纸在深色主题下叠一层压暗（`--frosted-dark-scrim`），过暗的壁纸在浅色主题下叠一层提亮（`--frosted-light-scrim`），保证文字可读。
- 调整算法时，用几类典型图片（灰色雨窗、雪景、霓虹、夜景、米色纸、森林）对照输出，而不是只看一张。

## 6. 代码结构与拆分约定

目标：加功能或改行为时，只需要打开一两个小文件。

### 渲染层（`src/renderer/src`）

- `pages/<页面>/`：一个页面一个文件夹。`index.jsx` 只负责组合；状态与副作用拆成 `use*.js`，界面按卡片或区块拆成组件，样式 `.css` 与组件放在一起。Today、Notes、Settings、Analytics、Timeline、Calendar 都按这个方式组织。
- `utils/`：**纯逻辑**（不碰 React、DOM 或 Electron）放这里，按领域命名，如 `notes.js`、`analyticsData.js`、`timelineCards.js`、`dayEntries.js`、`countdowns.js`，并且必须有单元测试。`use*.js` 是跨页面复用的 hook。
- `context/`：全局状态。`AppContext.jsx` 只组合 `useSections`、`useMetadata`、`useDayStorage`、`useAppearance` 等 hook；`sectionsFile.js`、`metadataFile.js` 负责文件格式的解析与迁移（纯函数，有测试）。
- `components/`：跨页面复用的组件。`TiptapEditor/` 拆为 `index.jsx`（组合）、`editorExtensions.js`（扩展与快捷键）、`editorHelpers.js`（纯函数）、`useEditorContextMenu.js`、`useFullscreenEditor.js` 和 `FullscreenHeader.jsx`。
- `styles/`：`global.css` 只是入口，按 `@import` 的顺序（即层叠顺序）引入 `tokens.css`（颜色与尺寸令牌、深浅主题）、`interfaces/*.css`（三套界面风格）、`typography.css`、`base.css`、`animations.css`、`controls.css`、`overlays.css`、`states.css`、`layout.css`、`tabs.css`、`widgets.css`。通用样式放进对应文件；只属于某个页面或组件的样式写在它旁边，不要放进 `styles/`。
  **层叠顺序的陷阱**：`main.jsx` 先导入 `App`（连带所有组件样式），最后才导入 `global.css`，所以打包后组件样式在前、`styles/` 在后；同优先级的规则以后者为准（例如 `.btn` 的内边距会盖过编辑器样式里的 `.btn-xs`）。移动或合并 CSS 规则时要保持这个先后关系，并用计算样式对比确认外观没变。
- `theme/`：界面风格注册、壁纸取色、风格材质层（`appearanceSurfaces.css`）。

### 主进程（`src/main`）

- `index.js` 只做装配：运行时覆盖、单实例锁、应用生命周期。
- `appState.js` 是各部分共享的进程级状态（窗口、数据目录、是否正在退出）；`window.js` 创建窗口并处理静默测试模式；`externalLinks.js` 判定哪些地址可以在外部打开。
- `dataFiles.js`、`dataDirectory.js` 是数据文件操作与数据目录解析（纯函数，有测试）；`security.js` 限制可访问路径。
- `dataDirectoryMigration.js` 规划并执行数据目录的复制迁移（复制、逐文件 SHA-256 核对、不改动旧目录）；`dataDirectoryStartup.js` 在启动、打开任何数据之前决定使用哪个目录：执行预约的迁移，并在已保存目录不存在时拒绝静默新建空目录。
- `ipc/*Ipc.js` 按主题注册 IPC handler（文件、备份、配置、元数据、对话框、窗口、外观），统一经 `ipc/attempt.js` 包装为 `{ ok, ... }` 结果；`ipc/index.js` 汇总注册。
- `contextMenu.js`、`contextMenuTemplate.js` 是原生右键菜单的兜底路径；界面里实际使用的是渲染层的自绘菜单（`components/ContextMenu.jsx`）。

### 拆分约定

1. 一个文件同时承担多件事、或超过约 300 行时先拆：纯逻辑 → `utils/` 并补单元测试；状态与副作用 → hook；界面 → 组件；样式随组件走。
2. 拆分是**不改变行为**的重构。先写（或确认已有）能在旧实现上通过的测试，再在新实现上运行同一份；过程中发现的缺陷单独修复、单独说明，不夹带在搬运里。
3. 读取源码或 CSS 文本的契约测试一律通过 `tests/helpers/source.mjs` 的 `readSource`、`readTree`、`readStylesheet`，这样拆分文件不会让它们失效。
4. 及时清理不再使用的 CSS 类、导出和死代码。判断类名是否仍在使用时，要考虑动态拼接的写法（如 `cal-slide-${motion}`）和由库生成的类（`recharts-*`、`ProseMirror-*`）。
5. 懒加载页面的样式不得定义被其他页面共用的 `@keyframes`，它们必须放在 `styles/` 里随首屏加载（`tests/css-keyframes.test.mjs` 守卫）。

## 7. 测试策略

优先测试错误代价最高的边界：

1. 数据路径限制、原子写入、临时文件恢复；
2. 导入、导出、备份和历史格式兼容；
3. 日期切换、默认值继承和图表数据过滤；
4. 便签保存、关联和去重；
5. 外链协议、IPC 参数和窗口生命周期；
6. 任何来自外部的数据（数据文件、导入的 ZIP、粘贴的内容、路径）：必须有对应的属性测试，见下文「边界、模糊、压力与混沌测试」。

纯逻辑应抽成无 UI、无 Electron 生命周期依赖的小模块，再做单元测试。

### 表格列宽

调整过列宽的表格，每一列都必须有固定宽度（单元格的 `colwidth`）。只有被拖动的那一列有宽度时，其余列会按文字内容自适应，表格被挤进容器后列边框会跟不上鼠标并抽搐。`tableColumnWidths.js` 因此在按下列边框时先给所有列补上当前宽度，新增行列时补上缺的宽度，新建表格时按编辑区宽度等分；从未调整过的表格（例如粘贴进来的）保持随内容自适应。修改表格样式或扩展时，需同步 `tests/table-column-widths.test.mjs` 与 `tests/e2e/table-resize.spec.mjs`。

### 主进程对渲染层请求的信任边界

渲染层传来的路径和文件名都当作不可信输入，改动 `src/main/ipc/` 时保持以下约束，并同步 `tests/e2e/data-protection.spec.mjs`、`tests/main-path-grants.test.mjs`：

- 数据文件只能用数据目录内的相对路径（`safePath`），所有写入和删除都经过自动历史。
- `fs:discardTmp`、`fs:recoverTmp` 只接受数据目录内的 `.tmp` 文件；恢复前先校验 JSON，不完整的文件改名为 `.incomplete` 保留，不能覆盖原文件。
- `export:writeFile`、`import:readFile` 只接受用户刚在 `dialog:saveFile` / `dialog:openFile` 里选过的路径（`pathGrants.js`，一次有效）。
- 备份读取数据目录失败必须报错，不能返回残缺的文件列表。
- 导入的 ZIP 是不可信输入：`import:readFile` 拒绝超过 128 MB 的文件（读取之前就检查），渲染层的 `readArchiveJsonEntries`（`utils/dataArchive.js` 的 `ARCHIVE_LIMITS`）再限制条目数（5 万）、单个 JSON 展开后大小（32 MB）和合计大小（256 MB），边展开边计数，超限立即中止，不会等整个文件进了内存。限值远高于真实数据，改动时同步 `tests/data-archive.test.mjs` 与 `tests/e2e/data-import.spec.mjs`。
- 数据目录不能由渲染层直接设置：`config:set` 拒绝 `dataDir`、`pendingDataDirChange`；更改只能走 `config:planDataDirChange` / `config:scheduleDataDirChange`，且目录必须是用户刚在 `dialog:openDirectory` 里选过的（`pathGrants` 的 `folder`）。更改只记录为预约，在下次启动时复制、核对后才切换，旧目录永不删除。
- 自动化测试固定的数据目录（`TESSERA_DATA_DIR`）不会被预约迁移或目录缺失提示改动；迁移启动流程由 `tests/data-directory-startup.test.mjs` 用真实临时目录覆盖，改动它时还应按下一节的开发目录做一次真实两次启动验证。
- 导入 ZIP 先整体校验（合法 JSON、相对路径），有任何问题就一个文件都不写。
- 渲染进程运行在系统沙箱里（`window.js` 的 `sandbox: true`，同时 `contextIsolation`、无 Node 集成）。沙箱里的预加载脚本只能使用 `contextBridge`、`ipcRenderer`、`webFrame` 等少数模块，因此预加载里不要 `require` 其他 Electron 模块或 Node 模块：剪贴板这类能力放在主进程（`ipc/clipboardIpc.js`），预加载通过 IPC 调用；`tests/e2e/security-policy.spec.mjs` 会检查沙箱仍然开启。
- 构建出的页面带 Content-Security-Policy（`scripts/contentSecurityPolicy.mjs`，由 Vite 插件只在构建时注入）：脚本只允许应用自带，禁止任何网络连接、框架与插件；样式允许内联，图片允许 `data:`（自选背景）。因此不得再引入远程字体、样式、脚本或图片，也不得在页面里发起网络请求；`tests/content-security-policy.test.mjs` 与 `tests/e2e/security-policy.spec.mjs` 守住这一点。开发服务器不加该策略（热更新需要内联脚本与套接字）。

### 保存、关闭与编辑器打开文档

渲染层的保存路径是数据安全的核心，约定如下（回归测试：`tests/pending-saves.test.mjs`、`coalesced-writer`、`leftover-saves`、`today-rollover`、`main-shortcuts`，以及 `tests/e2e/save-pipeline.spec.mjs`、`editor-integrity.spec.mjs`）：

- 任何持有「尚未写入的编辑」的地方都要用 `registerPendingFlush` 登记。关闭窗口时主进程发 `app-before-close`，渲染层把登记的全部冲刷成功后才 `confirmClose`；失败或超时不会放弃编辑，主进程 15 秒后询问用户是继续使用，还是明确选择放弃未保存内容后退出（渲染进程已崩溃时直接允许关闭）。
- 页面被离开时（记录页、便签页卸载，或切换便签）还没写出的内容不能随页面消失：用 `utils/leftoverSaves.js` 移交，立即写入，失败则继续挂在关闭冲刷上重试；再次打开同一天/便签的页面必须先 `adoptLeftovers`：等仍在写的移交写完，并以写失败的那份内容为起点（记录页的读取、`noteStorage.loadNotesFromDisk` 都这样做），而不是读较旧的文件；只有页面在采用它之后又成功写入（`markWritten`）时，旧的内容才作废，不会把旧版本写回去。便签的移交写入只改索引里这一条（`writeIndexEntry`），不会用过期的整张列表覆盖索引。
- 一个文件被频繁改写（`metadata.json`）时用 `utils/coalescedWriter.js`：同一时刻只有一个写入，写入期间的新改动在其后补写，失败会自动重试并提示一次，而不是认为已保存。
- 读取日记文件分严格与宽松：`readDayDataStrict` 对「文件存在但读不出或解析不了」抛错，记录页据此显示错误面板，不提供可编辑的空白日（否则一次输入就会覆盖真实文件）；列表、查找等可以跳过的场景用 `readDayData`。
- 跨过零点后记录页自动移到新的一天（`context/useTodayRollover.js`），先冲刷当前内容，失败则留在原日期。
- 打包版禁用刷新与开发者工具快捷键并移除默认菜单（`main/shortcuts.js`、`window.js`）：刷新会丢掉未保存的编辑。开发进程不受影响。默认菜单顺带提供的 F11 全屏由 `isFullScreenShortcut` 补上；以后若发现还有靠默认菜单提供的快捷键，在同一处补。
- 编辑器打开文档前先经 `utils/documentSanitizer.js`：含有本版本不认识的节点或标记的文档，保留文字并提示，而不是显示成空白卡片（否则第一下输入就会把空白存到真实内容上）；形如 `2024` 的旧纯文本按文字显示。
- 退出全屏的 Esc 要在编辑器处理按键之前判断（`isLeaveFullscreenKey`，捕获阶段）：ProseMirror 会把编辑器内的每个 Esc 都标记为已处理，所以不能用 `defaultPrevented` 区分。

### 对话框与键盘

所有对话框用同一套键盘行为（`components/ModalFrame.jsx`、`utils/useModalA11y.js`，测试 `tests/e2e/dialogs.spec.mjs`）：打开时焦点进入对话框（`data-autofocus` 标记的控件，否则对话框本身）、关闭后回到打开它的控件；Tab 不会离开对话框；Esc 只关闭最上面的一个对话框，并且不会再传给下面的全屏编辑器或其他对话框；点遮罩关闭要求按下和松开都在遮罩上（在输入框里拖选文字拖到框外不算）。新增对话框优先用 `ModalFrame`；需要回答的问题用 `role="alertdialog"`，一个破坏性的问题默认聚焦在安全的选项上。`useConfirmDialog` 的 `confirm()` 对取消按钮返回 `false`，对 ✕、Esc、点遮罩返回 `dismissValue`（默认 `false`）：取消按钮本身有动作的调用方（例如倒数日的「直接保存」）传 `dismissValue: null` 区分「返回」与「按了那个按钮」。

退出全屏编辑器的 Esc 把「某个浮层已打开」（斜杠菜单、右键菜单、各种对话框）视为 Esc 已有主人：新增会响应 Esc 的浮层时，把它的选择器加进 `utils/editorShortcuts.js` 的 `ESC_OWNERS`。

可点击但不是 `<button>` 的区域（时间线日卡片、日期标题、版块名称）要有 `role`、`tabIndex={0}` 和 Enter/空格处理，样式见 `controls.css` 末尾的焦点环。

### 软件内的使用说明

「使用说明」（侧栏 💡、`F1`、首次启动）的内容是数据：`src/renderer/src/components/guide/guideTopics.js`，界面在 `Onboarding.jsx` 与 `guide/GuideBlock.jsx`。新增、改名或删除用户可见的功能（页面、按钮、快捷键、斜杠菜单项、设置项）时，在同一个提交里更新对应主题。`tests/guide-content.test.mjs` 会检查说明里用「」引用的界面文字是否仍然出现在应用源码中，改名后忘记更新说明会让测试失败；`tests/e2e/guide.spec.mjs` 检查各主题下的显示、溢出和键盘行为。示例输入用 `{{...}}`（按代码显示，不解析），按键用 `[[Ctrl]]`，加粗用 `**...**`。

### 笔记里的本地文件链接

笔记链接除网页、邮件、电话外，还可以指向本机的文件或文件夹，以 `file:///C:/...` 形式保存（`src/renderer/src/utils/localFileLinks.js`），点击时由主进程 `src/main/localFiles.js` 处理。约束如下，修改时必须同步更新 `tests/main-local-files.test.mjs` 与 `tests/local-file-links.test.mjs`：

- 只接受盘符绝对路径。网络共享（`\server\share`，打开会向对方服务器发送登录凭据）、相对路径、`..`、盘符之后的 `:`（备用数据流）和 Windows 非法字符一律拒绝，渲染层与主进程各校验一次。
- 主进程只把白名单扩展名（常见图片与纯文本：jpg、png、webp、heic、txt、md、csv 等，见 `OPENABLE_EXTENSIONS`）交给系统默认程序打开；其余文件只在资源管理器中显示，绝不启动。链接名和解析后的真实路径（符号链接）都必须在白名单内；末尾带点或空格的文件名按不可打开处理。
- 文件夹用资源管理器打开；解析到网络路径的链接被拒绝。
- 打包版窗口只允许停留在应用自己的 `index.html`，指向其他本地文件的 `file:` 导航会被拦截，避免链接把应用窗口替换掉。
- 新增可直接打开的扩展名前，先确认它不能运行代码或携带脚本（pdf、svg、html、Office 文档均未放行）。

### Electron 冒烟测试与隔离数据目录

`tests/e2e/` 使用 Playwright 启动构建后的真实 Electron 应用（`out/`），覆盖启动、各页面渲染、日记保存和重启后读取。运行：

```bash
npm run test:e2e   # 先构建再运行
npx playwright test   # 已有最新构建时直接运行
```

测试通过环境变量隔离数据，应用不会碰真实记录：

- `TESSERA_USER_DATA_DIR`：覆盖 Electron `userData` 目录（配置、背景图、单实例锁）。
- `TESSERA_DATA_DIR`：覆盖记录数据目录。

两个变量必须同时设置且为绝对路径，否则主进程启动即报错，避免隔离不完整而回落到真实数据目录。测试夹具为每个用例创建临时目录并在结束后删除。手工做实机验证时也应使用这两个变量。

测试窗口默认「静默」运行：夹具设置 `TESSERA_E2E_QUIET=1`，主进程把窗口放在屏幕外 (-12000, -12000) 并用 `showInactive()` 显示，页面照常渲染、动画照常运行，但不会抢走开发者当前的焦点。想亲眼看测试时设 `TESSERA_E2E_VISIBLE=1`。手写的临时探测脚本同样应带上 `TESSERA_E2E_QUIET=1`。

### 边界、模糊、压力与混沌测试

手写用例只覆盖想得到的情况，数据文件被改坏、被导入的 ZIP、粘贴进来的网页内容、断电与进程被杀则会产生想不到的组合，所以另有三层随机化 / 极端化测试：

1. **属性测试（`tests/fuzz/`，fast-check）**：随 `npm test` 一起运行。检查「无论输入是什么」都成立的性质：读取任何存储值都不抛错、清理后的文档总能被编辑器接受且不丢文字；路径与链接永远落不到数据目录之外，渲染层与主进程对本地链接的判断一致；倒数日与时间范围在多个时区（含夏令时、半小时偏移、日期变更线）下与纯 UTC 计算一致；图表数据对任何卡片设置和任何记录值都得到可绘制的有限数值。失败时会打印随机种子：`FUZZ_SEED=<数字>` 重放，`FUZZ_RUNS=<数字>` 调整每个性质的运行次数（默认 300）。新增会读取外部数据的模块时，同时补一条对应的性质测试。
2. **端到端的极端数据与粘贴（`tests/e2e/hostile-and-chaos.spec.mjs`）**：真实应用打开一个满是损坏、嵌套数千层、体积巨大、含控制字符、不是真实日期的日记文件夹，所有页面都必须正常，且**文件一个字节都不被改动**；用带种子的随机脚本、事件、网页片段、Markdown 反复粘贴，编辑器内不得出现脚本、表单、事件属性或危险链接，也不得发起任何网络请求；三年（1100 天）历史必须在时间预算内加载、搜索、画图。
3. **混沌（同一文件）**：编辑时反复 `SIGKILL` 结束进程，每次之后所有数据文件都必须仍是完整的 JSON，且之前已保存的文字一个都不能少。

约定：属性测试里的生成器要贴近真实数据来源（例如数据目录列出的日期只会是数字，但不一定是真实日期）；发现真问题时先在测试里固定一个确定性的回归用例，再修复。端到端测试同样用 `FUZZ_SEED` 重放。

### 开发进程与已安装版本隔离

未打包的启动（`npm run dev`、`electron .`）默认使用独立目录，不会碰已安装版本的配置和记录：

- 配置目录：`%APPDATA%\tessera-dev`（已安装版本为 `%APPDATA%\tessera`）；
- 数据目录：`~/Tessera-dev/data`（已安装版本为 `~/Tessera/data`）。

`npm run seed:dev` 会向开发数据目录写入示例数据（约 150 天记录、便签、倒数日和图表，含一个极端值用于测试热力图），可重复运行；脚本拒绝覆盖非空且不是它创建的目录，也拒绝触碰真实数据目录。确需用开发版读写真实数据时，才设置 `TESSERA_USE_REAL_DATA=1`，并先备份。显式的 `TESSERA_USER_DATA_DIR` / `TESSERA_DATA_DIR` 优先于以上默认值。

未设置 `ELECTRON_RENDERER_URL`（仅 `electron-vite dev` 会注入）时，未打包的启动会加载构建产物而不是开发服务器。CI 在 `npm run check` 之后运行冒烟测试；它们不属于 `npm run check`，改动主进程、预加载桥接、编辑器保存或窗口生命周期时请在本地运行。

### 安装程序与卸载程序（`build/*.nsh`）

安装向导的路径规则和卸载程序对数据目录的处理直接决定会不会误删用户文件，因此约定如下：

- **永远不运行构建出的安装程序或卸载程序来测试**：本机若装有正式版，它会覆盖或卸载真实安装。改动 `build/` 下的脚本后，用 `npx electron-builder --win nsis --config.directories.output=release/installer-check` 只做编译检查（NSIS 把警告当错误，未声明变量、函数名错误都会在这里暴露），再运行 `node scripts/check-installer-rules.mjs`：它把纯字符串规则（`installPathRules.nsh`：程序目录自动补 `Tessera` 子目录、拒绝磁盘根目录、拒绝把数据目录放进会被清空的程序目录；`dataPathRules.nsh`：解析 `datapath.txt` 并判断是默认目录还是自定义目录）编译成临时小程序逐条验证，不安装、不碰注册表和用户目录。这个脚本需要 electron-builder 缓存的 NSIS，不属于 `npm run check`。它编译的程序和真实安装程序一样是 Unicode 版（`Unicode true`），文件读写规则依赖这一点。
- 卸载时勾选「删除所有用户数据」只递归删除**默认数据目录** `%USERPROFILE%\Tessera\data`（专属于本软件）；用户自选的数据目录永远不会被清空，只提示其位置，由用户自行处理。
- 程序目录在升级和卸载时会被整体清空，所以向导拒绝磁盘根目录，并自动补上 `Tessera` 子目录；数据目录不得位于程序目录之内。
- `datapath.txt` 位于当前用户的 `%APPDATA%\Tessera`（即使是为所有用户安装），软件每次启动都会按实际使用的数据目录刷新它，所以卸载程序读到的总是最新值。软件拒绝重建丢失的自定义数据目录，所以安装程序要先创建好用户选的目录。
- `datapath.txt` 的编码：NSIS 的 `FileWrite`/`FileRead` 用系统 ANSI 代码页，而软件读写 UTF-8，含中文等非 ASCII 的文件夹（如 `D:\日记`）会对不上。所以安装程序一律写「UTF-16 LE + BOM」（`WriteDataPathFile`），卸载程序先看 BOM 再决定用 `FileReadUTF16LE` 还是 ANSI（`ReadDataPathFile`），软件（`dataDirectory.js` 的 `readDataPathFile` / `syncDataPathFile`）两种都能读；路径含非 ASCII 时写 UTF-16 LE + BOM，纯 ASCII 时仍写 UTF-8（字节与历来完全相同）。这些函数在 `scripts/check-installer-rules.mjs` 里用中日文、emoji 路径做了写入再读回的往返验证。
- 升级时旧版卸载程序也会运行：它不得删除快捷方式或弹出「确认卸载」提示，这些只在真正卸载时执行。
- 修改上述行为后，发布前在虚拟机或干净账户里手动走一遍全新安装、升级安装、勾选和不勾选「删除所有用户数据」的卸载。

## 8. 合并与评审

项目目前由单人维护，没有第二位评审人，因此不要求每次改动都创建 Pull Request。合并依据是：本地 `npm run check` 通过，且推送分支后 CI（对所有分支生效）成功。小改动（文档、文案、纯样式、仅补测试）本地检查通过即可合并。

需要留痕、回看差异或改动较大时，可创建 Pull Request，说明：改了什么、为什么、如何验证、是否影响数据兼容或发布。自查重点依次为：数据安全、回归风险、测试证据、可维护性、界面细节。

当前私有仓库套餐不支持 `main` 分支保护，因此流程约束需要人工遵守：只在 CI 通过后合并。若未来升级套餐、公开仓库或加入协作者，应开启 required status check（`Lint, test and build`），并恢复 Pull Request 加评审的流程。

## 9. 发布纪律

1. `main` 的 CI 成功后才允许准备版本。
2. 使用 `npm version <patch|minor|major> --no-git-tag-version` 同步两个包文件。
3. 更新 README 当前版本、更新日志与 RELEASE_NOTES。
4. 执行 `npm run check`。
5. 提交并推送版本提交，等待 CI 成功。
6. 创建统一的附注标签：`git tag -a vX.Y.Z -m "Tessera vX.Y.Z"`。
7. 推送单个标签，等待发布工作流完成，并下载验证安装包。

发布工作流会在打包前拒绝不在 `main` 上的标签，并依次运行 `npm run check`、完整的 Electron 冒烟测试、打包，再对打包出的 `release/win-unpacked/Tessera.exe` 运行 `smoke.spec.mjs`，全部通过才发布。

标签是不可变发布记录。已推送标签不得重打；失败时修复并增加 patch 版本。不要使用 `git push --tags`，避免误推本地旧标签。

## 10. 发布后验证

每个正式版本至少检查：

- GitHub Actions 发布任务成功；
- Release 版本、标题和说明正确；
- 安装包能全新安装并启动；
- 可以创建记录、关闭重启后仍能读取；
- 备份可生成，恢复路径可用；
- 外部链接只在系统浏览器打开，本地文件链接只打开白名单类型、其余仅在资源管理器中显示；
- 卸载不会误删用户选择的数据目录。

## 11. 依赖与安全

每月处理 Dependabot，运行 `npm audit`，优先修复运行时依赖中的 high/critical 问题。大版本升级一次只处理一个核心组件，并保留独立回滚提交。

安全问题不得包含真实用户数据、数据库、访问令牌或本机隐私路径。处理原则见 `SECURITY.md`。

## 12. 仓库清洁

每次合并后删除已合并分支。每月检查一次：

```bash
git status --short --branch
git branch --merged main
git remote prune origin --dry-run
npm outdated
npm audit
```

确认后再删除或 prune。构建产物、覆盖率、日志和用户数据必须保持在 `.gitignore` 中。

## 13. 建议节奏

- 每次提交：运行相关测试和 lint。
- 每次合并前：完整运行 `npm run check`。
- 每月：依赖更新、安全审计、已合并分支清理。
- 每个 Release：全量门禁、不可变标签、安装包冒烟测试。
- 每季度：检查 Node/Electron 支持周期、备份恢复演练和文档有效性。

## 14. AI 助手自主管理约定

本项目主要通过自然语言交由 AI 助手开发。根目录 `AGENTS.md` 是助手在本仓库内的工作约定：按改动风险分级，自行管理任务分支、提交、推送、合并和合并后清理，用户无需重复提醒这些例行事项。

该授权不等于任意扩大任务范围。正式发布、标签创建、共享历史改写、真实用户数据迁移或其他难以恢复的操作，仍须满足 `AGENTS.md` 中的额外边界。
