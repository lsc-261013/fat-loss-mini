# 第三轮 skill 来源与适用判断

按用户指定查找公开来源，2026-09-25至26日读取。仅阅读和评估，没有全局安装、运行陌生安装脚本或引入其他前端框架。以下判断针对当前 uni-app 微信饮食记录工具，不是给技能本身排名。

| Skill | 查看来源 | 判断与使用方式 |
| --- | --- | --- |
| frontend-design | [Anthropic SKILL.md](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md) | 本轮主要采用。它直接指出同质圆角卡片、重复眉题、装饰文案和常见AI配色套路；按产品内容先定排版与用词，再看真实截图自审。没有把“独特”理解为堆特效 |
| web-design-guidelines | [Vercel SKILL.md](https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md)、[当前规则](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md) | 用于操作细节检查：输入标签、按钮焦点、数字对齐、触控、长内容、可滚动弹层和安全区。React、SSR及网页专属规则不机械套到uni-app；不宣称完整符合每条规则 |
| Taste Skill | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/SKILL.md) | 阅读了定位及相关设计段落。主文件明确面向“Landing pages, portfolios, and redesigns”，排除多步骤产品UI/原生移动场景；不作为本项目主流程。可借鉴先审现状、避免同质卡片，但不采用落地页布局或React动效栈 |
| UI/UX Pro Max | [主SKILL.md](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/.claude/skills/ui-ux-pro-max/SKILL.md) | 阅读主文件的优先级与工作流，适合触控尺寸、字号、对比度等参考。本轮没有安装/运行它的数据库检索，因此没有声称得到某个数据库配色或设计系统匹配；不按“健康类=某套绿卡片”生成模板 |
| impeccable | [主技能源文件](https://github.com/pbakaus/impeccable/blob/main/skill/SKILL.src.md) | 阅读主文件。它区分工具操作与展示说服，强调扫描、任务完成和原生预期，方向适合；完整工作流还涉及CLI及更多参考文件，本轮不安装执行整套流程，仅作适用性参考 |

## 本轮采用的设计约束

- 页面任务是记饮食、核对分量、处理计划，首屏优先给这些内容。
- 白色主体、灰色输入背景、深色正文、绿色操作；避免让所有文字都带绿、所有区域都套相同卡片。
- 中文系统字体，字号按标题、正文、辅助信息分级，数值等宽；没有外部字体下载。
- 移除装饰emoji和大口号，保留具体空状态、错误原因、操作后果和数据备份提醒。
- 用真实H5页面看结果，必要的业务功能保留；不以截图好看为由改热量算法或删除数据。

技能可以帮助发现问题，不能替代产品判断或微信真机验收。是否减少了用户感受到的“AI味”，仍由用户看实际页面和使用后判断。
