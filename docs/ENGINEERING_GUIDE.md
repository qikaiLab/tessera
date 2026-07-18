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

## 5. 测试策略

优先测试错误代价最高的边界：

1. 数据路径限制、原子写入、临时文件恢复；
2. 导入、导出、备份和历史格式兼容；
3. 日期切换、默认值继承和图表数据过滤；
4. 便签保存、关联和去重；
5. 外链协议、IPC 参数和窗口生命周期。

纯逻辑应抽成无 UI、无 Electron 生命周期依赖的小模块，再做单元测试。关键用户流程后续可增加 Playwright Electron 冒烟测试。

## 6. Pull Request 与评审

Pull Request 至少说明：改了什么、为什么、如何验证、是否影响数据兼容或发布。评审重点依次为：数据安全、回归风险、测试证据、可维护性、界面细节。

当前私有仓库套餐不支持 `main` 分支保护，因此流程约束需要人工遵守：只在 CI 通过后合并。若未来升级套餐或公开仓库，应开启 required status check，并要求 `Lint, test and build` 成功。

## 7. 发布纪律

1. `main` 的 CI 成功后才允许准备版本。
2. 使用 `npm version <patch|minor|major> --no-git-tag-version` 同步两个包文件。
3. 更新 README 当前版本、更新日志与 RELEASE_NOTES。
4. 执行 `npm run check`。
5. 提交并推送版本提交，等待 CI 成功。
6. 创建统一的附注标签：`git tag -a vX.Y.Z -m "MotoTrace vX.Y.Z"`。
7. 推送单个标签，等待发布工作流完成，并下载验证安装包。

标签是不可变发布记录。已推送标签不得重打；失败时修复并增加 patch 版本。不要使用 `git push --tags`，避免误推本地旧标签。

## 8. 发布后验证

每个正式版本至少检查：

- GitHub Actions 发布任务成功；
- Release 版本、标题和说明正确；
- 安装包能全新安装并启动；
- 可以创建记录、关闭重启后仍能读取；
- 备份可生成，恢复路径可用；
- 外部链接只在系统浏览器打开；
- 卸载不会误删用户选择的数据目录。

## 9. 依赖与安全

每月处理 Dependabot，运行 `npm audit`，优先修复运行时依赖中的 high/critical 问题。大版本升级一次只处理一个核心组件，并保留独立回滚提交。

安全问题不得包含真实用户数据、数据库、访问令牌或本机隐私路径。处理原则见 `SECURITY.md`。

## 10. 仓库清洁

每次合并后删除已合并分支。每月检查一次：

```bash
git status --short --branch
git branch --merged main
git remote prune origin --dry-run
npm outdated
npm audit
```

确认后再删除或 prune。构建产物、覆盖率、日志和用户数据必须保持在 `.gitignore` 中。

## 11. 建议节奏

- 每次提交：运行相关测试和 lint。
- 每个 PR：完整运行 `npm run check`。
- 每月：依赖更新、安全审计、已合并分支清理。
- 每个 Release：全量门禁、不可变标签、安装包冒烟测试。
- 每季度：检查 Node/Electron 支持周期、备份恢复演练和文档有效性。
