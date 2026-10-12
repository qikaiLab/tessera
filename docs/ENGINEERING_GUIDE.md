# MotoTrace 工程化管理指南

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

验证打包产物：`npm run dist` 后，可用 `MOTOTRACE_E2E_EXECUTABLE=release/win-unpacked/MotoTrace.exe npx playwright test` 对打包后的应用运行同一套 Electron 测试。不要直接运行安装程序做测试，它会覆盖本机已安装的版本。

`SEED_DAYS=1100 npm run seed:dev` 可生成三年的示例历史，用于观察大数据量下的速度和内存。

### 动效约定

- 时长与曲线统一用 `global.css` 里的令牌：`--transition-fast/base/slow`、`--ease-out`（入场、悬停）、`--ease-in`（退场，更短，约 140 ms）。弹窗只带极轻微的回弹（`--transition-spring`），不做弹跳。
- 只动画 `transform` 和 `opacity`；需要改变高度时用 `grid-template-rows: 0fr ↔ 1fr`。不使用 `transition: all`，不对整块内容区使用 `filter: blur`，不对 `margin`、`width` 做逐帧动画。
- 弹窗、下拉、菜单的退场用 `components/Presence.jsx`：它让被移除的子元素多停留一小会儿并带上 `.presence.is-leaving`（同时 `aria-hidden` 和 `inert`），样式写在 `global.css`。新增浮层时给它的根节点加 `.modal-overlay`、`.dropdown-menu` 等已有类，或照样补一条 `.presence.is-leaving > .你的类` 规则。
- 标签条和分段控件的滑动高亮用 `utils/useSlidingThumb.js`：把返回的 ref 挂到容器上即可，样式见 `global.css` 的 `.has-thumb`。
- 入场动画的填充模式用 `backwards`，不要用 `both`：`both` 会在动画结束后一直锁住 `transform: none`，让元素的 `:hover` 位移失效；对页面根元素等「全屏编辑器的祖先」更是致命，会让 `position: fixed` 的全屏层被圈在该元素内，不再铺满窗口（`tests/e2e/fullscreen-editor.spec.mjs` 守护）。
- 高度会变化、距离不定的动画（卡片折叠）时长要随距离伸缩，见 `utils/collapseMotion.js`，并使用起步较柔的 `--ease-travel`；时长通过 `--collapse-ms` 在切换时按内容高度写入。
- 滚动容器用 `scrollbar-gutter: stable` 预留滚动条位置，否则内容变高时滚动条中途出现会让图表、编辑器宽度抖动几个像素。
- 减少动态效果由全局 `prefers-reduced-motion` 规则统一处理，新增动画不需要单独写。
- 评估动效时不要只凭肉眼：用 `requestAnimationFrame` 逐帧采样元素的 `opacity`/`transform` 和帧间隔（长帧即卡顿），并用 `tests/e2e/motion.spec.mjs` 守住行为（快速切日不空白、弹窗退场后卸载、侧栏与标签高亮跟随选中项）。

## 6. 测试策略

优先测试错误代价最高的边界：

1. 数据路径限制、原子写入、临时文件恢复；
2. 导入、导出、备份和历史格式兼容；
3. 日期切换、默认值继承和图表数据过滤；
4. 便签保存、关联和去重；
5. 外链协议、IPC 参数和窗口生命周期。

纯逻辑应抽成无 UI、无 Electron 生命周期依赖的小模块，再做单元测试。

### Electron 冒烟测试与隔离数据目录

`tests/e2e/` 使用 Playwright 启动构建后的真实 Electron 应用（`out/`），覆盖启动、各页面渲染、日记保存和重启后读取。运行：

```bash
npm run test:e2e   # 先构建再运行
npx playwright test   # 已有最新构建时直接运行
```

测试通过环境变量隔离数据，应用不会碰真实记录：

- `MOTOTRACE_USER_DATA_DIR`：覆盖 Electron `userData` 目录（配置、背景图、单实例锁）。
- `MOTOTRACE_DATA_DIR`：覆盖记录数据目录。

两个变量必须同时设置且为绝对路径，否则主进程启动即报错，避免隔离不完整而回落到真实数据目录。测试夹具为每个用例创建临时目录并在结束后删除。手工做实机验证时也应使用这两个变量。

### 开发进程与已安装版本隔离

未打包的启动（`npm run dev`、`electron .`）默认使用独立目录，不会碰已安装版本的配置和记录：

