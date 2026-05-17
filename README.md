# 轻脂记 — 女性减脂助手

> 微信小程序 · AI 协同构建 · 已提交审核

一个帮助女性计算减脂目标、记录饮食摄入、根据营养素缺口智能推荐食谱的微信小程序。

**这个项目本身是一次 AI-native 开发的实践：** 全程使用 Claude Code + 74 个 AI Skill 协同工作，从需求分析到交付上线，所有代码由 AI 辅助生成，人类负责决策和审查。

---

## AI 协同开发过程

### 技能编排（Skill Orchestration）

项目加载了 4 套开源 AI skill 体系，共 74 个专项技能：

| Skill 体系 | 数量 | 职责 |
|-----------|------|------|
| **superpowers** | 14 个 | TDD、系统调试、代码审查、Git 工作流 |
| **gstack** | 46 个 | 产品规划（/office-hours）、架构审查、QA 测试、安全审计（/cso）、一键发布（/ship） |
| **taste-skill** | 12 个 | 前端设计、品牌风格、极简 UI、图像生成 |
| **impeccable** | 1 个 | 反 AI 风格审查（去除模板化设计） |

### 开发流水线

```
需求 → /brainstorming → /writing-plans → /plan-ceo-review
  → /plan-eng-review → /test-driven-development
  → /impeccable audit → /review → /ship
```

- **14 个任务** 拆分执行，每个任务独立提交
- **TDD 流程**：先写测试 → 确认失败 → 最小实现 → 确认通过
- **设计审查**：impeccable skill 执行 `/audit` 去 AI 味（禁止紫粉渐变、大圆角、emoji）

### 关键决策点

- 图标方案：SVG → CSS 形状 → **微信原生 emoji**（经过 3 轮迭代，最终选择兼容性最好的方案）
- 状态管理：Pinia + 本地缓存，无后端依赖
- 食谱推荐：根据实时营养素缺口动态排序

---

## 功能概览

| 页面 | 核心功能 |
|------|---------|
| 首页 | 摄入追踪大卡 + 进度条 + 营养素缺口智能推荐 |
| 记录 | 45 种食材选择（含实物克数描述）+ 今日计划 + 已吃记录 + 批量管理 |
| 食谱 | 7 个预设 + 自建菜谱 + 食材替换 + 一键加入计划 |
| 我的 | 身体数据 + 活动周期 + **生理期饮食科学建议**（4 个阶段独立推荐） |

---

## 技术栈

- **框架：** uni-app (Vue 3 + Vite + TypeScript)
- **状态管理：** Pinia + 本地缓存持久化
- **目标平台：** 微信小程序
- **数据：** 本地存储，零后端依赖

---

## 运行

```bash
npm install --registry https://registry.npmmirror.com
npm run build:mp-weixin
```

微信开发者工具导入 `dist/build/mp-weixin`。

---

## 作者

一位用 AI 构建产品的开发者。

GitHub: [@lsc-261013](https://github.com/lsc-261013)
