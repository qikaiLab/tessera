# MotoTrace 贡献与开发规范

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

涉及主进程、预加载桥接、编辑器保存或窗口生命周期的改动，另外运行 Electron 冒烟测试（使用临时目录，不会触碰真实数据）：

```bash
npm run test:e2e
```

## 日常开发流程

项目目前由单人维护，流程按改动风险分级，不要求每次都走完整的 PR 流程：

| 级别 | 范围 | 流程 |
| --- | --- | --- |
| 小改动 | 文档、文案、注释、纯样式、仅补测试 | 分支 → `npm run check` → 合并到 `main` |
| 常规改动 | 功能、普通缺陷修复、重构 | 分支 → `npm run check` → 推送分支 → CI 通过 → 合并 |
| 高风险改动 | 数据层、备份恢复、IPC、依赖、打包、发布 | 同常规改动，另加回归测试与真实构建或隔离启动验证 |

1. 从最新 `main` 创建分支。人工分支使用 `feat/`、`fix/`、`refactor/`、`test/`、`docs/` 或 `chore/` 前缀；AI 助手管理的分支使用 `codex/<type>-<name>`。
2. 小步提交，提交信息采用 Conventional Commits，例如 `feat: add weekly summary`。
3. CI 对所有分支的推送都会运行，因此推送分支并等待 CI 通过即可作为合并依据；Pull Request 可选，需要留痕或查看差异时再创建。CI 未通过时不得合并。
4. 合并后删除本地和远端功能分支。

紧急情况下可以直接更新 `main`，但必须先在本地通过 `npm run check`，并确认远端 CI 成功。

用户已将常规 Git/GitHub 管理授权给 AI 助手：完成开发任务后自行执行检查、提交、推送、合并和分支清理。只有正式版本发布、共享历史改写、破坏性操作或范围不明确时需要额外确认。具体边界以根目录 `AGENTS.md` 为准。

## 许可证与贡献

项目以 PolyForm Noncommercial License 1.0.0 发布（见 `LICENSE`），不是 OSI 意义上的开源许可证：非商业用途自由使用，商业用途需作者另行许可。提交贡献即表示你同意你的改动按同一许可证发布，并同意作者在需要时将它用于该项目的商业授权。依赖库保持各自的许可证，新增依赖前确认其许可证允许随本项目分发。

## 完成标准

一项改动只有同时满足以下条件才算完成：

- 行为符合需求，失败路径得到处理。
- 新增或修复的纯逻辑包含自动化测试；涉及数据写入、导入、恢复或路径处理时必须有回归测试。
- `npm run check` 全部通过且没有新增 ESLint 警告。
- 用户可见行为、快捷键、存储格式或兼容性变化已更新文档。
- 不提交 `out/`、`release/`、日志、用户数据、数据库或密钥。

## 发布流程

版本遵循 SemVer：功能向后兼容用 minor，修复用 patch，不兼容变更用 major。

```bash
git switch main
git pull --ff-only
npm version patch --no-git-tag-version
# 同步 README.md 与 RELEASE_NOTES.md
npm run check
git add package.json package-lock.json README.md RELEASE_NOTES.md
git commit -m "chore(release): vX.Y.Z"
git push origin main
git tag -a vX.Y.Z -m "MotoTrace vX.Y.Z"
git push origin vX.Y.Z
```

必须先确认 `main` CI 成功，再创建并推送标签。发布标签一旦推送就不得删除、移动或复用；如果发布失败，修复后发布新的补丁版本。

## 依赖维护

- 每月处理 Dependabot 提交，逐项合并，不一次性盲目升级所有主版本。
- 合并依赖更新前执行 `npm run check` 和 `npm audit`。
- Electron、构建工具或编辑器的大版本升级应使用独立分支，并进行安装包启动、写入、备份和恢复测试。

完整维护规则见 [工程化管理指南](docs/ENGINEERING_GUIDE.md)。
