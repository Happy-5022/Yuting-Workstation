# -*- coding: utf-8 -*-
"""
越南语预录音频生成脚本
使用 Microsoft Edge TTS（edge-tts）批量生成越南语 mp3 音频文件。
输出到 audio/vn/ 目录，供 vnSpeak() 离线播放。
用法: python scripts/gen_vn_audio.py
"""
import asyncio
import os
import sys
import re

# 确保项目根目录在 sys.path 中（脚本可从任何位置调用）
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
AUDIO_DIR = os.path.join(PROJECT_ROOT, 'audio', 'vn')

# ---- 所有需要生成音频的越南语文本 ----
ITEMS = []

# === 字母表（29 个字母，单独发音）===
VOWELS = [
    ('a', '啊'), ('ă', '啊短'), ('â', '呃短'),
    ('e', '唉'), ('ê', '诶'), ('i', '依'),
    ('o', '哦'), ('ô', '欧圆'), ('ơ', '饿平'),
    ('u', '乌'), ('ư', '淤扁'), ('y', '依长'),
]
CONSONANTS = [
    ('b', '波'), ('c', '哥'), ('d', '之南'), ('đ', '得浊'),
    ('g', '格'), ('h', '喝'), ('k', '哥'), ('l', '勒'),
    ('m', '摸'), ('n', '呢'), ('p', '波不送气'), ('q', '固'),
    ('r', '日热'), ('s', '思'), ('t', '德不送气'),
    ('v', '喂'), ('x', '思'),
]
for l, c in VOWELS:
    ITEMS.append(('L_' + l, l))  # 字母用 L_ 前缀
for l, c in CONSONANTS:
    ITEMS.append(('L_' + l, l))

# === 高频词汇（10 个）===
WORDS = [
    ('W_xinchao', 'Xin chào'),
    ('W_camon', 'Cảm ơn'),
    ('W_pho', 'Phở'),
    ('W_tambiet', 'Tạm biệt'),
    ('W_bankhoe', 'Bạn khỏe không?'),
    ('W_tenla', 'Tôi tên là…'),
    ('W_khong', 'Không'),
    ('W_co', 'Có'),
    ('W_baonhieu', 'Bao nhiêu?'),
    ('W_ngon', 'Ngon'),
]
ITEMS.extend(WORDS)

# === 常用句子（5 个）===
SENTENCES = [
    ('S_hello', 'Xin chào, tôi tên là Ngọc.'),
    ('S_learning', 'Tôi đang học tiếng Việt.'),
    ('S_daily', 'Một ngày một chút.'),
    ('S_thanks', 'Cảm ơn bạn rất nhiều.'),
    ('S_beautiful', 'Việt Nam rất đẹp.'),
]
ITEMS.extend(SENTENCES)

# === 声调演示（ma 家族 6 个）===
TONES = [
    ('T_ma_ngang', 'ma'),
    ('T_ma_huyen', 'mà'),
    ('T_ma_sac', 'má'),
    ('T_ma_hoi', 'mả'),
    ('T_ma_nga', 'mã'),
    ('T_ma_nang', 'mạ'),
]
ITEMS.extend(TONES)

# === 拼读示例（3 个）===
SPELL = [
    ('SP_pho', 'phở'),
    ('SP_cafe', 'cà phê'),
    ('SP_xinchao', 'xin chào'),
]
ITEMS.extend(SPELL)

# === 场景对话（4 场 × 4 句 = 16 个）===
SCENES = [
    # 点餐
    ('SC_order1', 'Cho tôi một bát phở.'),
    ('SC_order2', 'Không cay nhé.'),
    ('SC_order3', 'Ngon quá!'),
    ('SC_order4', 'Tính tiền.'),
    # 购物问价
    ('SC_shop1', 'Cái này bao nhiêu tiền?'),
    ('SC_shop2', 'Đắt quá!'),
    ('SC_shop3', 'Giảm giá được không?'),
    ('SC_shop4', 'Tôi mua cái này.'),
    # 问路
    ('SC_dir1', 'Nhà vệ sinh ở đâu?'),
    ('SC_dir2', 'Đi thẳng.'),
    ('SC_dir3', 'Rẽ trái.'),
    ('SC_dir4', 'Ở gần đây không?'),
    # 应急
    ('SC_emerg1', 'Cứu tôi với!'),
    ('SC_emerg2', 'Tôi bị lạc.'),
    ('SC_emerg3', 'Tôi cần bác sĩ.'),
    ('SC_emerg4', 'Bạn nói tiếng Anh không?'),
]
ITEMS.extend(SCENES)

# === 课程句子（5 课 × 约 4 句 = ~20 个）===
UNITS = [
    # 第 1 课：打招呼
    ('U1_1', 'Xin chào.'),
    ('U1_2', 'Bạn khỏe không?'),
    ('U1_3', 'Tôi khỏe, cảm ơn.'),
    ('U1_4', 'Tạm biệt!'),
    # 第 2 课：自我介绍
    ('U2_1', 'Tôi tên là Lan.'),
    ('U2_2', 'Rất vui được gặp bạn.'),
    ('U2_3', 'Tôi đến từ Trung Quốc.'),
    ('U2_4', 'Bạn làm nghề gì?'),
    # 第 3 课：数字
    ('U3_1', 'một, hai, ba'),
    ('U3_2', 'bốn, năm, sáu'),
    ('U3_3', 'bảy, tám, chín, mười'),
    ('U3_4', 'Tôi có hai con mèo.'),
    # 第 4 课：日常问答
    ('U4_1', 'Cái này bao nhiêu tiền?'),
    ('U4_2', 'Ngon quá!'),
    ('U4_3', 'Tôi không hiểu.'),
    ('U4_4', 'Bạn nói tiếng Trung không?'),
    # 第 5 课：常用短句（复用 SENTENCES）
    ('U5_1', 'Xin chào, tôi tên là Ngọc.'),
    ('U5_2', 'Tôi đang học tiếng Việt.'),
    ('U5_3', 'Một ngày một chút.'),
    ('U5_4', 'Cảm ơn bạn rất nhiều.'),
    ('U5_5', 'Việt Nam rất đẹp.'),
]
ITEMS.extend(UNITS)

