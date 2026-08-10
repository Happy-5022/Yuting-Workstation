# 叙事大纲：给自己搭一个「专属小帮手」网页——零基础手把手教程

## ① 用户意图对齐

- **目标受众**：零基础朋友、想偷懒但想要顺手工具的人；分享场合（朋友圈/社群/公众号配文）
- **核心目标**：让观众相信「搭一个个人工作台真的只要一下午」，记住四步流程，产生「我也可以试试」的行动冲动
- **PPT 长度**：11 页（Hero 页 3 页 = 27%）
- **视觉调性**：温暖淡彩 / 手绘插画风 / 轻松亲切 / 大白话 / 治愈系
- **内容边界**：
  - 必讲：什么是工作台、准备什么、四步怎么做、能长啥样、3句大实话
  - 不讲：GitHub Pages 附录细节（太技术）、代码实现细节、具体 AI 工具对比
  - 禁碰：专业术语堆砌、硬广推销感、复杂架构图

## ② 页面布局骨架

**页面总数与分章（11页）**：

| 序号 | 页面 | 章节 | 类型 |
|------|------|------|------|
| 01 | 封面 | — | cover / hero |
| 02 | 四步总览 | — | transition |
| 03 | 这是啥 | 一、概念 | content |
| 04 | 准备两样东西 | 二、准备 | content |
| 05 | 第1步·想清楚 | 三·Step1 | content |
| 06 | 第2步·跟AI说 | 三·Step2 | content / hero |
| 07 | 第3步·发网上 | 三·Step3 | content |
| 08 | 第4步·装主屏 | 三·Step4 | content |
| 09 | 看看长啥样 | 四、举例 | content |
| 10 | 3句大实话 | 五、大实话 | content |
| 11 | 结束页 | 六、收束 | ending / hero |

**Hero 页定位**：01封面(hero)、06第2步(hero)、11结束页(hero) = 3/11=27%，间隔≥1页 ✓

**rhythm 曲线**：
- 01 peak(封面) → 02 transition(总览) → 03 valley(概念) → 04 valley(准备) → 05 valley(步骤1) → **06 peak(步骤2·AI对话)** → 07 valley(部署) → 08 valley(主屏) → 09 transition(举例) → 10 valley(大实话) → 11 peak(结束)
- 无连续≥3页 valley ✓（最长 valley 连续段：03-05 共3页，但05→06打断为peak）

**非对称版式预算（≥40% = ≥5页）**：
- 01 全幅图+骑线文字（非对称）
- 02 居中图+文字（非对称/类全幅）
- 03 左大图+右文字（非对称）
- 04 N卡片横排（对称，1/2）
- 05 左大图+右文字（非对称）
- 06 上大图+下方卡片（非对称）
- 07 左大图+右文字（非对称）
- 08 左大图+右文字（非对称）→ 改为 非对称双栏 打破重复
- 09 N卡片横排（对称，2/2）→ 改为 FAIcon列表
- 10 左大图+右文字（非对称）
- 11 全屏金句（非对称）

非对称 = 9/11 = 82% ✓（远超40%要求）

**对称版式预算（≤2页）**：仅第04页用N卡片横排（准备两样东西），其余全部非对称 ✓

## ③ 页面大纲

### 第1页 · 封面
| 字段 | 值 |
|------|-----|
| title | 给自己搭一个「专属小帮手」网页 |
| type | cover |
| role | hero |
| rhythm | peak |
| layout | 全幅图+骑线文字 |
| visual | L1: four_step_flowchart.png（背景蒙版） + 装饰性手绘元素 |
| visual_role | atmosphere → anchor |
| density | 字数约30 / 图片1张 / 留白约35% |
| anti_pattern | 禁止纯色背景无图；禁止标题区塞装饰小图；禁止正文密集 |

### 第2页 · 四步总览
| 字段 | 值 |
|------|-----|
| title | 四步搞定，一下午就能用上 |
| type | section / transition |
| role | transition |
| rhythm | transition |
| layout | 全幅图居中+底部文字 |
| visual | L1: four_step_flowchart.png（占B区60%） |
| visual_role | evidence |
| density | 字数约50 / 图片1张 / 留白约25% |
| anti_pattern | 禁止把流程图缩成角标；禁止铺满正文段落 |

