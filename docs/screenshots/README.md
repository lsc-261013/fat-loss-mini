# H5 精选截图

2026-10-04，实际运行的H5页面，视口390×844。截图没有合成界面或模拟微信真机；样例资料、菜谱和记录由AI在独立 `http://127.0.0.1:5188` 来源通过可见界面填写，不是用户真实饮食数据。

| 文件 | 内容 | 原始本机证据（相对项目根） |
| --- | --- | --- |
| [home-390.jpg](home-390.jpg) | 首页摄入概览、待吃计划 | `../visual-2026-10-04/home-390.jpg` |
| [recipe-390.jpg](recipe-390.jpg) | 图文食谱列表 | `../visual-2026-10-04/recipe-390.jpg` |
| [recipe-editor-390.jpg](recipe-editor-390.jpg) | 自建食谱照片、名称和配料编辑 | `../visual-2026-10-04/recipe-edit/final-editor-390.jpg` |
| [custom-recipes-390.jpg](custom-recipes-390.jpg) | 默认图与自选照片卡片、编辑和加入入口 | `../visual-2026-10-04/recipe-edit/final-card-390.jpg` |

首页/食谱截图取自视觉轮完成时，编辑/自建卡片取自随后菜谱功能完成时，数值不是同一时点的数据对照。自选照片测试使用项目原有AI生成的食物图，不是用户真实上传照。

完整320px、桌面、长名称及操作证据保留在本机相邻目录，未将测试备份JSON或临时执行脚本提交。验证与限制见 [视觉交接](../../ROUND6-VISUAL-HANDOFF.md)和[编辑/照片交接](../../ROUND7-RECIPE-EDIT-HANDOFF.md)。

## R8收尾截图

2026-10-04，独立127.0.0.1:5190实际页面，AI合成测试数据，非微信截图。餐次示例使用既有r2.jpg测试照片，不代表燕麦配料图。

| 文件 | 内容 |
| --- | --- |
| [recipe-meal-390.png](recipe-meal-390.png) | 390px餐次选择及固定保存区 |
| [hidden-recipes-320.png](hidden-recipes-320.png) | 320px隐藏管理、实际照片占用和恢复/清理 |
| [record-date-320.png](record-date-320.png) | 320px日期箭头保持同一行 |

原始证据在本机项目相邻../r8-finishing-2026-10-04/；容量、清理及草稿操作详见[R8交接](../../ROUND8-FINISHING-HANDOFF.md)。

## R9自建照片与批量管理

2026-10-04，127.0.0.1:5192独立合成H5测试数据，390×844；测试燕麦/长名称菜谱使用既有r2.jpg用于照片链路验证，不代表配料摄影，也不是用户真实照片。

| 文件 | 内容 |
| --- | --- |
| [custom-plan-photo-r9-390.png](custom-plan-photo-r9-390.png) | 自建照片在计划显示；源分量修改后旧计划和已吃保留151千卡 |
| [hidden-batch-r9-390.png](hidden-batch-r9-390.png) | 隐藏列表多选、批量恢复与完整删除自建 |

320px、确认取消/删除空状态、首页和导出对比证据在本机相邻../r9-recipe-management-2026-10-04/。[本轮交接](../../ROUND9-RECIPE-MANAGEMENT-HANDOFF.md)。

## R10交互收尾

2026-10-04，127.0.0.1:5194独立合成H5数据，390×844；非微信截图，未清理5192来源。测试自选照片为项目既有r2.jpg，不是用户上传照片。不同截图取自不同操作时点，不能当作同一份数据的热量前后对照。

| 文件 | 内容与原始来源 |
| --- | --- |
| [replacement-r10-390.png](replacement-r10-390.png) | 预设替换白米饭62.5克的预览，尚未保存；../r10-interaction-2026-10-04/replacement-final-390.png |
| [photo-management-r10-390.png](photo-management-r10-390.png) | 现有自选照片筛选、双类别与容量；../r10-interaction-2026-10-04/management-existing-390.png |
| [plans-confirmed-r10-390.png](plans-confirmed-r10-390.png) | 全部确认后提示、摄入628及撤回入口；../r10-interaction-2026-10-04/plans-all-confirmed-final-390.png |

320px长名称/空态、桌面、草稿返回和容量证据仅留本机。[R10交接](../../ROUND10-INTERACTION-HANDOFF.md)。未把过程备份JSON或动画初帧截图提交。

## R11现有管理与已吃菜份

2026-10-05，独立127.0.0.1:5196真实H5页面，AI合成数据，非微信截图，未导入或清理5192来源。照片为项目既有示意图，不是用户真实照片；不同截图取自不同操作时点。

| 文件 | 内容与本机来源 |
| --- | --- |
| [intake-groups-r11-390.png](intake-groups-r11-390.png) | 已吃3项、原始7条/856.6千卡，两份同菜不合并，单香蕉独立；../r11-groups-2026-10-05/intake-two-servings-390.png |
| [existing-batch-r11-390.png](existing-batch-r11-390.png) | 内置/自建混合选择隐藏2、删除自建1，固定操作区；../r11-groups-2026-10-05/existing-mixed-390.png |
| [intake-long-r11-320.png](intake-long-r11-320.png) | 缺图长名称、五配料展开、末项修改与撤销；../r11-groups-2026-10-05/intake-long-320.png |

管理空态/长名、桌面、原草稿返回、源删除回退截图及容量/合并字段核对仅留本机。[R11交接](../../ROUND11-EXISTING-INTAKE-HANDOFF.md)。照片容量草稿只验证链路，不代表其配料摄影；未提交合成备份、缓存或日志。

## R12内置与自建统一删除

2026-10-05，独立127.0.0.1:5196实际H5页面、AI合成数据，非微信截图，未改写5192来源。内置照片为项目原有示意图；沿用界面结构，仅统一删除范围/文案及相关空态。R11的「删除自建」截图为历史效果，当前操作以R12为准。

| 文件 | 内容与本机来源 |
| --- | --- |
| [existing-delete-r12-390.png](existing-delete-r12-390.png) | 选两份内置，隐藏2/删除菜谱2可用；../r12-delete-all-2026-10-05/01-existing-preset-selection-390.png |
| [hidden-delete-r12-320.png](hidden-delete-r12-320.png) | 隐藏内置也可勾选删除，恢复/删除入口可达；../r12-delete-all-2026-10-05/03-hidden-preset-selection-320.png |

确认框、混合删除、外层管理、全删空态和兼容/历史字段比对仅留本机；详见[R12交接](../../ROUND12-ALL-RECIPE-DELETION-HANDOFF.md)。不同截图来自不同操作时点，不能当作同一组数据的摄入前后对照。
