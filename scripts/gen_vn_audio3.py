# 生成「vn-data.js 中尚未收录发音的新词」标准女声 mp3
# 嗓音 vi-VN-HoaiMyNeural（与旧音频一致），离线可用、国内可播。
#
# 用法：python scripts/gen_vn_audio3.py
# 结束后会写出 scripts/vn_new_map.js（要贴进 js/app.js 的 VN_AUDIO_MAP 的映射）。
import re, os, asyncio, sys

try:
    import edge_tts
except ImportError:
    sys.exit("请先安装 edge-tts：pip install edge_tts")

VOICE = "vi-VN-HoaiMyNeural"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "js", "vn-data.js")
APP = os.path.join(ROOT, "js", "app.js")
OUT = os.path.join(ROOT, "audio", "vn")
os.makedirs(OUT, exist_ok=True)

vn_src = open(SRC, encoding="utf-8").read()
app_src = open(APP, encoding="utf-8").read()

# 只抽取「单词级」vn（行首为 { vn: '...' 的对象，排除 ex 里的例句）
words = re.findall(r"^[ \t]*\{[ \t]*vn:[ \t]*'((?:[^'\\]|\\.)*)'", vn_src, re.M)
seen = set(); distinct = []
for w in words:
    if w not in seen:
        seen.add(w); distinct.append(w)

# 抽取 app.js 中 VN_AUDIO_MAP 已有 key（精确字符串匹配）
existing = set(re.findall(r"m\['([^']*)'\]", app_src))
existing |= set(re.findall(r'm\["([^"]*)"\]', app_src))

to_gen = [w for w in distinct if w not in existing]
print(f"vn-data 单词级词条 {len(distinct)}，对照表已有 {len(existing)} key，需新生成 {len(to_gen)}", flush=True)
for w in to_gen:
    print("  待生成:", repr(w), flush=True)


async def gen():
    mapping = {}
    for i, w in enumerate(to_gen, 1):
        key = "NW_%03d" % i
        fn = os.path.join(OUT, key + ".mp3")
        try:
            await edge_tts.Communicate(w, VOICE).save(fn)
            mapping[w] = key
            print(f"OK   {key}  {w}", flush=True)
        except Exception as e:
            print(f"FAIL {w} -> {e}", flush=True)
    with open(os.path.join(ROOT, "scripts", "vn_new_map.js"), "w", encoding="utf-8") as f:
        f.write("// 由 scripts/gen_vn_audio3.py 生成，复制到 js/app.js 的 VN_AUDIO_MAP（return m; 之前）\n")
        for w, k in mapping.items():
            key = w.replace("\\", "\\\\").replace("'", "\\'")
            f.write("      m['%s'] = '%s';\n" % (key, k))
    print("\n映射已写出到 scripts/vn_new_map.js，共 %d 条" % len(mapping), flush=True)


asyncio.run(gen())
