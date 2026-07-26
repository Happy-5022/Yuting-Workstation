# 生成「越南语生活高频词（vn-data.js 中的单词级新词）」的标准发音 mp3
# 使用微软 Edge TTS 免费接口，嗓音 vi-VN-HoaiMyNeural（与旧音频一致的标准女声）。
#
# 用法（在能联网的电脑上）：
#   pip install edge-tts
#   python scripts/gen_vn_audio2.py
#
# 生成的文件在 audio/vn/W_t001.mp3 ...
# 运行结束后，脚本会打印一段「MAP」代码，把它复制到 js/app.js 的 VN_AUDIO_MAP
# （在 `return m;` 之前）即可，无需改动任何播放逻辑。
import re, os, asyncio, sys

try:
    import edge_tts
except ImportError:
    sys.exit("请先安装 edge-tts：pip install edge_tts")

VOICE = "vi-VN-HoaiMyNeural"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "js", "vn-data.js")
OUT = os.path.join(ROOT, "audio", "vn")
os.makedirs(OUT, exist_ok=True)

src = open(SRC, encoding="utf-8").read()
# 抽取所有 vn: '...' 的值；过滤掉含空格的（例句/句子），只保留单词级新词
raw = re.findall(r"vn:\s*'((?:[^'\\]|\\.)*)'", src)
seen = set(); words = []
for w in raw:
    if w in seen:
        continue
    seen.add(w)
    if ' ' in w:        # 跳过例句等句子，只生成单词
        continue
    words.append(w)

print(f"共抽取 {len(words)} 个单词级新词，开始生成…", flush=True)

async def gen():
    for i, w in enumerate(words, 1):
        fn = os.path.join(OUT, f"W_t{i:03d}.mp3")
        if os.path.exists(fn):
            print(f"跳过 {fn} ({w})", flush=True); continue
        try:
            await edge_tts.Communicate(w, VOICE).save(fn)
            print(f"OK   {fn}  {w}", flush=True)
        except Exception as e:
            print(f"FAIL {w}  -> {e}", flush=True)

asyncio.run(gen())

print("\n===== 把下面这段复制到 js/app.js 的 VN_AUDIO_MAP（在 return m; 之前）=====\n")
for i, w in enumerate(words, 1):
    key = w.replace("\\", "\\\\").replace("'", "\\'")
    print(f"      m['{key}'] = 'W_t{i:03d}';")
print("\n===== 结束 =====")
