from PIL import Image, ImageDraw, ImageFont
import os

shots_dir = r"D:\workbuddy\2026-07-22-20-29-18\ppt-project\IP动画分镜图_已加标识"
output = r"D:\workbuddy\2026-07-22-20-29-18\ppt-project\IP动画分镜脚本_2x3.png"

cell_w = 1200
cell_h = 1800
img_w = 1024
img_h = 1536
# 给图片上方镜号、下方文字留空间
scale = min((cell_w - 80) / img_w, (cell_h - 420) / img_h)
new_w = int(img_w * scale)
new_h = int(img_h * scale)

# 3 行 2 列，顶部加标题
canvas_w = cell_w * 2
canvas_h = cell_h * 3 + 160
canvas = Image.new("RGB", (canvas_w, canvas_h), (255, 252, 245))
draw = ImageDraw.Draw(canvas)

font_title = ImageFont.truetype(r"C:\Windows\Fonts\SIMYOU.TTF", 52)
font_header = ImageFont.truetype(r"C:\Windows\Fonts\SIMYOU.TTF", 40)
font_label = ImageFont.truetype(r"C:\Windows\Fonts\SIMYOU.TTF", 28)
font_text = ImageFont.truetype(r"C:\Windows\Fonts\SIMYOU.TTF", 26)

# 标题
title = "Happy赖 IP 动画 · 工作台4步法 · 分镜脚本"
draw.text((canvas_w // 2, 70), title, fill=(90, 65, 50), font=font_title, anchor="mm")

shots_info = [
    ("shot0.png", "镜 0 开头",
     ["画面：Happy赖 站在工作台前，介绍控制台",
      "画外音：朋友，不想露脸又想做视频？",
      "看看我的 Happy赖 工作台怎么搭~",
      "剪辑：整体从下方淡入"]),
    ("shot1.png", "镜 1 想清楚",
     ["画面：Happy赖 指着屏幕上的三个模块图标",
      "画外音：第一步，想清楚你要它干啥——",
      "每日计划、今日感恩、收藏句子，先列三个。",
      "剪辑：三个图标逐个亮起"]),
    ("shot2.png", "镜 2 说人话",
     ["画面：Happy赖 对着麦克风说话，屏幕有声波",
      "画外音：第二步，跟你的 AI 搭子说人话，",
      "它帮你生成，你一行代码都不用碰。",
      "剪辑：声波图做缩放动画"]),
    ("shot3.png", "镜 3 发上网",
     ["画面：Happy赖 按下红色发布按钮，纸飞机飞出",
      "画外音：第三步，一键发到网上，",
      "丢给你一个链接，手机点开就能用。",
      "剪辑：纸飞机从屏幕飞向右上方"]),
    ("shot4.png", "镜 4 装主屏",
     ["画面：Happy赖 把手机连到工作台，图标嵌入",
      "画外音：第四步，把链接加到手机主屏幕，",
      "离线也能用，跟个 APP 一样。",
      "剪辑：拼图图标做弹出动画"]),
    ("shot5.png", "镜 5 结尾",
     ["画面：Happy赖 站在完整工作台前比耶挥手",
      "画外音：从“我也想要”到每天用它，",
      "就一个下午。全网搜 Happy赖 就行。拜拜~",
      "剪辑：底部浮“全网搜 Happy赖”"]),
]

for idx, (filename, header, lines) in enumerate(shots_info):
    row = idx // 2
    col = idx % 2
    x = col * cell_w
    y = row * cell_h + 160  # 标题下方

    # 外框
    draw.rectangle([x + 10, y + 10, x + cell_w - 10, y + cell_h - 10], outline=(210, 195, 175), width=3)

    # 镜号标题背景条
    draw.rectangle([x + 10, y + 10, x + cell_w - 10, y + 80], fill=(250, 240, 225))
    draw.text((x + cell_w // 2, y + 45), header, fill=(120, 80, 60), font=font_header, anchor="mm")

    # 贴图
    img = Image.open(os.path.join(shots_dir, filename))
    img = img.resize((new_w, new_h), Image.LANCZOS)
    img_x = x + (cell_w - new_w) // 2
    img_y = y + 100
    canvas.paste(img, (img_x, img_y))

    # 文字说明
    text_y = img_y + new_h + 30
    margin = 40
    line_height = 42
    for line in lines:
        draw.text((x + margin, text_y), line, fill=(70, 60, 55), font=font_text)
        text_y += line_height

canvas.save(output, quality=95)
print(f"Saved: {output}")
