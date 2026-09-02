# -*- coding: utf-8 -*-
"""把「每日一言」的背景图压小：缩到最大边 900px，转 JPEG。
用法：python scripts/compress_quotes.py
生成 .jpg 后，记得把 js/app.js 里 QUOTE_BG_IMAGES 的 .png 改成 .jpg，确认无误再删旧 png。
"""
import os
from PIL import Image

SRC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'images', 'quotes')
MAX_EDGE = 900
QUALITY = 82


def main():
    if not os.path.isdir(SRC):
        print('找不到目录：', SRC)
        return
    total_old = 0
    total_new = 0
    for fn in sorted(os.listdir(SRC)):
        if not fn.lower().endswith('.png'):
            continue
        path = os.path.join(SRC, fn)
        im = Image.open(path)
        # JPEG 不支持透明，先铺白底
        if im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info):
            rgba = im.convert('RGBA')
            bg = Image.new('RGB', rgba.size, (255, 255, 255))
            bg.paste(rgba, mask=rgba.split()[-1])
            im = bg
        else:
            im = im.convert('RGB')
        w, h = im.size
        scale = MAX_EDGE / float(max(w, h))
        if scale < 1:
            im = im.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
        out = os.path.join(SRC, fn[:-4] + '.jpg')
        im.save(out, 'JPEG', quality=QUALITY, optimize=True)
        old = os.path.getsize(path)
        new = os.path.getsize(out)
        total_old += old
        total_new += new
        print('%s  %dx%d  %.0fKB -> %.0fKB' % (fn, im.size[0], im.size[1], old / 1024.0, new / 1024.0))
    print('---')
    print('合计 %.2fMB -> %.2fMB' % (total_old / 1048576.0, total_new / 1048576.0))


if __name__ == '__main__':
    main()
