# 安全策略 · Security Policy

Tessera 是一个完全本地运行的桌面软件：不联网、没有账号和服务器，所有数据都是用户电脑上的文件。因此最值得关注的安全问题，是**软件被诱导去读写、打开不该碰的文件**，以及**用户数据被损坏或丢失**。

## 支持的版本

安全修复只进入[最新发布的版本](https://github.com/qikaiLab/tessera/releases/latest)（目前是 0.5.x）。旧版本不单独维护，请先升级再确认问题是否还存在。

## 怎么报告

**一般的缺陷、功能建议和使用问题**：请在 [GitHub Issues](https://github.com/qikaiLab/tessera/issues) 提交，选择对应的模板，Issue 里用中文或英文都可以。

**不适合公开的安全问题**：请不要建公开 Issue，改用邮件私下联系维护者：

> **qikai2007820@gmail.com**（邮件主题请以 `[Tessera Security]` 开头）

这个邮箱与维护者 GitHub 个人资料上公开的邮箱是同一个。如果仓库的 Security 页面提供「Report a vulnerability」按钮，也可以用它提交私有报告，效果相同。

请在报告里写清：

1. 受影响的版本（软件内「关于」对话框可以一键复制版本信息）和 Windows 版本；
2. 最小的复现步骤，以及你期望的和实际发生的结果；
3. 你认为的影响范围（能读写哪些文件、能执行什么、会丢什么数据）；
4. 你已经试过的缓解办法，如果有。

**请不要**在报告里附上真实的个人记录、数据库、访问令牌或本机的隐私路径；用脱敏的最小样例就够了。也请不要在别人的电脑或数据上测试。

## 什么算安全问题

下面这些按高优先级处理：

- 路径穿越或任意文件的读取、写入、删除（含导入 ZIP、备份、数据目录迁移、自动历史）；
- 点击笔记里的链接就运行了程序，或打开了不该打开的协议或文件类型；
- 渲染进程突破沙盒、内容安全策略（CSP）或 IPC 权限限制；
- 构造的数据文件、备份包或粘贴内容导致软件崩溃、卡死或耗尽内存（拒绝服务）；
- 软件自己造成的数据损坏、静默丢失或被旧内容覆盖。

下面这些通常**不**当作安全漏洞（仍欢迎作为普通 Issue 反馈）：

- 需要先取得这台电脑的管理员权限、或能直接修改用户数据文件夹才能做到的事；
- 把数据目录放进云同步盘后，由同步服务造成的冲突或泄露；
- 未签名安装包触发的 Windows SmartScreen 提示（这是已知的，见 README）；
- 依赖库里已公开、但对 Tessera 并不可利用的告警（请先说明如何在软件里触发它）。

## 响应方式

Tessera 由一位维护者在业余时间维护，**只能尽力而为，不承诺固定时限**。一般会在一周内回复确认；涉及数据损坏、任意文件读写的问题优先处理。修复会在下一个发布版本里完成，并写入更新日志；如果你愿意署名，会在致谢中注明。

请在修复发布之前不要公开细节。修复必须包含回归测试，并在发布前完成数据兼容和安装包验证。

---

## English summary

Tessera is a local-only Windows desktop app (no network access, no accounts, no server). Security fixes go into the latest release only (currently 0.5.x).

- **Bugs, questions, feature requests**: open a [GitHub issue](https://github.com/qikaiLab/tessera/issues) (Chinese or English).
- **Anything that should not be public** (path traversal, arbitrary file read/write, sandbox / CSP / IPC bypass, a crafted backup or data file that crashes the app or exhausts memory, data corruption): email **qikai2007820@gmail.com** with the subject `[Tessera Security]`, or use "Report a vulnerability" on the repository's Security page if it is offered. Please include the version, minimal reproduction steps and the impact, and never attach real personal data.
- This is a one-person, spare-time project: replies are best-effort (usually within a week), with no guaranteed fix time. Please do not disclose details before a fix is released.
