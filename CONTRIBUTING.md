# Tessera 参与方式与开发规范

## 先看这里：怎么参与

| 你想做的事 | 怎么做 |
| --- | --- |
| 报告缺陷、提问、提功能建议 | **欢迎**：在 [Issues](https://github.com/qikaiLab/tessera/issues) 里选对应的模板提交，中文或英文都可以。提之前请先搜一下是否已有相同的 Issue，并看一眼软件内的使用说明（`F1`）和 [README 的常见问题](README.md#-常见问题) |
| 提交代码（Pull Request） | **目前不接受**。这是一个由单人维护、主要通过 AI 助手协作开发的项目，维护者没有精力评审外部代码，也要保持许可证和代码来源清晰。外部 PR 会被自动关闭，不是针对你本人。想要的改动请提 Issue 说明场景，维护者会评估并自行实现 |
| 报告不宜公开的安全问题 | 请不要建公开 Issue，按 [SECURITY.md](SECURITY.md) 用邮件私下联系 |
| 在自己的电脑上修改、构建、使用 | 完全可以，在 [PolyForm Noncommercial 许可证](LICENSE) 范围内（非商业用途）自由使用、修改和分发，见下文「许可证」 |

写 Issue 的小提示：请写清 Tessera 版本（软件内「关于」可一键复制版本信息）、Windows 版本、屏幕缩放比例，以及能复现问题的最短步骤；不要贴真实的个人记录或数据库，用脱敏的例子即可。项目由一位维护者在业余时间维护，回复可能不及时，请见谅。

下面是维护者自己的开发规范，也方便想在本地构建、研究代码的人了解项目如何运转。

---

# 开发规范（维护者）

本项目采用短生命周期分支、自动质量门禁和不可变版本标签。项目目前由单人维护，流程以“守住数据安全与发布可靠性”为目标，避免“本地能运行、发布才失败”。

## 开发环境

- Node.js 22.12 或更高版本
- npm 10 或更高版本
- Windows 10/11（正式打包目标）

首次拉取或依赖锁文件变化后使用：

```bash
npm ci
npm run check
```

涉及界面、主进程、预加载桥接、编辑器保存或窗口生命周期的改动，另外运行相关的 Electron 冒烟测试（使用临时目录，不会触碰真实数据），例如 `npx playwright test tests/e2e/app-shell.spec.mjs`（需要先有最新构建）；全量 `npm run test:e2e` 只在改动主进程、预加载、打包或 Electron 依赖时才需要。

## 日常开发流程

分支命名、提交规范、按风险分级的检查与合并流程、CI 的使用方式，以仓库根目录的 [`AGENTS.md`](AGENTS.md) 为唯一来源，这里不再重复。简要说：人工分支可以用 `feat/`、`fix/` 等前缀，AI 助手管理的分支用 `codex/<type>-<name>`；提交信息采用 Conventional Commits；合并后删除任务分支。

## 许可证

项目以 PolyForm Noncommercial License 1.0.0 发布（见 `LICENSE`），不是 OSI 意义上的开源许可证：非商业用途自由使用、修改和分发，商业用途需作者另行许可。

因为不接受外部代码，仓库里所有代码的版权都清晰地属于作者，不需要贡献者许可协议（CLA）。如果日后要开放代码贡献，会先补上 CLA 或 DCO，再修改本文件。

依赖库保持各自的许可证，新增依赖前确认其许可证允许随本项目分发（软件内「关于 → 许可与致谢」列出了随安装包分发的第三方组件）。

## 完成标准

一项改动只有同时满足以下条件才算完成：

- 新增或修复的纯逻辑包含自动化测试；涉及数据写入、导入、恢复或路径处理时必须有回归测试。
- `npm run check` 通过。
- 文档同步：`CHANGELOG.md`「未发布」补一行用户能感知的变化；新增、改名或删除用户可见功能时，同一提交更新软件内的使用说明（`guideTopics.js`）；存储格式或兼容性变化另在工程指南里说明。
- 不提交 `out/`、`release/`、日志、用户数据、数据库或密钥。

## 发布流程

版本遵循 SemVer：功能向后兼容用 minor，修复用 patch，不兼容变更用 major。

```bash
git switch main
git pull --ff-only
npm version patch --no-git-tag-version
# 同步 README.md（版本徽章与「最近更新」）、CHANGELOG.md 与 RELEASE_NOTES.md
npm run check:release    # npm run check 加依赖漏洞审计
git add package.json package-lock.json README.md CHANGELOG.md RELEASE_NOTES.md
git commit -m "chore(release): vX.Y.Z"
git push origin main
gh workflow run ci.yml --ref main    # main 上不会自动跑 CI，打标签前手动触发并等它成功
git tag -a vX.Y.Z -m "Tessera vX.Y.Z"
git push origin vX.Y.Z
```

必须先等这次 `main` 上的 CI 成功，再创建并推送标签。发布标签一旦推送就不得删除、移动或复用；如果发布失败，修复后发布新的补丁版本。

## 依赖维护

- 每月处理 Dependabot 提交，逐项合并，不一次性盲目升级所有主版本。
- 合并依赖更新前执行 `npm run check` 和 `npm run audit`（审计另有 CI 工作流 `audit.yml`：每周一次，以及依赖文件变更时运行）。
- Electron、构建工具或编辑器的大版本升级应使用独立分支，并进行安装包启动、写入、备份和恢复测试。

完整维护规则见 [工程化管理指南](docs/ENGINEERING_GUIDE.md)。
