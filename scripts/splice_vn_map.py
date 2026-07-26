# 把 scripts/vn_new_map.js 的映射行插入 js/app.js 的 VN_AUDIO_MAP（return m; 之前）
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, "js", "app.js")
MAP = os.path.join(ROOT, "scripts", "vn_new_map.js")

app = open(APP, encoding="utf-8").read()
lines = open(MAP, encoding="utf-8").read().splitlines()
# 去掉注释行，只留 m['...'] = '...'; 行，并统一 6 空格缩进
block = "\n".join("      " + ln.strip() for ln in lines if ln.strip().startswith("m[")) + "\n"

marker = "      return m;"
assert marker in app, "未找到 VN_AUDIO_MAP 的 return m; 标记"
assert app.count(marker) == 1, "return m; 出现多次，需人工处理"

if "NW_001" in app:
    print("已经插入过，跳过（保持幂等）")
else:
    app = app.replace(marker, block + marker, 1)
    open(APP, "w", encoding="utf-8").write(app)
    print("已插入 %d 条映射" % block.count("m['"))
