# 设计稿：个人工作台搭建教程 PPT

## 1. 画布与全局母版

| 母版区 | 垂直位置 | 高度 | 内容规则 |
|:---|:---|:---|:---|
| A · 标题块 | 0–110px | 110px | 主标题 34px bold，#2D3436 |
| B · 内容区 | 110–660px | 550px 可用 | 正文、图表、配图、卡片 |
| C · 页脚条 | 660–720px | 60px | 左侧「Happy赖」+ 右侧页码 NN/11，13px #B2BEC3 |

页面 padding：上下 20px、左右 70px

## 2. 颜色系统

### 色板（温暖淡彩·手绘风）

| 角色 | Hex | 用途 |
|:---|:---|:---|
| 主色（暖米白） | **#FFF8F0** | 页面背景、大面积底色 |
| 辅色（温暖橘） | **#E8A87C** | 卡片背景、章节色块、装饰 |
| 强调色（珊瑚粉） | **#D4654A** | 核心数字、CTA、焦点元素 |
| 文本主色 | **#3D3D3D** | 标题、正文 |
| 文本辅色 | **#7F8C8D** | 引文、注释、页脚 |

### 色彩面积分配

| 色彩角色 | 常规页 | Hero页 |
|:---|:---|:---|
| 主色 #FFF8F0 | ≥55% | 30-45% |
| 辅色 #E8A87C | ≤20% | ≤25% |
| 强调色 #D4654A | ≤5% | 15-18% |
| 中性色 | 剩余 | 剩余 |

### 渐变方案
- 标题渐变：`linear-gradient(135deg, #E8A87C 0%, #D4654A 100%)`
- 卡片头部：`linear-gradient(135deg, #FFE4D4 0%, #FFF0E8 100%)`
- Hero 蒙版：`rgba(255,248,240,0.75)` 叠在插画背景上
- 装饰光晕：`radial-gradient(circle at center, rgba(232,168,124,0.15) 0%, transparent 70%)`

## 3. 字体系统

### 字号层级

| 层级 | 字号 | 字重 | 行高 | 用途 |
|:---|:---|:---|:---|:---|
| 封面主标题 | 64px | bold | 1.2 | 仅封面 |
| 章节大字 | 48px | bold | 1.1 | 章节过渡、结束页 |
| 页面主标题 | 34px | bold | 1.3 | A区标题块 |
| 卡片小标题 | 24px | 600 | 1.4 | 卡片头、步骤标签 |
| 正文 | 22px | regular | 1.55 | 段落内容 |
| 引文/提示 | 19px | italic | 1.5 | 提示框、备注 |
| 页码/页脚 | 13px | regular | 1.4 | C区 |

### 字体
- 中文：**阿里普惠体** / 思源黑体（fallback）
- 英文/数字：**Poppins** / Nunito（活力亲和方向）
- 封面可混用一点手写感

## 4. 信息密度

| 页面类型 | 最少元素 | 正文字数下限 | 主视觉占B区 |
|:---|:---|:---|:---|
| 封面 | 标题+副标+主视觉 | 25 | ≥40% |
| 内容页·单主题 | 标题+正文+主视觉 | 180 | ≥35% |
| 内容页·卡片组 | 标题+N卡 | 每卡≥90 | — |
| 章节过渡 | 大字+小标+图 | 40 | ≥45% |
| 结束页 | 金句+落款 | 20 | — |

常规页留白 ≤32%。Hero/结束页允许留白达45-50%。

## 5. 配图系统

所有配图为 **温暖淡彩手绘插画风格**（happy-illustrator 技能产出），统一视觉。

| 等级 | 文件名 | 内容 | 使用页 | 尺寸 |
|:---|:---|:---|:---|:---|
| L1 | my_workspace.png | Happy赖展示"我的地盘"浏览器窗口 | 03 | 左55% |
| L1 | pick_3_first.png | Happy赖从功能图标中选"先来3个" | 05 | 左55% |
| L1 | talk_to_ai.png | Happy赖在笔记本前跟AI说人话 | 06 | 上55% |
| L1 | deploy_online.png | Happy赖把网页发到网上（云+木牌） | 07 | 左55% |
| L1 | add_to_homescreen.png | Happy赖装到手机主屏（离线通传） | 08 | 右40% |
| L1 | ask_ai_backup.png | Happy赖举着"问AI 记得备份"纸条 | 10 | 左45% |
| L1 | four_step_flowchart.png | 四步流程图（每环节小人版） | 01背景,02居中 | 全幅/60% |

图片来源：P0 材料图（用户已有 happy-illustrator 产出的教程配图），已 Read 核对内容与风格一致性。

## 6. 页面映射表

| # | 文件 | 类型 | 角色 | 版式 | L1文件 | 字数 | 留白 | 色彩 | 关键约束 |
|:-:|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| 01 | slide_01_cover.jsx | cover | hero | 全幅图+骑线文字 | four_step_flowchart.png | 30 | 38% | 主40+辅25+强15 | 全幅插画蒙版+左大标题 |
| 02 | slide_02_overview.jsx | section | transition | 居中图+底部文字 | four_step_flowchart.png | 50 | 25% | 主50+辅20 | 图居中占B区60% |
| 03 | slide_03_what_is_it.jsx | content | supporting | 左大图+右文字 | my_workspace.png | 200 | 28% | 主55+辅18 | 图占左55%，右侧卡片 |
| 04 | slide_04_prepare.jsx | content | supporting | N卡片横排(2) | FAIcon×2 | 180 | 30% | 主50+辅22 | 唯一对称页，2卡片 |
| 05 | slide_05_step1.jsx | content | supporting | 左大图+右文字 | pick_3_first.png | 200 | 28% | 主55+辅18 | 图左55%，右侧要点列表 |
| 06 | slide_06_step2.jsx | content | hero | 上大图+下方卡片 | talk_to_ai.png | 180 | 25% | 主35+辅25+强12 | 图上55%，下方对话模板卡 |
| 07 | slide_07_step3.jsx | content | supporting | 左大图+右文字 | deploy_online.png | 200 | 28% | 主55+辅18 | 右侧含选法A/B对比 |
| 08 | slide_08_step4.jsx | content | supporting | 非对称双栏60:40 | add_to_homescreen.png | 180 | 28% | 主50+辅20 | 打破连续左图右文 |
| 09 | slide_09_examples.jsx | content | supporting | FAIcon纵向列表 | FAIcon×4 | 220 | 25% | 主55+辅20 | 4功能卡片纵排 |
| 10 | slide_10_tips.jsx | content | supporting | 左大图+右文字 | ask_ai_backup.png | 180 | 28% | 主50+辅22 | 右侧3条大实话卡片 |
| 11 | slide_11_ending.jsx | ending | hero | 居中金句 | SVG光晕 | 25 | 48% | 主30+辅30+强15 | 渐变大字+落款 |
