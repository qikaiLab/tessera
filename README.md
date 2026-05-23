# MotoTrace

<div align="center">

[![Version](https://img.shields.io/badge/version-0.2.3-blue.svg)](package.json)
[![License](https://img.shields.io/badge/license-PolyForm%20Noncommercial-orange.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)]()
[![Build](https://img.shields.io/github/actions/workflow/status/qikaiLab/tessera/release.yml?label=CI%2FCD)](https://github.com/qikaiLab/tessera/actions)
[![Release](https://img.shields.io/github/v/release/qikaiLab/tessera?include_prereleases)](https://github.com/qikaiLab/tessera/releases)

**MotoTrace** 是一款专为追求极致记录体验的用户打造的 Windows 桌面端自我追踪与分析软件。  
它不仅是一个记录工具，更是一个高度可自定义的个人数据中心。

[📦 立即下载](https://github.com/qikaiLab/tessera/releases/latest) · [📝 查看更新日志](#-更新日志) · [🛠️ 开发者指南](#-开发者指南)

</div>

---

## 🌟 核心价值

在信息碎片化的时代，MotoTrace 旨在帮助你建立**结构化的自我认知**。无论是日记心情、健身数据、学习进度还是财务状况，MotoTrace 都能通过高度灵活的「数据版块」系统，将零散的记录转化为直观的历史趋势与深度分析。

与其他记录应用的关键区别在于：
- 🔒 **完全本地化** — 数据永远不会离开你的设备，无需账号，无需联网。
- 🧩 **数据版块自由定义** — 数字、文本版块随意组合，打造专属于你的追踪维度。
- 📊 **从记录到洞察** — 不只是存储，更能通过图表、热力图让数据「说话」。

---

## ✨ 核心特性

### 📝 沉浸式记录 (Record)

| 功能 | 说明 |
|------|------|
| **多维度数据版块** | 文本（富文本 Markdown）和数字版块可自由组合，各自拥有独立的记录区域 |
| **CodeMirror 6 编辑器** | 基于 CodeMirror 6 实现的 Obsidian 风格「实时预览」Markdown 编辑体验 |
| **Markdown 工具栏** | 一键插入加粗、斜体、引用、分割线、代办列表、有序/无序列表、表格等常用格式 |
| **字数实时统计** | 防抖处理，毫秒级更新当前版块的字数，不干扰输入流 |
| **沉浸式全屏模式** | 一键全屏，毛玻璃背景遮罩，聚焦写作。支持 `Esc` 退出与 `Ctrl+S` 手动保存 |
| **全局日期状态** | 以 `selectedDate` 为单一数据源，从日历跳转回记录页后，视图精准锁定，不重置 |
| **原子化写入** | 写入时先生成 `.tmp` 文件，成功后再原子替换，彻底防止崩溃导致的数据损坏 |

### 🗓️ 时空连结 (Calendar & Timeline)

| 功能 | 说明 |
|------|------|
| **多维日历视角** | 月度 / 周度 / 年度三种视图，选中日期实时高亮同步显示 |
| **倒数日管理器** | 在日历标签中直观呈现重要纪念日或截止日倒计时 |
| **智能时间线** | 按日期倒序展示各日期数据摘要，支持全文关键词搜索与版块筛选 |
| **未来日期导航** | 支持浏览未来日期，方便提前记录计划或重要日程 |

### 📊 深度数据分析 (Analytics)

| 功能 | 说明 |
|------|------|
| **自定义看板** | 自由创建分析卡片，将任意版块数据绑定到同一图表进行多指标对比 |
| **折线图 / 柱状图** | 清晰展示数字版块的时间序列趋势 |
| **热力图** | 以日历热力图形式呈现活跃度，直观发现数据规律 |
| **字数统计图** | 文本版块亦可进入图表，通过字数波动度量创作/思考活跃度 |

### ⚙️ 高级管理与安全

| 功能 | 说明 |
|------|------|
| **版块动态管理** | 拖拽排序，常驻/激发状态一键切换 |
| **删除安全预检** | 删除前异步扫描历史记录，有数据的版块无法误删，弹出 Modal 提示 |
| **自定义存储路径** | 支持将数据目录迁移到任意位置（如外置硬盘、云同步盘） |
| **循环备份** | 内置 ZIP 备份，自动保留最近 30 份快照，防止误操作导致的数据丢失 |
| **崩溃恢复** | 软件启动时自动扫描残留 `.tmp` 文件，并在设置界面引导恢复 |

---

## 🛠️ 技术架构

MotoTrace 采用现代化的桌面端技术栈，确保流畅的交互与稳健的性能：

```
Electron (electron-vite)
├── Main Process     → 文件系统 I/O、IPC 桥接、原子写入、ZIP 备份管理
├── Preload Script   → 安全地将 Node.js 原生能力暴露给渲染层
└── Renderer (React 18)
    ├── AppContext    → selectedDate / sections 全局单点状态管理
    ├── Pages         → Record / Calendar / Timeline / Analytics / Settings
    └── Components    → CodeMirrorEditor / Charts / DragSortable / Modal 等
```

### 依赖项总揽

| 库 | 版本 | 用途 |
|----|------|------|
| [Electron](https://www.electronjs.org/) | 33.x | 桌面外壳 |
| [React](https://reactjs.org/) | 18.x | UI 框架 |
| [CodeMirror 6](https://codemirror.net/) | 6.x | 核心编辑器引擎 |
| [Recharts](https://recharts.org/) | 2.x | 图表渲染 |
| [dnd-kit](https://dndkit.com/) | 6.x | 拖拽排序 |
| [date-fns](https://date-fns.org/) | 3.x | 日期计算与格式化 |
| [JSZip](https://stuk.github.io/jszip/) | 3.x | 数据备份压缩 |

### 项目结构

```
Project_SlefTracker/
├── .github/workflows/    # GitHub Actions CI/CD — 打 Tag 自动构建并发布 Release
├── src/
│   ├── main/             # 主进程：文件读写、IPC handler、备份逻辑
│   ├── preload/          # 预加载脚本：安全桥接 electronAPI
│   └── renderer/src/
│       ├── context/      # AppContext — selectedDate、sections 全局状态
│       ├── pages/        # Record / Calendar / Timeline / Analytics / Settings
│       └── components/   # CodeMirrorEditor、Modal、各类图表组件
├── electron.vite.config.js
└── package.json
```

---

## 🚀 开发者指南

### 环境准备

- [Node.js](https://nodejs.org/) >= 18（推荐 20 LTS）
- Windows 10 / 11（打包目标平台）

### 安装与启动

```bash
# 1. 克隆项目
git clone https://github.com/qikaiLab/tessera.git
cd tessera

# 2. 安装依赖
npm install

# 3. 开发模式运行（热重载）
npm run dev

# 4. 生产打包（生成 release/ 目录下的 NSIS 安装包）
npm run dist
```

### 发布新版本（CI/CD 自动化）

本项目配置了 GitHub Actions 全自动构建 & 发布流水线。只需在本地打一个符合 `v*` 格式的 Git Tag 并推送，CI 即会在 Windows 云端完成构建，并自动将安装包（`.exe`）附加到对应的 GitHub Release：

```bash
# 1. 提交所有变更
git add .
git commit -m "feat: some new feature"

# 2. 创建版本 Tag
git tag v0.1.1

# 3. 推送代码与 Tag
git push origin main --tags
```

---

## 🛡️ 数据安全与备份策略

MotoTrace 将数据安全视为头等大事，采用三层防护：

1. **原子化写入** — 写入前先生成 `.tmp` 临时文件，成功后再通过重命名原子覆盖正式文件。即使在写入过程中发生断电或崩溃，正式数据文件也不会损坏。

2. **崩溃恢复** — 每次启动时自动扫描数据目录下的 `.tmp` 残留文件。若发现残留，在「设置」页面主动提示用户，支持一键恢复为有效记录。

3. **循环快照备份** — 用户可在「设置」中手动触发备份，系统以 ZIP 格式保留最近 30 份历史快照。超出上限时自动清理最旧的一份，确保始终有 30 个可回滚节点。

---

## 📋 更新日志

### v0.2.3 *(2026-05-23)*

**新特性**
- **配置与数据分离 (metadata.json)**：倒数日配置和图表看板配置正式由浏览器 `localStorage` 迁移至当前数据根目录下的 `metadata.json`。配置文件支持跟随数据文件夹无感拷贝/迁移，并提供平滑的首次启动自动导入与清理机制。
- **特定版块批量删除**：时间线在「管理模式」下支持对选中日期进行细粒度特定版块删除，其他版块内容不受波及。删除后若某天内容已清空，会自动进行物理文件清理，保持存储纯净。
- **自定义 React 确认弹窗**：开发了高颜值的自定义确认对话框，提供毛玻璃遮罩、弹出回弹动画并完美响应暗色/亮色主题，替换了原生的 Windows 系统弹窗。

**修复**
- **焦点丢失修复**：通过 React 自定义弹窗，彻底解决 Electron 无边框窗口下原生弹窗触发的小概率鼠标点击输入框焦点失效 Bug。
- **日历标点残留修复**：修复了在删除某日全部数据后，日历标点依旧存在不消失的残留 Bug。
- **日记“传染/泄露”Bug 修复**：修复了前后日来回切换跳转时，旧日记内容小概率被拷贝覆盖到临近无数据日期的问题。

---

### v0.2.2 *(2026-05-22)*

**新特性**
- **排版个性化设置**：设置页新增全屏宽度、编辑器行高和字距设置，支持全屏无边框窗口的拖动。
- **时间线版块筛选增强**：在选择特定版块时，会自动隐藏没有记录该版块的卡片，布局更加紧凑。

**优化**
- 优化了数值版块的卡片布局与对齐，并修复了全部版块合并字数时的统计策略。

---

### v0.2.1 *(2026-05-18)*

**新特性**
- **版块重命名**：设置页支持对已有版块重命名，并自动关联所有历史 JSON 文件中的 Key 以保证数据连贯。
- **新增彩蛋触发机制**：时间线模糊搜索特定词汇触发趣味动效。
- **重名版块检测**：添加新版块时自动校验重名与自动定位逻辑。

---

### v0.2.0 *(2026-05-14)*

**改进与修复**
- 优化了 CodeMirror 编辑器中文字数实时防抖统计逻辑。
- 完善了 Markdown 编辑工具栏的功能。
- 增加了常驻/非常驻版块动态激活切换和 ZIP 数据轮转自动备份功能。

---

### v0.1.1 *(2026-03-19)*

**修复**
- 修复打包后 `win-unpacked` 模式下白屏/灰屏问题（通过 `loadFile` + Vite `base: './'` 相对路径修正）
- 修复全屏编辑器模式下文本不可见的 UI 分层渲染 Bug
- 修复设置页删除版块时 `ReferenceError` 异常

**改进**
- 全屏编辑模式退出后自动重新聚焦编辑器
- 优化倒数日管理器 UI，与整体设计风格保持一致

---

### v0.1.0 *(2026-03-14)*

**初始发布**
- 完整的记录、日历、时间线、分析、设置五大模块
- CodeMirror 6 Markdown 实时预览编辑器
- 沉浸式全屏编辑（毛玻璃遮罩 + Esc/Ctrl+S 快捷键）
- 全局 `selectedDate` 状态管理，视图跨页面精准同步
- 自定义分析看板（折线图、柱状图、热力图）
- 原子写入 + 循环 ZIP 备份数据安全策略
- GitHub Actions 全自动 CI/CD 构建与发布

---

## ❓ 常见问题

**Q: 我的数据存储在哪里？**  
A: 默认存储在 `%APPDATA%/mototrace/data/` 目录下。你可以在「设置」页中更改为任意自定义路径（如云同步盘）。

**Q: 可以备份/迁移数据吗？**  
A: 可以。在「设置」页一键导出 ZIP 备份，在新设备上修改存储路径指向备份解压目录即可完成迁移。

**Q: 为什么删除版块时提示无法删除？**  
A: 该版块已有历史数据，系统会阻止误删。如果你确定不再需要该版块，请先将其设为「非常驻」状态隐藏，历史数据将被保留但不会出现在记录页面。

**Q: 软件是否支持 macOS / Linux？**  
A: 当前版本仅支持 Windows。未来版本考虑扩展多平台支持。

---

## 📝 许可证

本项目以 [PolyForm Noncommercial License 1.0.0](LICENSE) 发布：**源码公开，个人学习、研究、爱好项目，以及教育、公益等非营利机构均可免费使用、修改与分发；商业用途需另行取得作者许可。** 这不是 OSI 定义的「开源」许可证，而是源码可见（source-available）许可证。

© 2026 MotoTrace. Built with ❤️ using Electron + React.
