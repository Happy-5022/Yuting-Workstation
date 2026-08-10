import sys, os
base = r"C:\Users\happy\.workbuddy\binaries\python\envs\audio-probe\site-packages"
sys.path.insert(0, base)
from imageio_ffmpeg import get_ffmpeg_exe
import subprocess

exe = get_ffmpeg_exe()
inp = r"C:\Users\happy\Desktop\龙湾路 93.m4a"
out = r"D:\workbuddy\2026-07-22-20-29-18\voice-clone\yuting-sample.wav"
os.makedirs(os.path.dirname(out), exist_ok=True)

# 转单声道、44100Hz 的 wav（Fish Speech 推荐格式）
cmd = [exe, "-y", "-i", inp, "-ac", "1", "-ar", "44100", out]
r = subprocess.run(cmd, capture_output=True, text=True)
print("returncode:", r.returncode)
if r.returncode != 0:
    print("STDERR:", r.stderr[-800:])
else:
    sz = os.path.getsize(out)
    print("OK 输出:", out)
    print("大小:", sz, "bytes (", round(sz/1024/1024, 2), "MB )")
