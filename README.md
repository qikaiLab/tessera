# MotoTrace

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](package.json)
[![License](https://img.shields.io/badge/license-PolyForm%20Noncommercial-orange.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)]()

> **MotoTrace** 是一款专为追求极致记录体验的用户打造的 Windows 桌面端自我追踪与分析软件。它不仅是一个记录工具，更是一个高度可自定义的个人数据中心。

## 🌟 核心价值

在信息碎片化的时代，MotoTrace 旨在帮助你建立结构化的自我认知。无论是日记心情、健身数据、学习进度还是财务状况，MotoTrace 都能通过高度灵活的「数据版块」系统，将零散的记录转化为直观的历史趋势与深度分析。

---

## ✨ 核心特性

### 📝 沉浸式记录 (Today)
- **多维度分隔**: 不同的数据版块（文本、数字）拥有独立且清晰的记录区域。
- **智能 Markdown 编辑器**: 基于 CodeMirror 6，支持实时预览、高亮显示、工具栏快捷插入及**字数实时统计**。
- **局部沉浸式全屏**: 针对长文本记录，提供一键全屏模式（毛玻璃效果），支持 `Esc` 退出及 `Ctrl+S` 手动保存。
- **极致安全**: 毫秒级自动保存，配合 `.tmp` 临时文件与重命名机制，最大限度防止因意外折损数据。

### 🗓️ 时空连结 (Calendar & Timeline)
- **全局日期状态**: 整个应用维持统一个 `selectedDate` 数据源。无论是在日历中跳转、时间线回溯，视图将锁定在选定日期。
- **多维日历视角**: 提供月度、周度、年度视图，具备实时日期高亮。内置**倒数日管理器**，重要日子直观呈现在日历标签中。
- **智能时间线**: 按日期倒序展示数据摘要，支持全文搜索，并可按数据版块进行精准过滤。

### 📊 深度数据分析 (Analytics)
- **自定义看板**: 允许用户自由创建分析卡片，将任意数据版块（如睡眠时长 vs. 学习时长）绑定到同一图表进行多指标对比。
- **多样化图表**: 集成 Recharts，提供折线图、柱状图、饼图及**热力图**，全方位揭示数据背后的逻辑。
- **字数统计看板**: 文本版块亦可作为统计源，通过字数波动观察创作/思考的活跃度。

### ⚙️ 高级管理与安全
- **版块动态管理**: 支持拖拽排序、常驻/激发状态切换。内置「删除预检」保护，防止误删有历史记录的版块。
- **数据自主掌控**: 支持自定义存储根目录，内置全本地 ZIP 备份（自动循环保留最近 30 份），支持数据一键导入导出。

---

## 🛠️ 技术架构

MotoTrace 采用现代化的桌面端技术栈，确保流畅的交互与稳健的性能：

- **基础外壳**: [Electron](https://www.electronjs.org/) (通过 `electron-vite` 构建，实现主进程与渲染进程的高效解耦)
- **前端驱动**: [React 18](https://reactjs.org/) (配合 Context API 实现高效的全局状态管理)
- **核心编辑器**: [CodeMirror 6](https://codemirror.net/) (提供极致的 Markdown 录入体验)
- **可视化引擎**: [Recharts](https://recharts.org/) (高性能、声明式的图表渲染)
- **交互动效**: [dnd-kit](https://dndkit.com/) (流畅的跨组件拖拽排序)

### 项目结构预览
```text
src/
├── main/           # 主进程逻辑：文件系统 I/O、IPC 桥接、备份管理
├── preload/        # 预加载脚本：安全地暴露 Electron 原生能力
└── renderer/       # 渲染进程：React 页面组件、Context 状态、全局样式
    └── src/
        ├── context/   # AppContext 全局单点状态
        ├── pages/     # 记录、日历、时间线、分析、设置页面
        └── components/# 通用 UI 组件与编辑器封装
```

---

## 🚀 开发者指南

### 环境准备
确保你的系统已安装 [Node.js](https://nodejs.org/)。

### 安装与启动
```bash
# 1. 克隆并进入项目
cd Project_SlefTracker

# 2. 安装依赖
npm install

# 3. 开发环境运行
npm run dev

# 4. 生产环境打包 (生成 release/ 安装包)
npm run build
```

---

## 🛡️ 数据安全与备份策略

1.  **原子化写入**: 写入文件时先生成 `.tmp` 文件，成功后再覆盖原文件，避免崩溃导致的数据损坏。
2.  **崩溃恢复**: 软件启动时会自动扫描残留的 `.tmp` 文件，并在设置界面提示用户恢复。
3.  **循环备份**: 每次手动或关键操作时可触发备份，系统自动维护 30 份历史快照，逾期自动循环清理。

---

## 📝 许可证

本项目以 [PolyForm Noncommercial License 1.0.0](LICENSE) 发布：**源码公开，个人学习、研究、爱好项目，以及教育、公益等非营利机构均可免费使用、修改与分发；商业用途需另行取得作者许可。** 这不是 OSI 定义的「开源」许可证，而是源码可见（source-available）许可证。

© 2024 MotoTrace Team.