### 第3页 · 这是啥
| 字段 | 值 |
|------|-----|
| title | 先搞懂：这玩意儿到底是啥？ |
| type | content |
| role | supporting |
| rhythm | valley |
| layout | 左大图+右侧文字 |
| visual | L1: my_workspace.png（占左55%） |
| visual_role | anchor |
| density | 字数约200 / 图片1张 / 留白约28% |
| anti_pattern | 禁止50:50等分双栏；禁止图片缩小为装饰 |

### 第4页 · 准备两样东西
| 字段 | 值 |
|------|-----|
| title | 你只需要准备两样东西 |
| type | content |
| role | supporting |
| rhythm | valley |
| layout | N卡片横排（2卡片，唯一对称页） |
| visual | L2: FAIcon图标×2 |
| visual_role | evidence |
| density | 字数约180 / 图标2个 / 留白约30% |
| anti_pattern | 禁止纯文字堆砌无视觉锚点；禁止超过2张卡片 |

### 第5页 · 第1步·想清楚
| 字段 | 值 |
|------|-----|
| title | 第1步：先想清楚"我要它帮我干啥" |
| type | content |
| role | supporting |
| rhythm | valley |
| layout | 左大图+右侧文字 |
| visual | L1: pick_3_first.png（占左55%） |
| visual_role | anchor |
| density | 字数约200 / 图片1张 / 留白约28% |
| anti_pattern | 禁止等分双栏；禁止功能列表超过5项 |

### 第6页 · 第2步·跟AI说人话
| 字段 | 值 |
|------|-----|
| title | 第2步：跟AI搭子说人话，让它帮你生成 |
| type | content |
| role | hero |
| rhythm | peak |
| layout | 上大图+下方卡片 |
| visual | L1: talk_to_ai.png（占上55%） |
| visual_role | anchor |
| density | 字数约180 / 图片1张 / 留白约25% |
| anti_pattern | 禁止把图片缩小为L3角标；禁止正文挤满无呼吸 |

### 第7页 · 第3步·发到网上
| 字段 | 值 |
|------|-----|
| title | 第3步：把网页发到网上（部署） |
| type | content |
| role | supporting |
| rhythm | valley |
| layout | 左大图+右侧文字 |
| visual | L1: deploy_online.png（占左55%） |
| visual_role | anchor |
| density | 字数约200 / 图片1张 / 留白约28% |
| anti_pattern | 禁止与第3/5页版式完全相同→右侧增加「选法A/B」对比块 |

### 第8页 · 第4步·装到主屏
| 字段 | 值 |
|------|-----|
| title | 第4步：装到手机主屏，离线也能用 |
| type | content |
| role | supporting |
| rhythm | valley |
| layout | 非对称双栏（60:40，左侧操作步骤+右侧配图） |
| visual | L1: add_to_homescreen.png（占右40%） |
| visual_role | anchor |
| density | 字数约180 / 图片1张 / 留白约28% |
| anti_pattern | 禁止与连续页面重复左大图右文字→改用双栏打破 |

### 第9页 · 看看长啥样
| 字段 | 值 |
|------|-----|
| title | 搭好了能长啥样？ |
| type | content |
| role | supporting |
| rhythm | transition |
| layout | FAIcon列表（4个功能卡片纵向排列） |
| visual | L2: FAIcon×4 |
| visual_role | evidence |
| density | 字数约220 / 图标4个 / 留白约25% |
| anti_pattern | 禁止N卡片横排（已用完配额）；禁止纯文字列表 |

### 第10页 · 3句大实话
| 字段 | 值 |
|------|-----|
| title | 给零基础朋友的3句大实话 |
| type | content |
| role | supporting |
| rhythm | valley |
| layout | 左大图+右侧文字（3条要点卡片） |
| visual | L1: ask_ai_backup.png（占左45%） |
| visual_role | anchor |
| density | 字数约180 / 图片1张 / 留白约28% |
| anti_pattern | 禁止说教口吻；禁止超过3条要点 |

### 第11页 · 结束页
| 字段 | 值 |
|------|-----|
| title | 现在，去跟你的AI搭子说第一句话吧 |
| type | ending |
| role | hero |
| rhythm | peak |
| layout | 居中金句/巨型数字风格 |
| visual | L2: 装饰性渐变光晕/SVG |
| visual_role | atmosphere |
| density | 字数约25 / 留白约50% |
| anti_pattern | 禁止铺满正文；禁止无视觉焦点 |