# === 课程词汇（补充单词发音）===
UNIT_VOCAB = [
    ('V_khoe', 'khỏe'),
    ('V_camon_word', 'cảm ơn'),
    ('V_tambiet_word', 'tạm biệt'),
    ('V_ten', 'tên'),
    ('V_ratvui', 'rất vui'),
    ('V_dentu', 'đến từ'),
    ('V_nghề', 'nghề'),
    ('V_mot', 'một'),
    ('V_hai', 'hai'),
    ('V_nam', 'năm'),
    ('V_muoi', 'mười'),
    ('V_baonhieu_word', 'bao nhiêu'),
    ('V_tien', 'tiền'),
    ('V_ngon_word', 'ngon'),
    ('V_hieu', 'hiểu'),
]
ITEMS.extend(UNIT_VOCAB)


# === 自动为新增主题词生成 NX_ 音频 ===
# 逻辑与 app.js 中 VN_AUDIO_MAP 的自动映射保持一致：
# 遍历 vn-data.js 的全部主题词，跳过已在 app.js 映射表覆盖的文本，
# 为其余（新增）主题词按出现顺序分配 NX_001、NX_002……并生成 mp3。
def _load_covered_texts():
    """从 app.js 的 VN_AUDIO_MAP 提取所有已映射的越南语文本（m['...'] = '...'）"""
    try:
        _appjs = os.path.join(PROJECT_ROOT, 'js', 'app.js')
        with open(_appjs, encoding='utf-8') as _f:
            _src = _f.read()
        return set(m[0] for m in re.findall(r"m\['([^']*)'\]\s*=\s*'([^']*)'", _src))
    except Exception:
        return set()


def _load_topic_words():
    """从 vn-data.js 提取『主题词』的 vn 文本（按出现顺序，去重）。

    注意：必须剔除每个词的 ex 例句块（ex: { vn: '...' }），
    否则例句里的 vn 会被当成主题词一起分配 NX_ 序号，
    导致脚本生成的 NX_ 序号与网页 VN_AUDIO_MAP 的实际分配错位
    （表现为『点词听到别的词的发音』）。"""
    try:
        _vnd = os.path.join(PROJECT_ROOT, 'js', 'vn-data.js')
        with open(_vnd, encoding='utf-8') as _f:
            _src = _f.read()
        # 剔除所有 ex: { ... } 块（单层，不影响主题词 vn）
        _src = re.sub(r"ex:\s*\{[^}]*\}", "ex:{}", _src)
        _vns = re.findall(r"vn:\s*'([^']*)'", _src)
        # 保持顺序去重，模拟网页『同一 vn 只分配一个 NX_』的行为
        _seen = set(); _out = []
        for _v in _vns:
            if _v and _v not in _seen:
                _seen.add(_v); _out.append(_v)
        return _out
    except Exception:
        return []


_covered = _load_covered_texts()
_n = 1
for _vn in _load_topic_words():
    if _vn and _vn not in _covered:
        ITEMS.append(('NX_' + ('%03d' % _n), _vn))
        _n += 1


async def generate_one(edge, key, text, voice, output_dir):
    """生成单个音频文件"""
    out_path = os.path.join(output_dir, key + '.mp3')
    if os.path.exists(out_path) and os.path.getsize(out_path) > 100:
        print(f'  [跳过] {key} ({text}) — 已存在')
        return True
    try:
        communicate = edge.Communicate(text, voice)
        await communicate.save(out_path)
        size = os.path.getsize(out_path)
        print(f'  [OK] {key} ({text}) → {size} bytes')
        return True
    except Exception as e:
        print(f'  [失败] {key} ({text}) → {e}')
        return False


async def main():
    import edge_tts as edge

    os.makedirs(AUDIO_DIR, exist_ok=True)

    # 清理旧的 NX_ 音频：避免序号重排后旧的错误文件残留（会导致词音错位）
    import glob as _glob
    _old_nx = _glob.glob(os.path.join(AUDIO_DIR, 'NX_*.mp3'))
    for _of in _old_nx:
        try:
            os.remove(_of)
        except OSError:
            pass
    if _old_nx:
        print(f'已清理 {len(_old_nx)} 个旧的 NX_ 文件（防止错位残留）')

    # 使用微软越南语女声（自然神经网络嗓音）
    VOICE = 'vi-VN-HoaiMyNeural'

    print(f'越南语音频生成器')
    print(f'目标目录: {AUDIO_DIR}')
    print(f'嗓音: {VOICE}')
    print(f'共 {len(ITEMS)} 项待生成')
    print('---')

    ok = 0
    fail = 0
    for key, text in ITEMS:
        result = await generate_one(edge, key, text, VOICE, AUDIO_DIR)
        if result:
            ok += 1
        else:
            fail += 1

    print('---')
    print(f'完成！成功 {ok}，失败 {fail}，共 {len(ITEMS)} 项')
    print(f'音频文件在: {AUDIO_DIR}')

    # 删除测试文件
    test_file = os.path.join(AUDIO_DIR, 'test_xinchao.mp3')
    if os.path.exists(test_file):
        os.remove(test_file)
        print('已清理测试文件')


if __name__ == '__main__':
    asyncio.run(main())