- 配置目录：`%APPDATA%\mototrace-dev`（已安装版本为 `%APPDATA%\mototrace`）；
- 数据目录：`~/MotoTrace-dev/data`（已安装版本为 `~/MotoTrace/data`）。

`npm run seed:dev` 会向开发数据目录写入示例数据（约 150 天记录、便签、倒数日和图表，含一个极端值用于测试热力图），可重复运行；脚本拒绝覆盖非空且不是它创建的目录，也拒绝触碰真实数据目录。确需用开发版读写真实数据时，才设置 `MOTOTRACE_USE_REAL_DATA=1`，并先备份。显式的 `MOTOTRACE_USER_DATA_DIR` / `MOTOTRACE_DATA_DIR` 优先于以上默认值。

未设置 `ELECTRON_RENDERER_URL`（仅 `electron-vite dev` 会注入）时，未打包的启动会加载构建产物而不是开发服务器。CI 在 `npm run check` 之后运行冒烟测试；它们不属于 `npm run check`，改动主进程、预加载桥接、编辑器保存或窗口生命周期时请在本地运行。

## 7. 合并与评审

项目目前由单人维护，没有第二位评审人，因此不要求每次改动都创建 Pull Request。合并依据是：本地 `npm run check` 通过，且推送分支后 CI（对所有分支生效）成功。小改动（文档、文案、纯样式、仅补测试）本地检查通过即可合并。

需要留痕、回看差异或改动较大时，可创建 Pull Request，说明：改了什么、为什么、如何验证、是否影响数据兼容或发布。自查重点依次为：数据安全、回归风险、测试证据、可维护性、界面细节。

当前私有仓库套餐不支持 `main` 分支保护，因此流程约束需要人工遵守：只在 CI 通过后合并。若未来升级套餐、公开仓库或加入协作者，应开启 required status check（`Lint, test and build`），并恢复 Pull Request 加评审的流程。

## 8. 发布纪律

1. `main` 的 CI 成功后才允许准备版本。
2. 使用 `npm version <patch|minor|major> --no-git-tag-version` 同步两个包文件。
3. 更新 README 当前版本、更新日志与 RELEASE_NOTES。
4. 执行 `npm run check`。
5. 提交并推送版本提交，等待 CI 成功。
6. 创建统一的附注标签：`git tag -a vX.Y.Z -m "MotoTrace vX.Y.Z"`。
7. 推送单个标签，等待发布工作流完成，并下载验证安装包。

标签是不可变发布记录。已推送标签不得重打；失败时修复并增加 patch 版本。不要使用 `git push --tags`，避免误推本地旧标签。

## 9. 发布后验证

每个正式版本至少检查：

- GitHub Actions 发布任务成功；
- Release 版本、标题和说明正确；
- 安装包能全新安装并启动；
- 可以创建记录、关闭重启后仍能读取；
- 备份可生成，恢复路径可用；
- 外部链接只在系统浏览器打开；
- 卸载不会误删用户选择的数据目录。

## 10. 依赖与安全

每月处理 Dependabot，运行 `npm audit`，优先修复运行时依赖中的 high/critical 问题。大版本升级一次只处理一个核心组件，并保留独立回滚提交。

安全问题不得包含真实用户数据、数据库、访问令牌或本机隐私路径。处理原则见 `SECURITY.md`。

## 11. 仓库清洁

每次合并后删除已合并分支。每月检查一次：

```bash
git status --short --branch
git branch --merged main
git remote prune origin --dry-run
npm outdated
npm audit
```

确认后再删除或 prune。构建产物、覆盖率、日志和用户数据必须保持在 `.gitignore` 中。

## 12. 建议节奏

- 每次提交：运行相关测试和 lint。
- 每次合并前：完整运行 `npm run check`。
- 每月：依赖更新、安全审计、已合并分支清理。
- 每个 Release：全量门禁、不可变标签、安装包冒烟测试。
- 每季度：检查 Node/Electron 支持周期、备份恢复演练和文档有效性。

## 13. AI 助手自主管理约定

本项目主要通过自然语言交由 AI 助手开发。根目录 `AGENTS.md` 是助手在本仓库内的工作约定：按改动风险分级，自行管理任务分支、提交、推送、合并和合并后清理，用户无需重复提醒这些例行事项。

该授权不等于任意扩大任务范围。正式发布、标签创建、共享历史改写、真实用户数据迁移或其他难以恢复的操作，仍须满足 `AGENTS.md` 中的额外边界。
