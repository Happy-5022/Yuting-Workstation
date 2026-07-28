/* ===== Happy赖工作台 · 主程序 =====
   全程本地运行：数据存在这台设备的浏览器里，没网也能开、能记。 */
(function () {
  'use strict';

  // ---------- 小工具 ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function todayStr(mode) {
    const d = new Date();
    if (mode === 'cn') return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  const WK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  function topDate() { const d = new Date(); return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + WK[d.getDay()]; }
  // 按种子生成稳定随机数（同一天结果一致，隔天自动变）——用于离线兜底生成每日选题
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  // 越南国旗小图标（SVG，避免 Windows 把 🇻🇳 退化成 "VN" 文字）
  function vnFlag(cls) {
    return '<span class="' + (cls || 'vn-flag') + '" aria-label="越南">' +
      '<svg viewBox="0 0 30 20" width="30" height="20" style="display:block;border-radius:3px;vertical-align:middle">' +
      '<rect width="30" height="20" fill="#da251d"/>' +
      '<polygon points="15,4 17.3,11.2 24.7,11.2 18.6,15.5 20.9,22.6 15,17.3 9.1,22.6 11.4,15.5 5.3,11.2 12.7,11.2" fill="#ff0"/></svg></span>';
  }
  let toastTimer;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1800); }

  // ---------- 语音发音（智能挑选母语发音人） ----------
  // 浏览器自带的“念字”功能依赖设备已安装的语音包；不指定发音人时，
  // 可能用错嗓音（如用中文嗓音读英语/越南语），听起来就别扭。
  let VOICES = [];
  function loadVoices() { try { VOICES = (window.speechSynthesis && speechSynthesis.getVoices()) || []; } catch (e) { VOICES = []; } }
  if (window.speechSynthesis) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
  // 按语言挑最合适的 voice：先精确匹配（en-US / vi-VN），再同语种（en-* / vi-*）
  // 把 voice 的 lang 字段归一化：安卓常写成 vi_VN（下划线），统一成 vi-VN 才能匹配
  function normLang(s) { return (s || '').toLowerCase().replace(/[_]/g, '-'); }
  function pickVoice(lang) {
    if (!VOICES.length) return null;
    const want = normLang(lang), base = want.split('-')[0];
    let v = VOICES.find(x => normLang(x.lang) === want);
    if (!v && base) v = VOICES.find(x => normLang(x.lang).indexOf(base + '-') === 0);
    if (!v && base) v = VOICES.find(x => normLang(x.lang) === base); // 兼容只有 'vi' 的情况
    return v || null;
  }
  // 朗读发音人偏好（按设备存，用户可在模块里手动挑最喜欢的嗓音）
  function getVoicePref(lang) { try { return localStorage.getItem('voicePref_' + lang) || ''; } catch (e) { return ''; } }
  function setVoicePref(lang, name) { try { localStorage.setItem('voicePref_' + lang, name || ''); } catch (e) {} }

  // 通用朗读：默认【不绑 voice、只设语言标签】，交给 iOS/系统用该语言自带的母语嗓音
  // （中文 iPhone 上显式绑 getVoices() 里的嗓音反而会让越南语逐字母念、英语变机械音）；
  // 仅当用户在发音人选择器里手动挑过、且该嗓音确实属于目标语言时，才优先用其选择。
  function speakLang(text, lang, opts) {
    opts = opts || {};
    const synth = window.speechSynthesis;
    if (!synth || !text) return false;
    const base = normLang(lang).split('-')[0];
    const doSpeak = () => {
      try { synth.resume(); } catch (e) {}
      if (!opts.noCancel) { try { synth.cancel(); } catch (e) {} } // 顺序连读时由调用方负责不中断上一段
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      let v = null;
      const pref = (opts.voiceName != null) ? opts.voiceName : getVoicePref(lang);
      if (pref) {
        const found = VOICES.find(x => x.name === pref);
        // 只有当该发音人确实属于目标语言时（如都是 vi）才用其选择；否则视为脏记忆，清除
        if (found && normLang(found.lang).split('-')[0] === base) v = found;
        else if (found) setVoicePref(lang, ''); // 清掉错语言的脏记忆（例如英语嗓音被记到了越南语）
      }
      // 关键修复：默认（用户没手动挑过嗓音）绝不显式绑 voice，
      // 只设语言标签，交给 iOS/系统用该语言自带的母语嗓音。
      // 显式绑 getVoices() 里的嗓音在中文 iPhone 上会让越南语被当成字母逐字念、英语变机械音。
      // 仅当用户在发音人选择器里手动挑过、且该嗓音确实属于目标语言时，上面才会把 v 设上并绑。
      if (v) { u.voice = v; try { u.lang = normLang(v.lang) || lang; } catch (e) {} }
      u.rate = (opts.rate != null ? opts.rate : 1);
      u.pitch = (opts.pitch != null ? opts.pitch : 1);
      if (opts.onend) u.onend = opts.onend;
      try { synth.speak(u); } catch (e) {}
    };
    // 语音列表异步加载：列表没就绪前不急着出声，等加载完再读，避免先以错误嗓音念出来
    if (!VOICES.length) {
      loadVoices();
      if (!VOICES.length) {
        let waited = 0;
        const wait = setInterval(() => {
          waited += 100;
          if (VOICES.length || waited >= 3000) { clearInterval(wait); doSpeak(); }
        }, 100);
        return true;
      }
    }
    doSpeak();
    return true;
  }

  // 在模块里渲染"发音人"下拉选择器（让用户自己挑最顺耳的嗓音）
  function renderVoicePicker(lang, mountEl, label) {
    if (!window.speechSynthesis || !mountEl) return;
    const base = normLang(lang).split('-')[0];
    let tries = 0;
    const build = () => {
      if (!mountEl.isConnected) return;
      if (!VOICES.length) {
        if (tries++ < 25) { setTimeout(build, 300); return; } // 最多等约 7.5 秒，覆盖 iOS 语音列表异步加载慢的情况
      }
      const list = VOICES.filter(v => { const l = normLang(v.lang); return l.indexOf(base + '-') === 0 || l === base; });
      // 关键：先清除"错语言/失效"的脏记忆（例如英语嗓音名被记到越南语），否则它会污染朗读。
      // 即使本机 getVoices 不返回该语言 voice（list 为空）也照样执行清除与渲染，不再提前 return 导致下拉和"恢复默认"按钮消失。
      let pref = getVoicePref(lang);
      if (pref) {
        const found = VOICES.find(x => x.name === pref);
        if (!found || normLang(found.lang).split('-')[0] !== base) { setVoicePref(lang, ''); pref = ''; }
      }
      mountEl.innerHTML = '';
      const sel = document.createElement('select'); sel.className = 'voice-sel';
      const auto = document.createElement('option'); auto.value = ''; auto.textContent = '自动（推荐）'; sel.append(auto);
      list.forEach(v => { const o = document.createElement('option'); o.value = v.name; o.textContent = v.name + (v.lang ? ' (' + v.lang + ')' : ''); sel.append(o); });
      try { sel.value = pref || ''; } catch (e) {}
      sel.onchange = () => setVoicePref(lang, sel.value);
      const wrap = document.createElement('div'); wrap.className = 'voice-pick';
      const lab = document.createElement('span'); lab.className = 'voice-pick-label'; lab.textContent = label;
      const reset = document.createElement('button'); reset.className = 'voice-reset'; reset.textContent = '↺ 恢复默认';
      reset.onclick = () => { setVoicePref(lang, ''); try { sel.value = ''; } catch (e) {} toast('已恢复系统默认发音'); };
      wrap.append(lab); wrap.append(sel); wrap.append(reset);
      mountEl.append(wrap);
    };
    build();
    // 语音列表异步就绪后再触发一次渲染（包住原有的 onvoiceschanged，避免覆盖 loadVoices）
    const onReady = () => { if (mountEl.isConnected) build(); };
    if (window.speechSynthesis) {
      const prev = window.speechSynthesis.onvoiceschanged;
      window.speechSynthesis.onvoiceschanged = (e) => { try { prev && prev(e); } catch (_) {} onReady(); };
    }
  }
  function voiceReady(lang) { return !!pickVoice(lang); }
  const voiceWarned = {};
  function warnVoiceOnce(lang, msg) {
    if (voiceWarned[lang] || voiceReady(lang)) return;
    voiceWarned[lang] = true; toast(msg);
  }

  // 底部弹窗表单，返回填写的对象或 null（取消）
  function promptForm(title, fields) {
    return new Promise((resolve) => {
      const mask = el('<div class="modal-mask"><div class="modal"><h3></h3></div></div>');
      mask.querySelector('h3').textContent = title;
      const form = el('<div></div>');
      fields.forEach(f => {
        const wrap = el('<div class="field"></div>');
        const label = el('<label></label>'); label.textContent = f.label || '';
        let input;
        if (f.type === 'textarea') { input = el('<textarea></textarea>'); }
        else if (f.type === 'select') {
          input = el('<select></select>');
          (f.options || []).forEach(o => { const op = el('<option></option>'); op.value = o.value; op.textContent = o.label; input.append(op); });
        } else { input = el('<input />'); input.type = f.type || 'text'; }
        if (f.placeholder) input.placeholder = f.placeholder;
        if (f.value != null) input.value = f.value;
        input.dataset.name = f.name;
        wrap.append(label, input); form.append(wrap);
      });
      const actions = el('<div class="modal-actions"></div>');
      const cancel = el('<button class="btn ghost grow">取消</button>');
      const ok = el('<button class="btn grow">保存</button>');
      actions.append(cancel, ok);
      mask.querySelector('.modal').append(form, actions);
      document.body.append(mask);
      requestAnimationFrame(() => mask.classList.add('show'));
      function close() { mask.classList.remove('show'); setTimeout(() => mask.remove(), 250); }
      cancel.onclick = () => { close(); resolve(null); };
      mask.onclick = (e) => { if (e.target === mask) { close(); resolve(null); } };
      ok.onclick = () => {
        const out = {};
        fields.forEach(f => { out[f.name] = form.querySelector('[data-name="' + f.name + '"]').value.trim(); });
        close(); resolve(out);
      };
    });
  }

  function confirmDel(text) {
    return new Promise((resolve) => {
      const mask = el('<div class="modal-mask"><div class="modal"><h3>确定要删除吗？</h3><p class="muted"></p></div></div>');
      mask.querySelector('p').textContent = text || '';
      const actions = el('<div class="modal-actions"></div>');
      const cancel = el('<button class="btn ghost grow">取消</button>');
      const ok = el('<button class="btn danger grow">删除</button>');
      actions.append(cancel, ok); mask.querySelector('.modal').append(actions);
      document.body.append(mask);
      requestAnimationFrame(() => mask.classList.add('show'));
      function close() { mask.classList.remove('show'); setTimeout(() => mask.remove(), 250); }
      cancel.onclick = () => { close(); resolve(false); };
      ok.onclick = () => { close(); resolve(true); };
    });
  }

  function openLink(url) { window.open(url, '_blank'); }

  // 连续打卡天数
  function streak(dates) {
    const set = new Set(dates);
    const key = (x) => x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate());
    let cur = new Date();
    if (!set.has(key(cur))) { cur.setDate(cur.getDate() - 1); if (!set.has(key(cur))) return 0; }
    let s = 0;
    while (set.has(key(cur))) { s++; cur.setDate(cur.getDate() - 1); }
    return s;
  }
  function distinctDays(dates) { return new Set(dates).size; }

  function emptyTip(emoji, text) {
    return '<div class="empty"><div class="big">' + emoji + '</div><div>' + esc(text) + '</div></div>';
  }

  // ---------- 素材库 ----------
  const IDEAS_BANK = [
    '普通人也能上手的3个副业，第三个我做了半年',
    '我把学校倒闭的经历写成故事，意外涨粉',
    '失业第N天：今天我做了什么',
    '高职老师转行，最难的不是没工作是有点慌',
    '越南语自学100天，我的真实进度',
    '每天15分钟尤克里里，一个月能弹什么',
    '古法健身操跟练30天，体态变化记录',
    '内容创作者的日常：选题比写更累',
    '一条爆款背后的3个笨功夫',
    '新手做公众号，最容易踩的5个坑',
    '我用备忘录攒了800条灵感，方法公开',
    '英语教学短视频，怎么拍才不像上课',
    '把失败讲成段子，反而更有人看',
    '一个人就是一支队伍：副业时间管理',
    '复盘一条数据差的内容，我学到什么',
    '今天的灵感只值一句话，但很真',
    '给三年前的自己写封信（短视频脚本）',
    '学会一样新东西，最爽的是哪个瞬间',
    '用手机就能拍的3个运镜小技巧',
    '越南语里最好玩的一个词',
    '尤克里里弹错和弦，也能很好听',
    '健身操跟练时，我在想什么',
    '把日常写成清单，治愈焦虑',
    '普通人做内容的长期主义',
  ];

  const UKE_STAGES = [
    {
      t: '第1阶段 · 认识与空弦',
      d: '认识四根弦、学会调音、持琴姿势，掌握 C / Am / F / G 四个基础和弦',
      skills: [
        { title: '认识乐器 & 调音', desc: '认识四根弦（GCEA）、学会用调音器调到标准音', goal: '能独立把四弦调准', pass: '四弦音准达标' },
        { title: '夹琴 & 持琴姿势', desc: '右臂夹琴、左手扶琴颈、拇指拨弦姿势', goal: '姿势稳定不累', pass: '连续拨弦 10 下不歪' },
        { title: '空弦热身', desc: '每弦全弓 ×10，开手、找音色', goal: '音色均匀', pass: '四弦音色一致' },
        { title: 'C / Am / F / G 和弦', desc: '四个基础和弦指法，逐个按响不闷音', goal: '四个和弦都能按响', pass: '转换不卡顿' },
      ],
      daily: [
        { text: '空弦热身（每弦全弓×10）', min: 5, note: '开手、找音色' },
        { text: '认识乐器 & 调音', min: 5, note: '调到标准音' },
        { text: '夹琴 & 持琴姿势', min: 5, note: '找稳定舒适的姿势' },
        { text: 'C / Am / F / G 和弦', min: 10, note: '逐个按响，注意不闷音' },
      ],
    },
    {
      t: '第2阶段 · 扫弦节奏',
      d: '掌握上下扫弦与常用节奏型，能跟弹简单歌曲',
      skills: [
        { title: '上下扫弦', desc: '手腕放松，下扫全弦、上扫轻触', goal: '节奏稳定', pass: '连续扫 30 秒不断' },
        { title: '常用节奏型', desc: '下下上下上（↓ ↓↑ ↓↑），配合节拍器', goal: '节奏型熟练', pass: '跟 80 BPM 不卡' },
        { title: '跟弹《小星星》', desc: '用 C/F/G7 三个和弦跟弹全曲', goal: '完整弹完', pass: '不中断弹完' },
      ],
      daily: [
        { text: '上下扫弦练习 ×10 遍', min: 5, note: '手腕放松找惯性' },
        { text: '节奏型（↓ ↓↑ ↓↑）跟节拍器', min: 8, note: '80 BPM 起步' },
        { text: '跟弹《小星星》', min: 7, note: 'C/F/G7 三和弦' },
      ],
    },
    {
      t: '第3阶段 · 转换与弹唱',
      d: '和弦快速切换，独立完成第一首完整弹唱',
      skills: [
        { title: '和弦快速切换', desc: 'C-Am-F-G 之间无停顿切换', goal: '切换流畅', pass: '每切换 < 1 秒' },
        { title: '弹唱《You Are My Sunshine》', desc: '边扫弦边唱，节奏对齐', goal: '弹唱同步', pass: '完整唱完不脱节' },
        { title: '节拍器配合', desc: '扫弦与演唱都踩在拍点上', goal: '人琴合一', pass: '跟 90 BPM 稳定' },
      ],
      daily: [
        { text: '和弦转换练习（C-Am-F-G）', min: 8, note: '追求无停顿' },
        { text: '弹唱《You Are My Sunshine》', min: 7, note: '边扫边唱' },
        { text: '节拍器配合练习', min: 5, note: '90 BPM' },
      ],
    },
    {
      t: '第4阶段 · 指弹入门',
      d: '学习简单指弹 pattern，如 5323 1323',
      skills: [
        { title: '5323 / 1323 pattern', desc: '拇指弹 5/3 弦、食指中指弹 2/1 弦', goal: 'pattern 稳定', pass: '连续弹 1 分钟不断' },
        { title: '指弹《欢乐颂》', desc: '用指弹 pattern 演奏主旋律', goal: '旋律清晰', pass: '完整弹完' },
        { title: '左右手协调', desc: '左手按和弦、右手固定 pattern', goal: '互不干扰', pass: '慢速流畅' },
      ],
      daily: [
        { text: '5323 / 1323 pattern 练习', min: 8, note: '先慢后快' },
        { text: '指弹《欢乐颂》', min: 7, note: '旋律清晰' },
        { text: '左右手协调练习', min: 5, note: '慢速对齐' },
      ],
    },
    {
      t: '第5阶段 · 风格与创作',
      d: '尝试不同曲风，给自己写的歌配 Ukulele',
      skills: [
        { title: '不同曲风尝试', desc: 'fingerstyle / picking / 切音 等风格', goal: '能切换风格', pass: '每种弹一段' },
        { title: '给原创配和弦', desc: '用自己的歌找合适和弦进行', goal: '配出副歌', pass: '能弹唱一段' },
        { title: '录制 & 发布', desc: '录一段完整表演，发到平台', goal: '完成作品', pass: '发布 1 条' },
      ],
      daily: [
        { text: '曲风练习（fingerstyle / 切音）', min: 8, note: '找喜欢的味道' },
        { text: '给原创歌曲配和弦', min: 7, note: '写一段副歌进行' },
        { text: '录制一段表演', min: 5, note: '完整不中断' },
      ],
    },
  ];

  // BBC 随身英语文章库（正文用浏览器语音合成朗读，无需外部音频）
  const EN_ARTICLES = [
    {
      id: 'a1', en: 'The Joy of Slow Living', zh: '慢生活的乐趣',
      words: 260, dur: 150, vocab: 28,
      body: [
        ['Modern life moves fast. We rush from one task to the next, rarely pausing to breathe.', '现代生活节奏很快。我们从一个任务冲向下一个，很少停下来喘口气。'],
        ['Slow living is not about doing nothing. It is about choosing what truly matters.', '慢生活不是什么都不做，而是去选择真正重要的事。'],
        ['When we slow down, we notice small joys: a warm cup of tea, a quiet morning, a friend’s laugh.', '当我们慢下来，会注意到微小的快乐：一杯热茶、一个安静的清晨、朋友的笑声。'],
      ],
      tips: [['slow living', '慢生活'], ['rarely', '很少'], ['truly matters', '真正重要']],
    },
    {
      id: 'a2', en: 'Why a Daily Walk Helps You Think', zh: '为什么每天散步有助于思考',
      words: 240, dur: 135, vocab: 25,
      body: [
        ['A short walk can clear a busy mind better than sitting still for an hour.', '比起静坐一小时，短短一段散步更能理清纷乱的思绪。'],
        ['Movement sends more blood to the brain, which helps new ideas appear.', '运动让更多血液流向大脑，从而催生新的想法。'],
        ['Many writers and scientists say their best thoughts come while walking.', '许多作家和科学家都说，他们最好的点子是在散步时冒出来的。'],
      ],
      tips: [['clear a busy mind', '理清纷乱的思绪'], ['blood to the brain', '血液流向大脑'], ['best thoughts', '最好的点子']],
    },
    {
      id: 'a3', en: 'The Power of Small Daily Habits', zh: '微小日常习惯的力量',
      words: 230, dur: 130, vocab: 24,
      body: [
        ['Big changes rarely happen overnight. They grow from tiny habits repeated every day.', '巨大的改变很少一夜发生，它们来自每天重复的小习惯。'],
        ['Reading ten pages or practising five minutes may seem small, but they add up.', '读十页书或练习五分钟也许很小，但会累积成力量。'],
        ['Consistency, not perfection, is the secret to lasting progress.', '持续而非完美，才是持久进步的秘诀。'],
      ],
      tips: [['overnight', '一夜之间'], ['add up', '累积'], ['consistency', '持续性']],
    },
    {
      id: 'a4', en: 'It Is Never Too Late to Learn a Language', zh: '学语言永远不嫌晚',
      words: 250, dur: 140, vocab: 27,
      body: [
        ['Many adults believe they are too old to learn a new language. This is not true.', '许多成年人认为自己年纪太大，学不会新语言。其实并非如此。'],
        ['The brain stays able to learn throughout life. Daily practice builds new paths.', '大脑终其一生都保有学习能力，每日练习会建立新的神经通路。'],
        ['Start with ten minutes a day. Speak aloud, make mistakes, and enjoy the journey.', '从每天十分钟开始。大声说、不怕犯错，享受这个过程。'],
      ],
      tips: [['too old', '太老'], ['throughout life', '终其一生'], ['new paths', '新的通路']],
    },
    {
      id: 'a5', en: 'How Music Shapes Our Mood', zh: '音乐如何塑造我们的心情',
      words: 245, dur: 138, vocab: 26,
      body: [
        ['A happy song can lift our spirits in seconds, while a slow tune helps us rest.', '一首欢快的歌能在几秒内提振心情，而舒缓的曲调有助我们休息。'],
        ['Music speaks where words fail, connecting people across languages and cultures.', '在言语力所不及之处，音乐替我们表达，把不同语言与文化的人连接起来。'],
        ['Learning an instrument adds a new joy: you become part of the music yourself.', '学习一种乐器会带来新的快乐：你自己也成了音乐的一部分。'],
      ],
      tips: [['lift our spirits', '提振心情'], ['where words fail', '言语力所不及之处'], ['connecting people', '把人连接起来']],
    },
  ];
  const EN_SENTENCES = [
    { en: 'Practice makes perfect.', zh: '熟能生巧。' },
    { en: 'Could you say that again, please?', zh: '能请您再说一遍吗？' },
    { en: 'I learn a little bit every single day.', zh: '我每天都会学一点点。' },
    { en: 'Shadowing helps with pronunciation.', zh: '影子跟读对发音很有帮助。' },
    { en: 'Consistency is more important than intensity.', zh: '坚持比强度更重要。' },
    { en: 'Mistakes are part of learning.', zh: '犯错是学习的一部分。' },
  ];
  const VN_SENTENCES = [
    { vn: 'Xin chào, tôi tên là Ngọc.', zh: '你好，我叫玉。' },
    { vn: 'Tôi đang học tiếng Việt.', zh: '我正在学越南语。' },
    { vn: 'Một ngày một chút.', zh: '一天一点点。' },
    { vn: 'Cảm ơn bạn rất nhiều.', zh: '非常感谢你。' },
    { vn: 'Việt Nam rất đẹp.', zh: '越南很美。' },
  ];
  // 越南语 6 声调（用 ma 家族演示：同拼写换声调=不同词）
  const VN_TONES = [
    { name: 'Ngang', cn: '平声', sym: '（无符号）', word: 'ma', zh: '鬼 / 母亲', note: '中平调，平稳' },
    { name: 'Huyền', cn: '玄声', sym: '` 重音符', word: 'mà', zh: '但是 / 那', note: '低降调，往下走' },
    { name: 'Sắc', cn: '锐声', sym: '´ 锐音符', word: 'má', zh: '妈妈 / 脸颊', note: '高升调，往上扬' },
    { name: 'Hỏi', cn: '问声', sym: '? 钩号', word: 'mả', zh: '坟墓', note: '降升调，先降后升' },
    { name: 'Ngã', cn: '跌声', sym: '~ 波浪号', word: 'mã', zh: '马 / 码', note: '重升调，带顿挫' },
    { name: 'Nặng', cn: '重声', sym: '. 下点', word: 'mạ', zh: '秧苗', note: '低促调，短而顿' },
  ];
  // 5 阶段自学进阶路线（新手 → 实战）
  const VN_STAGES = [
    { t: '字母与发音', d: '29 个字母 + 6 个特殊字母，点着听、跟着读', goal: '看到字母能读出音' },
    { t: '声调与拼读', d: '6 个声调听感 + 声母韵母拼成字', goal: '同一拼写换声调能听出区别，会拼简单的字' },
    { t: '高频词汇', d: '必背词 + 每日单词滚动积累', goal: '闪卡自测 10 个词全对' },
    { t: '句型与场景对话', d: '5 课基础课文 + 点餐/购物/问路/应急短句', goal: '常用场景能开口说整句' },
    { t: '自由表达 & 旅行实战', d: '连句成段、慢速听力、每日闯关保持手感', goal: '去越南能自己搞定吃喝住行' },
  ];
  // 越南语特有字母（中文近似音）
  const VN_SPECIAL = [
    { l: 'ă', c: '阿（短促）', note: 'a 的短音版，比 a 更短更快' },
    { l: 'ơ', c: '饿（平）', note: '卷舌平音，发音位置靠后' },
    { l: 'ư', c: '淤（扁）', note: '像汉语“鱼”的韵母，嘴扁' },
    { l: 'đ', c: '得（浊）', note: '唯一带横杠的字母，发 d 的音' },
    { l: 'ê', c: '诶（长）', note: 'e 的长音版，嘴更开' },
    { l: 'ô', c: '欧（圆）', note: 'o 的圆唇长音，嘴唇收圆' },
  ];
  // 今日 10 个必背词
  const VN_WORDS = [
    { vn: 'Xin chào', zh: '你好' },
    { vn: 'Cảm ơn', zh: '谢谢' },
    { vn: 'Phở', zh: '河粉' },
    { vn: 'Tạm biệt', zh: '再见' },
    { vn: 'Bạn khỏe không?', zh: '你好吗？' },
    { vn: 'Tôi tên là…', zh: '我叫……' },
    { vn: 'Không', zh: '不 / 没有' },
    { vn: 'Có', zh: '有 / 是' },
    { vn: 'Bao nhiêu?', zh: '多少钱？' },
    { vn: 'Ngon', zh: '好吃' },
  ];
  // 生活高频词（按主题分组，已扩充到约 380 词，覆盖吃喝/交通/购物/应急等 20 个场景）
  const VN_WORDS_ALL = VN_WORDS.slice();
  const VN_EX_MAP = {};
  const _seenVn = {};
  (typeof VN_TOPIC_WORDS !== 'undefined' ? VN_TOPIC_WORDS : []).forEach(t => (t.words || []).forEach(w => {
    if (w && w.vn && !_seenVn[w.vn]) { _seenVn[w.vn] = 1; VN_WORDS_ALL.push({ vn: w.vn, zh: w.zh }); }
    if (w && w.vn && w.ex) VN_EX_MAP[w.vn] = w.ex;
  }));
  // 零基础上路引导（3 步 + 第一周计划）
  const VN_START = {
    steps: [
      { icon: '①', t: '先认字母', d: '越南语用的是拉丁字母（和英文像），先把 29 个字母的样子和发音过一遍。' },
      { icon: '②', t: '再练声调', d: '这是越南语的灵魂：同一个拼写，换个声调就是另一个词。把 6 个声调听熟。' },
      { icon: '③', t: '背词 + 跟读', d: '每天背几个高频词，跟着句子读出声，慢慢就能开口。' },
    ],
    week: [
      { d: 'Day 1-2', t: '过一遍完整字母表，重点记 6 个特殊字母' },
      { d: 'Day 3-4', t: '死磕 6 个声调，用「ma」家族反复听、跟读' },
      { d: 'Day 5', t: '背下 10 个必背词，用闪卡自测' },
      { d: 'Day 6', t: '学「打招呼 + 自我介绍」两课，开口跟读' },
      { d: 'Day 7', t: '复习一周内容 + 学几句实用场景短句' },
    ],
  };
  // 完整字母表（29 个：12 元音 + 17 辅音）
  const VN_VOWELS = [
    { l: 'a', c: '啊' }, { l: 'ă', c: '啊（短促）' }, { l: 'â', c: '呃（短）' },
    { l: 'e', c: '唉（嘴开）' }, { l: 'ê', c: '诶（嘴闭）' }, { l: 'i', c: '依' },
    { l: 'o', c: '哦（嘴开）' }, { l: 'ô', c: '欧（圆唇）' }, { l: 'ơ', c: '饿（平）' },
    { l: 'u', c: '乌' }, { l: 'ư', c: '淤（嘴扁）' }, { l: 'y', c: '依（长）' },
  ];
  const VN_CONSONANTS = [
    { l: 'b', c: '波' }, { l: 'c', c: '哥（g/k音）' }, { l: 'd', c: '之（南音y）' },
    { l: 'đ', c: '得（浊，带横杠）' }, { l: 'g', c: '格' }, { l: 'h', c: '喝' },
    { l: 'k', c: '哥' }, { l: 'l', c: '勒' }, { l: 'm', c: '摸' },
    { l: 'n', c: '呢' }, { l: 'p', c: '波（不送气）' }, { l: 'q', c: '固（配u）' },
    { l: 'r', c: '日/热' }, { l: 's', c: '思' }, { l: 't', c: '德（不送气）' },
    { l: 'v', c: '喂' }, { l: 'x', c: '思（=s）' },
  ];
  // 拼读小课堂：声母 + 韵母 + 声调 = 一个字
  const VN_SPELL = [
    { parts: ['ph', 'ơ', '声调 ˀ'], word: 'phở', zh: '河粉', note: 'ph 发「f」音 + ơ（饿）+ 问声 → phở' },
    { parts: ['c', 'à', ''], word: 'cà phê', zh: '咖啡', note: 'c 发「g/k」+ à（玄声，往下降）→ cà，连读 cà phê' },
    { parts: ['x', 'in', ''], word: 'xin chào', zh: '你好', note: 'x 发「s」+ in → xin，配 chào 就是问好' },
    { parts: ['b', 'a', '玄声'], word: 'ba', zh: '三 / 爸', note: 'b（波）+ a + 玄声（往下降）→ ba' },
    { parts: ['m', 'i', '玄声'], word: 'mì', zh: '面', note: 'm（摸）+ i（依）+ 玄声 → mì' },
    { parts: ['t', 'ư', '玄声'], word: 'tư', zh: '思 / 私', note: 't（德）+ ư（扁）+ 玄声 → tư' },
    { parts: ['n', 'o', '锐声'], word: 'no', zh: '不 / 否', note: 'n（呢）+ o（哦）+ 锐声（上扬）→ no' },
    { parts: ['h', 'ỏ', '问声'], word: 'hỏ', zh: '坏 / 问', note: 'h（喝）+ ỏ（问声，先降后升）→ hỏ' },
    { parts: ['đ', 'i', '平声'], word: 'đi', zh: '去', note: 'đ（得，带横杠）+ i（依）+ 平声 → đi' },
    { parts: ['v', 'ũ', '跌声'], word: 'vũ', zh: '武 / 雨', note: 'v（喂）+ ũ（u 跌声）+ 跌声 → vũ' },
  ];
  // 实用场景短句（去越南直接能用）
  const VN_SCENES = [
    { icon: '🍜', name: '点餐', items: [
      ['Cho tôi một bát phở.', '给我一碗河粉。'],
      ['Không cay nhé.', '不要辣。'],
      ['Ngon quá!', '太好吃了！'],
      ['Tính tiền.', '买单。'],
    ]},
    { icon: '🛍️', name: '购物问价', items: [
      ['Cái này bao nhiêu tiền?', '这个多少钱？'],
      ['Đắt quá!', '太贵了！'],
      ['Giảm giá được không?', '能便宜点吗？'],
      ['Tôi mua cái này.', '我买这个。'],
    ]},
    { icon: '🧭', name: '问路', items: [
      ['Nhà vệ sinh ở đâu?', '厕所在哪里？'],
      ['Đi thẳng.', '往前直走。'],
      ['Rẽ trái / rẽ phải.', '左转 / 右转。'],
      ['Ở gần đây không?', '在这附近吗？'],
    ]},
    { icon: '🆘', name: '应急', items: [
      ['Cứu tôi với!', '救命！'],
      ['Tôi bị lạc.', '我迷路了。'],
      ['Tôi cần bác sĩ.', '我需要医生。'],
      ['Bạn nói tiếng Anh không?', '你会说英语吗？'],
    ]},
  ];
  // 推荐资源（均用国内平台，避免 Google / YouTube 等境外站点打不开）
  const VN_RES = [
    { t: '📘 教材：《越南语基础教程》等入门书', url: 'https://search.jd.com/Search?keyword=' + encodeURIComponent('越南语 入门 教材') },
    { t: '📺 B站：越南语零基础入门', url: 'https://search.bilibili.com/all?keyword=' + encodeURIComponent('越南语 零基础 入门 教程') },
    { t: '🎵 喜马拉雅：越南语听力慢速', url: 'https://www.ximalaya.com/search?q=' + encodeURIComponent('越南语 听力 慢速') },
    { t: '📕 小红书：教材 & 经验帖', url: 'https://www.xiaohongshu.com/search_result?keyword=' + encodeURIComponent('越南语 自学 教材 推荐') },
    { t: '▶ 抖音：越南语跟练短视频', url: 'https://www.douyin.com/search/' + encodeURIComponent('越南语 跟练 入门') },
  ];
  // 新手自学课程（每课：标题 + 双语句 + 词汇）
  const VN_UNITS = [
    {
      t: 'Chào hỏi', zh: '打招呼',
      sentences: [
        ['Xin chào.', '你好。'],
        ['Bạn khỏe không?', '你好吗？'],
        ['Tôi khỏe, cảm ơn.', '我很好，谢谢。'],
        ['Tạm biệt!', '再见！'],
      ],
      vocab: [['Xin chào', '你好'], ['khỏe', '健康 / 好'], ['cảm ơn', '谢谢'], ['tạm biệt', '再见']],
    },
    {
      t: 'Tự giới thiệu', zh: '自我介绍',
      sentences: [
        ['Tôi tên là Lan.', '我叫兰。'],
        ['Rất vui được gặp bạn.', '很高兴认识你。'],
        ['Tôi đến từ Trung Quốc.', '我来自中国。'],
        ['Bạn làm nghề gì?', '你做什么工作？'],
      ],
      vocab: [['tên', '名字'], ['rất vui', '很高兴'], ['đến từ', '来自'], ['nghề', '职业']],
    },
    {
      t: 'Số đếm 1-10', zh: '数字 1-10',
      sentences: [
        ['một, hai, ba', '一、二、三'],
        ['bốn, năm, sáu', '四、五、六'],
        ['bảy, tám, chín, mười', '七、八、九、十'],
        ['Tôi có hai con mèo.', '我有两只猫。'],
      ],
      vocab: [['một', '一'], ['hai', '二'], ['năm', '五'], ['mười', '十']],
    },
    {
      t: 'Hỏi đáp hàng ngày', zh: '日常问答',
      sentences: [
        ['Cái này bao nhiêu tiền?', '这个多少钱？'],
        ['Ngon quá!', '太好吃了！'],
        ['Tôi không hiểu.', '我不懂。'],
        ['Bạn nói tiếng Trung không?', '你会说中文吗？'],
      ],
      vocab: [['bao nhiêu', '多少'], ['tiền', '钱'], ['ngon', '好吃'], ['hiểu', '懂']],
    },
    {
      t: 'Câu thường dùng', zh: '常用短句',
      sentences: VN_SENTENCES.map(s => [s.vn, s.zh]),
      vocab: [],
    },
  ];

  // 每日一言（适合副业 / 学习 / 生活）
  const QUOTES = [
    { t: '种一棵树最好的时间是十年前，其次是现在。', a: '谚语', c: '成长' },
    { t: '你不需要很厉害才能开始，但你需要开始才能很厉害。', a: '', c: '行动' },
    { t: '真正的高贵是优于过去的自己。', a: '海明威', c: '成长' },
    { t: '慢一点没关系，只要一直在往前走。', a: '', c: '成长' },
    { t: '你远比自己以为的更有韧性。', a: '', c: '成长' },
    { t: '你不必追上谁，只要比昨天的自己好一点点。', a: '', c: '成长' },
    { t: '想，都是问题；做，才有答案。', a: '', c: '行动' },
    { t: '今天不想跑，所以才要去跑。', a: '村上春树', c: '自律' },
    { t: '先完成，再完美。', a: '', c: '行动' },
    { t: '行动是治愈焦虑的良药。', a: '', c: '治愈' },
    { t: '别让「等以后」偷走你「现在」想做的事。', a: '', c: '行动' },
    { t: '学语言没有捷径，唯有点滴积累。', a: '', c: '学习' },
    { t: '你读过的书、走过的路，终会变成你的底气。', a: '', c: '学习' },
    { t: '每天进步一点点，时间会给你答案。', a: '', c: '学习' },
    { t: '把一件事做到极致，胜过把一万件事做得平庸。', a: '', c: '学习' },
    { t: '会一门语言，就多一个看世界的窗口。', a: '', c: '学习' },
    { t: '内容创作不是比谁声音大，而是比谁更真诚。', a: '', c: '副业' },
    { t: '坚持不是看到希望才坚持，而是坚持了才看到希望。', a: '', c: '副业' },
    { t: '把热爱变成日常，生活就有了光。', a: '', c: '副业' },
    { t: '你现在的努力，是给未来的自己写情书。', a: '', c: '副业' },
    { t: '表达力，是这个时代最被低估的超能力。', a: '', c: '副业' },
    { t: '把复杂的事讲简单，是一种了不起的本事。', a: '', c: '副业' },
    { t: '把日子过成自己喜欢的样子，本身就是一种成功。', a: '', c: '生活' },
    { t: '身体是革命的本钱，照顾好自己才能走更远。', a: '', c: '生活' },
    { t: '每一个不起眼的日子，都在为惊喜铺路。', a: '', c: '生活' },
    { t: '生活不会辜负认真生活的人。', a: '', c: '生活' },
    { t: '今天的不开心到此为止，明天又是新的一篇。', a: '', c: '治愈' },
    { t: '允许自己慢慢来，但别停下来。', a: '', c: '治愈' },
    { t: '温柔而坚定，是对自己最好的态度。', a: '', c: '治愈' },
    { t: '自由不是想做什么就做什么，而是不想做什么就可以不做什么。', a: '康德', c: '自律' },
    { t: '自律给我自由。', a: '', c: '自律' },
    { t: '今天的汗水，是明天选择的权利。', a: '', c: '自律' },

    // ---- 行动 ----
    { t: '再小的步子，也是在往前。', a: '', c: '行动' },
    { t: '犹豫一千次，不如迈出去一次。', a: '', c: '行动' },
    { t: '把「我要做」变成「我在做」。', a: '', c: '行动' },
    { t: '决定去做，就已经赢了一半。', a: '', c: '行动' },
    { t: '别等准备好了，边做边学最快。', a: '', c: '行动' },
    { t: '今天能做的事，别拖到明天。', a: '', c: '行动' },
    { t: '心动不如行动，做了才有故事。', a: '', c: '行动' },
    { t: '跨出舒适区，世界就大了一点。', a: '', c: '行动' },
    { t: '你说想，不如说在做。', a: '', c: '行动' },
    { t: '行动，是最好的澄清。', a: '', c: '行动' },

    // ---- 成长 ----
    { t: '你正在成为那个你羡慕的人。', a: '', c: '成长' },
    { t: '不慌不忙，按自己的节奏长大。', a: '', c: '成长' },
    { t: '每一次跌倒，都是换了种方式站起来。', a: '', c: '成长' },
    { t: '所谓的运气，是努力碰上了机会。', a: '', c: '成长' },
    { t: '你不需要完美，只需要不放弃。', a: '', c: '成长' },
    { t: '成长就是把「我不行」变成「我试试」。', a: '', c: '成长' },
    { t: '今天的你，比昨天的你更从容。', a: '', c: '成长' },
    { t: '别怕慢，怕的是停在原地。', a: '', c: '成长' },
    { t: '你走过的每一步，都算数。', a: '', c: '成长' },

    // ---- 自律 ----
    { t: '管住自己，是对未来最大的温柔。', a: '', c: '自律' },
    { t: '把小事做好，大事自然水到渠成。', a: '', c: '自律' },
    { t: '早起的半小时，是给自己的礼物。', a: '', c: '自律' },
    { t: '不靠心情做事，靠习惯坚持。', a: '', c: '自律' },
    { t: '克制当下的懒，换来长久的自由。', a: '', c: '自律' },
    { t: '计划不执行，等于没计划。', a: '', c: '自律' },
    { t: '每天固定做一件难的事。', a: '', c: '自律' },
    { t: '自律的人，连时间都偏爱你。', a: '', c: '自律' },
    { t: '别让情绪替你做决定。', a: '', c: '自律' },

    // ---- 治愈 ----
    { t: '天总会亮，事总会过去。', a: '', c: '治愈' },
    { t: '允许自己偶尔什么都不想做。', a: '', c: '治愈' },
    { t: '你已经做得够好了，真的。', a: '', c: '治愈' },
    { t: '不比较，是和自己和解的开始。', a: '', c: '治愈' },
    { t: '深呼吸，这一刻就交给这一刻。', a: '', c: '治愈' },
    { t: '烦恼像云，风一吹就散了。', a: '', c: '治愈' },
    { t: '对自己好一点，不是奢侈是必须。', a: '', c: '治愈' },
    { t: '累了就歇歇，地球不会因此停转。', a: '', c: '治愈' },
    { t: '把心放宽，路就宽了。', a: '', c: '治愈' },

    // ---- 学习 ----
    { t: '学到老，活到老，越学越通透。', a: '', c: '学习' },
    { t: '每天认识一个新词，世界就更清楚一点。', a: '', c: '学习' },
    { t: '听懂一句外语，就打开一扇门。', a: '', c: '学习' },
    { t: '笔记不是写给别人，是写给将来的自己。', a: '', c: '学习' },
    { t: '教，是最好的学。', a: '', c: '学习' },
    { t: '不懂就问，不丢人，装懂才亏。', a: '', c: '学习' },
    { t: '把知识用起来，才算真的会。', a: '', c: '学习' },
    { t: '多一门本事，多一份底气。', a: '', c: '学习' },
    { t: '读万卷书，也行万里路。', a: '', c: '学习' },

    // ---- 副业 ----
    { t: '副业不是赚快钱，是给自己留条后路。', a: '', c: '副业' },
    { t: '把兴趣变成收入，是最幸福的事。', a: '', c: '副业' },
    { t: '坚持更新，时间会奖励长期主义者。', a: '', c: '副业' },
    { t: '粉丝不在多，在于真。', a: '', c: '副业' },
    { t: '内容是雪球，越滚越大。', a: '', c: '副业' },
    { t: '别追风口，先做好手边的事。', a: '', c: '副业' },
    { t: '视频号不靠天赋，靠日更。', a: '', c: '副业' },
    { t: '一个真实的你，胜过一百个模仿的人。', a: '', c: '副业' },
    { t: '利他，是最好的引流。', a: '', c: '副业' },
    { t: '先有作品，再谈变现。', a: '', c: '副业' },
    { t: '慢火熬汤，副业急不得。', a: '', c: '副业' },

    // ---- 生活 ----
    { t: '一日三餐，四季更迭，都是小确幸。', a: '', c: '生活' },
    { t: '把家收拾干净，心也跟着亮堂。', a: '', c: '生活' },
    { t: '好好吃饭，是爱自己的第一步。', a: '', c: '生活' },
    { t: '周末晒晒太阳，给电池充个电。', a: '', c: '生活' },
    { t: '烟火气里，藏着最踏实的幸福。', a: '', c: '生活' },
    { t: '和三两好友聊聊天，胜过百条朋友圈。', a: '', c: '生活' },
    { t: '早睡早起，是性价比最高的养生。', a: '', c: '生活' },
    { t: '给生活留点空白，才有余地呼吸。', a: '', c: '生活' },
    { t: '把平凡的日子过出滋味，是种本事。', a: '', c: '生活' },
    { t: '多走几步路，身体会感谢你。', a: '', c: '生活' },
    { t: '笑一笑，今天也不算白过。', a: '', c: '生活' },
  ];
  // 当天每日一言索引（按日期固定，当天内换条保持）
  async function getQuoteIdx() {
    const m = await DB.get('meta', 'dailyQuote');
    if (m && m.value && m.value.date === todayStr()) return m.value.idx;
    const seed = (parseInt(todayStr('n').slice(0, 8), 10) || 0) % QUOTES.length;
    await DB.put('meta', { id: 'dailyQuote', value: { date: todayStr(), idx: seed } });
    return seed;
  }

  // ---------- 各模块渲染 ----------
  async function renderHome(view) {
    view.innerHTML = '<div class="card" id="quoteCard"><div class="card-title">💬 每日一言</div>' +
      '<p id="quoteText" class="q-text"></p>' +
      '<div class="row" style="gap:8px;margin-top:10px">' +
      '<button id="quoteSwitch" class="btn sm ghost">🔄 换一条</button>' +
      '<button id="quoteFav" class="btn sm ghost">⭐ 收藏</button></div></div>';

    async function paintQuote() {
      const idx = await getQuoteIdx();
      const q = QUOTES[idx];
      $('#quoteText').innerHTML = '“' + esc(q.t) + '”' +
        (q.a ? '<span class="q-author">—— ' + esc(q.a) + '</span>' : '');
      $('#quoteSwitch').onclick = async () => {
        let n = idx; while (n === idx) n = Math.floor(Math.random() * QUOTES.length);
        await DB.put('meta', { id: 'dailyQuote', value: { date: todayStr(), idx: n } });
        paintQuote();
      };
      const favBtn = $('#quoteFav');
      const syncFav = async () => {
        const favs = await DB.all('quotes');
        if (favs.some(f => f.text === q.t)) { favBtn.textContent = '★ 已收藏'; favBtn.classList.add('on'); return true; }
        favBtn.textContent = '⭐ 收藏'; favBtn.classList.remove('on'); return false;
      };
      favBtn.onclick = async () => {
        if (await syncFav()) { toast('这句已经收藏过啦'); return; }
        await DB.put('quotes', { text: q.t, author: q.a, cat: q.c, date: todayStr(), createdAt: Date.now() });
        toast('已收藏 ⭐'); await syncFav(); paintFavs();
      };
      await syncFav();
    }
    async function paintFavs() {
      const favs = (await DB.all('quotes')).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      const box = $('#favList');
      if (!favs.length) { box.innerHTML = emptyTip('⭐', '还没有收藏，看到喜欢的名言点「收藏」'); return; }
      box.innerHTML = '';
      favs.forEach(f => {
        const c = el('<div class="fav-item"></div>');
        c.innerHTML = '<div class="fav-txt">“' + esc(f.text) + '”' + (f.author ? '<span class="q-author">—— ' + esc(f.author) + '</span>' : '') + '</div>' +
          '<button class="del">🗑</button>';
        c.querySelector('.del').onclick = async () => { if (await confirmDel('取消这条收藏？')) { await DB.del('quotes', f.id); paintFavs(); } };
        box.append(c);
      });
    }
    await paintQuote();

    const tasks = await DB.byDate('tasks', todayStr());
    const done = tasks.filter(t => t.done).length;
    const rate = tasks.length ? Math.round(done / tasks.length * 100) : 0;
    const ideas = await DB.all('ideas');
    const collected = ideas.filter(i => i.collected).length;
    const reviews = await DB.all('reviews');
    const en = await DB.all('english');
    const enStreak = streak(en.map(e => e.date));

    const card = el('<div class="card"></div>');
    card.innerHTML =
      '<div class="card-title">📋 今日计划完成率</div>' +
      '<div class="row spread"><div class="rate-num">' + rate + '%</div>' +
      '<div class="muted">' + done + ' / ' + tasks.length + ' 完成</div></div>' +
      '<div class="progress" style="margin-top:8px"><i style="width:' + rate + '%"></i></div>';
    view.append(card);

    const grid = el('<div class="card"></div>');
    grid.innerHTML =
      '<div class="card-title">📊 一眼概览</div>' +
      '<div class="stat-grid">' +
      '<div class="stat"><b>' + ideas.length + '</b><span>灵感总数</span></div>' +
      '<div class="stat"><b>' + collected + '</b><span>已收藏选题</span></div>' +
      '<div class="stat"><b>' + reviews.length + '</b><span>复盘条数</span></div>' +
      '<div class="stat"><b>' + enStreak + '</b><span>英语连续天</span></div>' +
      '<div class="stat"><b>' + distinctDays(en.map(e => e.date)) + '</b><span>英语学习天</span></div>' +
      '<div class="stat"><b>' + MODULES.length + '</b><span>模块</span></div>' +
      '</div>';
    view.append(grid);

    const grat = await DB.get('gratitude', todayStr());
    const hNow = new Date().getHours();
    const evening = hNow >= 20;
    const gCard = el('<div class="card"></div>');
    if (grat && grat.items && grat.items.length) {
      gCard.innerHTML = '<div class="card-title">🙏 今日感恩</div>' +
        '<p class="muted" style="margin:0 0 8px">今天已写下 <b>' + grat.items.length + '</b> 件感恩 ✅</p>' +
        '<div class="g-home-prev">' + grat.items.slice(0, 2).map(t => '<div class="g-home-line">· ' + esc(t) + '</div>').join('') +
        (grat.items.length > 2 ? '<div class="muted">…还有 ' + (grat.items.length - 2) + ' 件</div>' : '') + '</div>' +
        '<button id="goGrat" class="btn sm green block" style="margin-top:8px">查看 / 续写</button>';
    } else {
      gCard.innerHTML = '<div class="card-title">🙏 今日感恩' + (evening ? ' ⏰' : '') + '</div>' +
        '<p class="muted" style="margin:0 0 8px">' + (evening ? '睡前别忘了：记下今天 5 件值得感恩的事 🌙' : '今天还没写，睡前花 1 分钟记下开心事 🌙') + '</p>' +
        '<button id="goGrat" class="btn sm green block" style="margin-top:8px">去写今日感恩</button>';
      if (evening) gCard.classList.add('g-home-alert');
    }
    view.append(gCard);
    $('#goGrat').onclick = () => go('gratitude');

    const fav = el('<div class="card"><div class="card-title">⭐ 我收藏的句子</div><div id="favList"></div></div>');
    view.append(fav);
    paintFavs();

    const tip = el('<div class="card"><div class="card-title">💡 小提示</div><p class="muted" style="margin:0">数据只存在这台手机里。想保险一点，去左上角菜单点「导出备份」，把数据存成文件。</p></div>');
    view.append(tip);
  }

  // 1. 每日计划 — 分组卡片式（参考胡楚靓工作台）
  async function renderDaily(view) {
    view.innerHTML =
      /* 统计卡 */
      '<div class="row" style="gap:12px;margin-bottom:16px">' +
      '<div class="card stat-card"><div class="stat-big" id="pendNum">0</div><div class="stat-label">待完成</div></div>' +
      '<div class="card stat-card"><div class="stat-big" id="ratePct">0%</div><div class="stat-label">完成率</div></div></div>' +
      /* 个人日常 */
      '<div class="sec-block"><div class="sec-head"><h3>个人日常</h3><p class="muted">健身操 / 尤克里里 / 英语，雷打不动的日课。</p></div>' +
      '<div id="listRoutine"></div>' +
      '<button id="addR" class="btn ghost block" style="margin-top:8px">＋ 添加日常任务</button></div>' +
      /* 创作任务 */
      '<div class="sec-block"><div class="sec-head"><h3>创作任务</h3><p class="muted">内容拍摄、运营、复盘。</p></div>' +
      '<div id="listCreate"></div>' +
      '<button id="addC" class="btn ghost block" style="margin-top:8px">＋ 添加创作任务</button></div>';

    const TAGS = { routine: '每日必做', create: '创作' };
    const renderTask = (t) => {
      const card = el('<div class="task-card' + (t.done ? ' done' : '') + '"></div>');
      card.innerHTML =
        '<div class="tc-left"><div class="check' + (t.done ? ' done' : '') + '">' + (t.done ? '✓' : '') + '</div></div>' +
        '<div class="tc-body"><div class="tc-text">' + esc(t.text) + '</div>' +
        '<span class="chip tc-tag">' + (TAGS[t.category] || '') + '</span></div>' +
        '<button class="tc-del">×</button>';
      card.querySelector('.check').onclick = async () => {
        t.done = !t.done; if (t.done) t.completedAt = Date.now();
        await DB.put('tasks', t); refresh();
      };
      card.querySelector('.tc-del').onclick = async () => {
        if (await confirmDel('删除这个任务？')) { await DB.del('tasks', t.id); refresh(); }
      };
      return card;
    };

    async function refresh() {
      const tasks = await DB.byDate('tasks', todayStr());
      const total = tasks.length, done = tasks.filter(t => t.done).length;
      const rate = total ? Math.round(done / total * 100) : 0;
      $('#pendNum').textContent = total - done;
      $('#ratePct').textContent = rate + '%';
      const fill = (box, cat) => {
        const arr = tasks.filter(t => t.category === cat);
        box.innerHTML = '';
        if (!arr.length) { box.innerHTML = '<p class="empty-sm">暂无任务，下方添加 ↓</p>'; return; }
        arr.forEach(t => box.append(renderTask(t)));
      };
      fill($('#listRoutine'), 'routine');
      fill($('#listCreate'), 'create');
    }

    const addTask = async (cat) => {
      const f = await promptForm('添加' + (cat === 'routine' ? '日常' : '创作') + '任务', [
        { name: 'text', label: '任务内容', type: 'text', placeholder: '如：尤克里里练习 30 分钟' },
        { name: 'tag', label: '标签（可选）', type: 'text', placeholder: '如：每日必做 / 今天优先' },
      ]);
      if (f && f.text && f.text.trim()) {
        await DB.put('tasks', { date: todayStr(), text: f.text.trim(), category: cat, tag: (f.tag || '').trim(), done: false, createdAt: Date.now() });
        refresh();
      }
    };
    $('#addR').onclick = () => addTask('routine');
    $('#addC').onclick = () => addTask('create');

    // 每日默认日课：今天日常为空时铺一套
    async function ensureRoutine() {
      const tasks = await DB.byDate('tasks', todayStr());
      const routine = tasks.filter(t => t.category === 'routine');
      const defaults = ['健身操 30 分钟', '尤克里里练习 30 分钟', '英语学习 30 分钟'];
      if (!routine.length) {
        for (const text of defaults) {
          await DB.put('tasks', { date: todayStr(), text, category: 'routine', tag: '每日必做', done: false, createdAt: Date.now() });
        }
      }
    }
    await ensureRoutine();
    refresh();
  }

  // 2. 选题灵感 — 编号列表 + 分类标签 + 外部跳转（参考胡楚靓工作台）
  const IDEA_TAGS = ['思考', '搞笑', '化妆', '服装', '唱歌', '弹琴', '生活', '干货'];
  async function renderIdeas(view) {
    view.innerHTML =
      '<div class="card idea-header"><div class="row spread"><b>🔥 每日灵感来源</b> <span class="muted" id="ideaMeta"></span></div>' +
      '<p class="muted" style="margin:6px 0 0;font-size:13px">每天由「每日9点·热点选题灵感」自动化产出；若当天未生成则显示最近一批。每条附跳转链接——点开即跳去搜相关视频 / 文章。「🔄 立即刷新」拉取云端最新一批；「🎲 换一批」从手机本地题库随机洗牌（无需联网）。</p>' +
      '<div class="row" style="margin-top:10px;gap:8px"><button id="refreshIdea" class="btn sm ghost">🔄 立即刷新</button><button id="shuffleIdea" class="btn sm ghost">🎲 换一批(本地)</button></div></div>' +
      '<div id="ideaList"></div>' +
      '<div class="section-label" style="margin-top:18px">➕ 我的灵感（收藏 / 手动添加）</div>' +
      '<div class="row wrap" style="margin-bottom:10px;gap:8px"><button id="manual" class="btn">➕ 添加灵感</button></div>' +
      '<div id="myList"></div>';

    // 取自动化每天推过来的选题；取不到（离线）就用本地按日期生成的兜底版
    async function loadDaily() {
      try {
        const r = await fetch('./data/daily-ideas.json?v=' + todayStr(), { cache: 'no-store' });
        if (!r.ok) return null;
        const j = await r.json();
        // 只要文件有效（有条目）就用——不要求日期正好等于今天，避免“过期文件”被误判成离线兜底
        if (j && Array.isArray(j.items) && j.items.length) return j;
      } catch (e) { /* 离线或取不到，走本地兜底 */ }
      return null;
    }
    // 本地灵感库：从题库抽一批。seed 传时间则用“每次都换一批”，不传则用当天种子（每天稳定）
    function localDaily(seed) {
      const s = (typeof seed === 'number') ? seed : parseInt(todayStr().replace(/-/g, ''), 10);
      const rnd = mulberry32(s);
      const pool = IDEAS_BANK.slice();
      const out = [];
      for (let i = 0; i < 10 && pool.length; i++) {
        const k = Math.floor(rnd() * pool.length);
        out.push({ text: pool.splice(k, 1)[0], tag: IDEA_TAGS[Math.floor(rnd() * IDEA_TAGS.length)], desc: '', potential: '' });
      }
      return { date: todayStr(), source: '本地灵感库', items: out };
    }
    function searchBtns(it) {
      const mk = (plat, label) => {
        const base = plat === 'dy' ? 'https://www.douyin.com/search/' : plat === 'bz' ? 'https://search.bilibili.com/all?keyword=' : 'https://www.baidu.com/s?wd=';
        return '<button class="btn sm ghost idea-go" data-url="' + base + encodeURIComponent(it.text) + '">' + label + '</button>';
      };
      return mk('dy', '▶ 抖音搜索') + mk('bz', '▶ B站搜索') + mk('bd', '▶ 百度搜索');
    }
    function bindSearch(card) {
      card.querySelectorAll('.idea-go').forEach(btn => { btn.onclick = () => openLink(btn.dataset.url); });
    }

    async function renderDaily(mode) {
      const box = $('#ideaList');
      let data;
      if (mode === 'local') {
        data = localDaily(Date.now());            // 🎲 换一批：从本地题库随机洗牌，每次都不同，不联网
      } else {
        data = await loadDaily() || localDaily();  // 进入 / 🔄立即刷新：优先拉云端每日文件，拉不到退本地
      }
      const items = data.items;
      const off = data.source && data.source.indexOf('本地') >= 0;
      const stale = !off && data.date && data.date !== todayStr();
      $('#ideaMeta').textContent = '(' + (data.date || todayStr('cn')) + ' · ' + items.length + ' 条' + (stale ? ' · 非今日，点“🎲 换一批”换一批' : (off ? ' · 本地灵感' : '')) + ')';
      box.innerHTML = '';
      items.forEach((it, idx) => {
        const card = el('<div class="idea-card"></div>');
        const tag = it.tag || IDEA_TAGS[idx % IDEA_TAGS.length];
        const potClass = it.potential === '高' ? 'hot' : it.potential === '中' ? 'warn' : '';
        card.innerHTML =
          '<div class="idea-num">' + (idx + 1) + '</div>' +
          '<div class="idea-body"><div class="row" style="gap:6px;flex-wrap:wrap"><b class="idea-title">' + esc(it.text) + '</b>' +
          '<span class="chip idea-tag">' + esc(tag) + '</span>' +
          (it.potential ? '<span class="chip ' + potClass + '">' + esc(it.potential) + '</span>' : '') + '</div>' +
          (it.desc ? '<p class="muted" style="margin:6px 0 0;font-size:14px">' + esc(it.desc) + '</p>' : '') +
          '<div class="row" style="margin-top:10px;gap:8px;flex-wrap:wrap">' + searchBtns(it) +
          '<button class="btn sm ghost" data-act="fav">☆ 收藏</button></div></div>';
        bindSearch(card);
        card.querySelector('[data-act="fav"]').onclick = async () => {
          await DB.put('ideas', { text: it.text, auto: true, collected: true, potential: it.potential || '', tag: tag, desc: it.desc || '', createdAt: Date.now() });
          toast('已收藏到「我的灵感」 ⭐');
        };
        box.append(card);
      });
    }

    async function renderMine() {
      const list = await DB.all('ideas');
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      const box = $('#myList');
      if (!list.length) { box.innerHTML = emptyTip('📥', '收藏或添加的灵感会在这里'); return; }
      box.innerHTML = '';
      list.forEach((it) => {
        const card = el('<div class="idea-card"></div>');
        const tag = it.tag || '思考';
        const potClass = it.potential === '高' ? 'hot' : it.potential === '中' ? 'warn' : '';
        card.innerHTML =
          '<div class="idea-body"><div class="row" style="gap:6px;flex-wrap:wrap"><b class="idea-title">' + esc(it.text) + '</b>' +
          '<span class="chip idea-tag">' + esc(tag) + '</span>' +
          (it.potential ? '<span class="chip ' + potClass + '">' + esc(it.potential) + '</span>' : '') +
          (it.collected ? '<span class="chip on">⭐ 已收藏</span>' : '') + '</div>' +
          (it.desc ? '<p class="muted" style="margin:6px 0 0;font-size:14px">' + esc(it.desc) + '</p>' : '') +
          '<div class="row" style="margin-top:10px;gap:8px;flex-wrap:wrap">' + searchBtns(it) +
          '<button class="del" style="padding:0 4px">🗑</button></div></div>';
        bindSearch(card);
        card.querySelector('.del').onclick = async () => { if (await confirmDel('删除这条灵感？')) { await DB.del('ideas', it.id); renderMine(); } };
        box.append(card);
      });
    }

    $('#refreshIdea').onclick = async () => { await renderDaily('cloud'); toast('已拉取云端最新一批 🔄'); };
    $('#shuffleIdea').onclick = async () => { await renderDaily('local'); toast('已换一批本地灵感 🎲'); };
    $('#manual').onclick = async () => {
      const f = await promptForm('添加灵感', [
        { name: 'text', label: '灵感内容', type: 'textarea', placeholder: '想做点什么内容？' },
        { name: 'desc', label: '详细说明（可选）', type: 'textarea', placeholder: '为什么这个选题好、怎么做…' },
        { name: 'tag', label: '分类标签', type: 'select', options: IDEA_TAGS.map(t => ({ value: t, label: t })) },
        { name: 'potential', label: '爆款潜力', type: 'select', options: [{ value: '', label: '未评' }, { value: '高', label: '高' }, { value: '中', label: '中' }, { value: '低', label: '低' }] },
      ]);
      if (f && f.text) { await DB.put('ideas', { text: f.text, auto: false, collected: false, potential: f.potential, tag: f.tag, desc: f.desc || '', createdAt: Date.now() }); renderMine(); }
    };
    renderDaily();
    renderMine();
  }

  // 3. 爆款二创 — tab切换 + 分类筛选 + 分析卡 + 多操作（参考胡楚靓工作台）
  const HOT_CATS = ['全部', '搞笑', '化妆', '服装', '唱歌', '弹琴', '思考', '生活'];
  async function renderHot(view) {
    view.innerHTML =
      '<div class="row hot-tabs" style="margin-bottom:12px;gap:8px">' +
      '<button class="btn sm hot-tab active" data-t="hot">🔥 热点榜</button>' +
      '<button class="btn sm hot-tab ghost" data-t="chal">🏆 挑战榜·可跟拍</button></div>' +
      '<div id="hotTip" class="card" style="padding:10px 14px"></div>' +
      '<div class="hot-cats" id="hotCats"></div>' +
      '<div class="row" style="margin:0 0 12px;gap:8px"><button id="refreshHot" class="btn sm ghost">🔄 立即刷新</button></div>' +
      '<div id="dailyList"></div>' +
      '<div class="section-label" style="margin-top:18px">📌 我收藏的</div>' +
      '<div class="row wrap" style="margin-bottom:10px"><button id="addHot" class="btn">➕ 手动收藏</button></div>' +
      '<div id="mineList"></div>';

    let curTab = 'hot';
    let curCat = '全部';

    // 取自动化每天推的热点/挑战；不是今天的（电脑没开/离线）就用本地兜底
    // 离线兜底用的最小内置题库（防止完全没网 / 文件未推送时板块空白或崩溃）
    const FALLBACK_HOT = [
      { title: '用英语/越南语介绍一道中国美食', cat: '生活', source: '内置', desc: '双语+美食，流量稳，适合冷启动', hot: '' },
      { title: '小城慢游 vlog · 慢充旅行', cat: '生活', source: '内置', desc: '旅游管理老师身份，专业背书强', hot: '' },
      { title: '尤克里里翻弹当下热门神曲', cat: '弹琴', source: '内置', desc: '音乐类账号蹭顶流 BGM 涨粉最快', hot: '' },
      { title: '每天一句实用英语/越南语', cat: '思考', source: '内置', desc: '教师口条好，适合日更养号', hot: '' },
      { title: '探店 vlog + 场景英语教学', cat: '生活', source: '内置', desc: '美食与语言双结合，有场景', hot: '' },
      { title: '零基础手势舞改编弹唱版', cat: '唱歌', source: '内置', desc: '比纯手势舞更有记忆点', hot: '' },
    ];
    const FALLBACK_CHAL = [
      { topic: '#慢充旅行', cat: '生活', desc: '带定位+话题发小城慢游视频或图文', join: '48万', why: '旅游老师身份契合，时间灵活正好拍' },
      { topic: '#跟我学一句英语', cat: '思考', desc: '结合当天热点教一句实用英语', join: '26万', why: '教师出身口条好，适合日更' },
      { topic: '#生气了', cat: '弹琴', desc: '用热门神曲当 BGM 翻弹/对口型', join: '120万', why: '音乐类涨粉快，翻弹版稀缺' },
      { topic: '#是不是嘛对不对嘛', cat: '唱歌', desc: '零基础手势舞改弹唱版做差异化', join: '35万', why: '门槛低出片快' },
      { topic: '#世界杯夜宵', cat: '生活', desc: '拍看球夜宵探店或熬夜拉伸操', join: '89万', why: '赛事流量池巨大' },
    ];
    function pickFrom(arr, n, seed) {
      if (!arr || !arr.length) return [];
      const rnd = mulberry32(seed + arr.length); const pool = arr.slice(); const out = [];
      for (let i = 0; i < n && pool.length; i++) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
      return out;
    }
    async function loadDailyHot() {
      let bank = null;
      try {
        const r = await fetch('./data/daily-hot.json?v=' + todayStr(), { cache: 'no-store' });
        if (r.ok) { const j = await r.json(); if (j && (j.hot || j.challenges)) bank = j; }
      } catch (e) { /* 离线兜底 */ }
      if (!bank) return null;
      // 用当天日期做随机种子，从题库里挑一批；不要求 date 必须是今天，保证每天换一批、永不空白
      const seed = parseInt(todayStr().replace(/-/g, ''), 10);
      return { date: todayStr(), source: bank.source || '热点题库 · 每日轮换', hot: pickFrom(bank.hot, 5), challenges: pickFrom(bank.challenges, 5) };
    }
    function localDailyHot() {
      const seed = parseInt(todayStr().replace(/-/g, ''), 10);
      return { date: todayStr(), source: '本地内置题库（离线兜底）', hot: pickFrom(FALLBACK_HOT, 5), challenges: pickFrom(FALLBACK_CHAL, 5) };
    }
    let daily = null;

    const renderCats = () => {
      $('#hotCats').innerHTML = HOT_CATS.map(c =>
        '<span class="chip' + (c === curCat ? ' on' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</span>'
      ).join('');
      $('#hotCats').querySelectorAll('[data-cat]').forEach(elm => {
        elm.onclick = () => { curCat = elm.dataset.cat; renderCats(); renderDaily(); };
      });
    };

    // 热点资讯卡
    function hotCard(h) {
      const card = el('<div class="hot-card"></div>');
      card.innerHTML =
        '<div class="row" style="gap:6px;flex-wrap:wrap"><h4 style="margin:0;font-size:16px">' + esc(h.title) + '</h4>' +
        (h.cat ? '<span class="chip idea-tag">' + esc(h.cat) + '</span>' : '') +
        (h.source ? '<span class="chip hot-src">' + esc(h.source) + '</span>' : '') +
        (h.hot ? '<span class="chip hot">🔥 ' + esc(h.hot) + '</span>' : '') + '</div>' +
        (h.desc ? '<div class="hot-reason"><b>可以这样蹭：</b>' + esc(h.desc) + '</div>' : '') +
        '<div class="row hot-actions" style="margin-top:10px;gap:6px;flex-wrap:wrap">' +
        '<button class="btn sm ghost" data-act="go">▶ 去抖音看</button>' +
        '<button class="btn sm ghost" data-act="bz">▶ B站看</button>' +
        '<button class="btn sm ghost" data-act="task">＋ 加入任务</button>' +
        '<button class="btn sm ghost" data-act="fav">☆ 存为灵感</button></div>';
      card.querySelector('[data-act="go"]').onclick = () => openLink('https://www.douyin.com/search/' + encodeURIComponent(h.title));
      card.querySelector('[data-act="bz"]').onclick = () => openLink('https://search.bilibili.com/all?keyword=' + encodeURIComponent(h.title));
      card.querySelector('[data-act="task"]').onclick = async () => {
        await DB.put('tasks', { date: todayStr(), text: '蹭热点：' + h.title, category: 'create', done: false, createdAt: Date.now() });
        toast('已加入今日创作任务 ✅');
      };
      card.querySelector('[data-act="fav"]').onclick = async () => {
        await DB.put('hot', { title: h.title, type: 'hot', category: h.cat || '', source: h.source || '', whyFit: h.desc || '', angle: '', note: '', savedIdea: true, createdAt: Date.now() });
        toast('已存到「我收藏的」📌');
      };
      return card;
    }
    // 挑战话题卡
    function chalCard(c) {
      const card = el('<div class="hot-card chal-card"></div>');
      card.innerHTML =
        '<div class="row" style="gap:6px;flex-wrap:wrap"><h4 style="margin:0;font-size:16px;color:var(--primary)">' + esc(c.topic) + '</h4>' +
        (c.cat ? '<span class="chip idea-tag">' + esc(c.cat) + '</span>' : '') +
        (c.join ? '<span class="chip hot-src">👥 ' + esc(c.join) + '参与</span>' : '') + '</div>' +
        (c.desc ? '<div class="hot-angle"><b>怎么拍：</b>' + esc(c.desc) + '</div>' : '') +
        (c.why ? '<div class="hot-reason"><b>为什么适合你：</b>' + esc(c.why) + '</div>' : '') +
        '<div class="row hot-actions" style="margin-top:10px;gap:6px;flex-wrap:wrap">' +
        '<button class="btn sm" data-act="join">▶ 去参与挑战·找灵感</button>' +
        '<button class="btn sm ghost" data-act="home">✍ 交作业</button>' +
        '<button class="btn sm ghost" data-act="fav">☆ 存为灵感</button></div>';
      const kw = c.topic.replace(/^#/, '');
      card.querySelector('[data-act="join"]').onclick = () => openLink('https://www.douyin.com/search/' + encodeURIComponent(kw));
      card.querySelector('[data-act="home"]').onclick = async () => {
        await DB.put('tasks', { date: todayStr(), text: '交作业：参加 ' + c.topic + ' 挑战', category: 'create', done: false, createdAt: Date.now() });
        toast('「交作业」已加进今日创作任务 ✍');
      };
      card.querySelector('[data-act="fav"]').onclick = async () => {
        await DB.put('hot', { title: c.topic, type: 'chal', category: c.cat || '', source: '', whyFit: c.why || '', angle: c.desc || '', note: '', savedIdea: true, createdAt: Date.now() });
        toast('已存到「我收藏的」📌');
      };
      return card;
    }

    function renderDaily() {
      const box = $('#dailyList');
      const off = daily && daily.source && daily.source.indexOf('本地') >= 0;
      $('#hotTip').innerHTML = curTab === 'hot'
        ? '<b>🔥 热点榜</b> <span class="muted" style="font-size:13px">每天上午 9 点自动更新的热点资讯' + (off ? ' · 离线兜底' : '') + '。点「加入任务」就把它变成今天要做的选题。</span>'
        : '<b>🏆 挑战榜</b> <span class="muted" style="font-size:13px">带 #话题、能直接跟拍的内容，比热搜更好上手。点「去参与挑战」找灵感，拍好点「交作业」记一笔。</span>';
      let items = curTab === 'hot' ? (daily.hot || []) : (daily.challenges || []);
      if (curCat !== '全部') items = items.filter(x => (x.cat || '') === curCat);
      box.innerHTML = '';
      if (!items.length) { box.innerHTML = emptyTip('🍃', '这个分类今天没有，换一个试试'); return; }
      items.forEach(x => box.append(curTab === 'hot' ? hotCard(x) : chalCard(x)));
    }

    async function renderMine() {
      let list = await DB.all('hot');
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      if (curTab === 'chal') list = list.filter(h => h.type === 'chal');
      else list = list.filter(h => h.type !== 'chal');
      const box = $('#mineList');
      if (!list.length) { box.innerHTML = emptyTip('📌', '收藏或手动加的会在这里'); return; }
      box.innerHTML = '';
      list.forEach(h => {
        const card = el('<div class="hot-card"></div>');
        card.innerHTML =
          '<div class="row" style="gap:6px;flex-wrap:wrap"><h4 style="margin:0;font-size:16px">' + esc(h.title) + '</h4>' +
          '<span class="chip hot-type">' + (h.type === 'chal' ? '挑战' : '热点') + '</span>' +
          (h.category ? '<span class="chip idea-tag">' + esc(h.category) + '</span>' : '') +
          (h.source ? '<span class="chip hot-src">' + esc(h.source) + '</span>' : '') + '</div>' +
          (h.whyFit ? '<div class="hot-reason"><b>为什么适合：</b>' + esc(h.whyFit) + '</div>' : '') +
          (h.angle ? '<div class="hot-angle"><b>怎么拍/改编：</b>' + esc(h.angle) + '</div>' : '') +
          (h.note ? '<div class="hot-note">💬 <span class="muted">' + esc(h.note) + '</span></div>' : '') +
          '<div class="row hot-actions" style="margin-top:10px;gap:6px;flex-wrap:wrap">' +
          '<button class="btn sm ghost" data-act="go">▶ 去抖音看/参与</button>' +
          '<button class="btn sm ghost" data-act="task">＋ 加入任务</button>' +
          (h.url ? '<button class="btn sm ghost" data-act="link">🔗 打开链接</button>' : '') +
          '<button class="del" style="padding:2px 6px;font-size:14px">🗑</button></div>';
        card.querySelector('[data-act="go"]').onclick = () => openLink('https://www.douyin.com/search/' + encodeURIComponent((h.title || '').replace(/^#/, '')));
        card.querySelector('[data-act="task"]').onclick = async () => {
          await DB.put('tasks', { date: todayStr(), text: (h.type === 'chal' ? '交作业：参加 ' : '二创：') + h.title, category: 'create', done: false, createdAt: Date.now() });
          toast('已加入今日创作任务 ✅');
        };
        if (h.url) card.querySelector('[data-act="link"]').onclick = () => openLink(h.url);
        card.querySelector('.del').onclick = async () => { if (await confirmDel('删除这条？')) { await DB.del('hot', h.id); renderMine(); } };
        box.append(card);
      });
    }

    view.querySelectorAll('.hot-tab').forEach(btn => {
      btn.onclick = () => {
        view.querySelectorAll('.hot-tab').forEach(b => { b.classList.remove('active'); b.classList.add('ghost'); });
        btn.classList.add('active'); btn.classList.remove('ghost');
        curTab = btn.dataset.t; curCat = '全部'; renderCats(); renderDaily(); renderMine();
      };
    });
    $('#refreshHot').onclick = async () => { daily = await loadDailyHot() || localDailyHot(); renderDaily(); toast('已刷新 🔄'); };
    $('#addHot').onclick = async () => {
      const f = await promptForm('手动收藏', [
        { name: 'title', label: '标题 / #话题', placeholder: '视频名，或 #话题名' },
        { name: 'type', label: '类型', type: 'select', options: [{ value: 'hot', label: '热点视频' }, { value: 'chal', label: '挑战·可跟拍' }] },
        { name: 'category', label: '分类', type: 'select', options: HOT_CATS.slice(1).map(c => ({ value: c, label: c })) },
        { name: 'url', label: '链接（选填）', placeholder: 'https://...' },
        { name: 'whyFit', label: '为什么适合', type: 'textarea', placeholder: '这个点为什么值得做…' },
        { name: 'angle', label: '怎么拍 / 改编角度', type: 'textarea', placeholder: '我打算怎么拍…' },
        { name: 'note', label: '个人笔记', type: 'textarea', placeholder: '自己的想法…' },
      ]);
      if (f && f.title) {
        await DB.put('hot', { title: f.title, type: f.type || 'hot', category: f.category || '', url: f.url, source: '', whyFit: f.whyFit || '', angle: f.angle || '', note: f.note || '', savedIdea: false, createdAt: Date.now() });
        renderMine();
      }
    };

    daily = await loadDailyHot() || localDailyHot();
    renderCats(); renderDaily(); renderMine();
  }

  // 4. 内容复盘（升级：平台/评级/结构化数据 + 顶部统计 + 智能复盘报告 + 模板 + 平台筛选）
  const REV_PLATFORMS = ['公众号', '短视频', '小红书', '抖音', '其他'];
  const REV_RATINGS = ['爆款', '良好', '一般', '较差', '翻车'];
  const RATING_SCORE = { '爆款': 5, '良好': 4, '一般': 3, '较差': 2, '翻车': 1 };
  const RATING_CLS = { '爆款': 'b-good', '良好': 'b-ok', '一般': 'b-mid', '较差': 'b-low', '翻车': 'b-bad' };
  function fmtNum(n) { n = Number(n) || 0; if (!n) return ''; if (n >= 10000) return (n / 10000).toFixed(1) + '万'; return '' + n; }
  function ratingBadge(r) { return '<span class="rev-badge ' + (RATING_CLS[r] || 'b-mid') + '">' + esc(r || '未评') + '</span>'; }
  function platformBadge(p) { return '<span class="rev-pf">' + esc(p || '其他') + '</span>'; }
  function metricsLine(r) {
    const m = r.metrics || {}; const parts = [];
    if (m.views) parts.push('▶ ' + fmtNum(m.views) + (r.platform === '短视频' ? '播放' : '阅读'));
    if (m.likes) parts.push('👍 ' + fmtNum(m.likes));
    if (m.comments) parts.push('💬 ' + fmtNum(m.comments));
    if (m.shares) parts.push('🔁 ' + fmtNum(m.shares));
    if (m.fans) parts.push('➕' + fmtNum(m.fans) + '粉');
    if (parts.length) return parts.join(' · ');
    if (r.data) return '📋 ' + esc(r.data);
    return '';
  }
  function weekRange() {
    const d = new Date(); const day = d.getDay() || 7; const mon = new Date(d); mon.setDate(d.getDate() - day + 1);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const f = (x) => (x.getMonth() + 1) + '.' + x.getDate();
    return f(mon) + '-' + f(sun);
  }

  async function renderReview(view) {
    view.innerHTML =
      '<div class="stat-grid" id="revStats"></div>' +
      '<div class="row" style="gap:8px;margin:10px 0 12px;flex-wrap:wrap">' +
        '<button id="addRev" class="btn sm">➕ 复盘一条</button>' +
        '<button id="revTpl" class="btn ghost sm">📝 套模板</button>' +
        '<button id="revInsight" class="btn ghost sm">📊 智能复盘报告</button>' +
        '<select id="revFilter" class="grow" style="max-width:150px">' +
          '<option value="">全部平台</option>' + REV_PLATFORMS.map(p => '<option value="' + p + '">' + p + '</option>').join('') +
        '</select>' +
      '</div>' +
      '<div id="list"></div>';

    async function refresh() {
      const list = await DB.all('reviews');
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      const n = list.length;
      let bombs = 0, sum = 0; const pfBomb = {};
      list.forEach(r => {
        const rt = r.rating || '未评';
        if (rt === '爆款') { bombs++; const p = r.platform || '其他'; pfBomb[p] = (pfBomb[p] || 0) + 1; }
        if (RATING_SCORE[rt]) sum += RATING_SCORE[rt];
      });
      const avg = n ? (sum / n).toFixed(1) : '—';
      let bp = '—', bx = -1; for (const p in pfBomb) if (pfBomb[p] > bx) { bx = pfBomb[p]; bp = p; }
      $('#revStats').innerHTML =
        '<div class="stat"><b>' + n + '</b><span>复盘条数</span></div>' +
        '<div class="stat"><b>' + bombs + '</b><span>爆款数</span></div>' +
        '<div class="stat"><b>' + avg + '</b><span>平均评级</span></div>' +
        '<div class="stat"><b>' + bp + '</b><span>最佳平台</span></div>';
      const box = $('#list');
      const filter = $('#revFilter').value;
      const shown = filter ? list.filter(r => (r.platform || '其他') === filter) : list;
      if (!shown.length) { box.innerHTML = emptyTip('📊', filter ? (filter + ' 还没有复盘') : '发完内容来这里复盘'); return; }
      box.innerHTML = '';
      shown.forEach(r => {
        const ml = metricsLine(r);
        const card = el('<div class="item"></div>');
        card.innerHTML =
          '<div class="row spread"><h4 style="margin:0">' + esc(r.title || '无标题') + '</h4>' +
          '<div class="row" style="gap:6px">' + platformBadge(r.platform) + ratingBadge(r.rating) + '<button class="del">🗑</button></div></div>' +
          (ml ? '<div class="rev-metrics">' + ml + '</div>' : '') +
          '<div class="quad" style="margin-top:8px">' +
          '<div><b>亮点 / 为什么好</b>' + esc(r.good || '—') + '</div>' +
          '<div><b>不足 / 为什么差</b>' + esc(r.bad || '—') + '</div></div>' +
          (r.fix ? '<div class="rev-fix">➡️ 下次：' + esc(r.fix) + '</div>' : '') +
          '<div class="meta">' + esc(r.date || '') + '</div>';
        card.querySelector('.del').onclick = async () => { if (await confirmDel('删除这条复盘？')) { await DB.del('reviews', r.id); refresh(); } };
        box.append(card);
      });
    }

    function addReview(preset) {
      preset = preset || {};
      return promptForm('内容复盘' + (preset.tag ? (' · ' + preset.tag) : ''), [
        { name: 'title', label: '内容标题', value: preset.title || '', placeholder: '这条内容叫什么' },
        { name: 'platform', label: '发布平台', type: 'select', options: REV_PLATFORMS.map(p => ({ value: p, label: p })), value: preset.platform || '' },
        { name: 'rating', label: '表现评级', type: 'select', options: REV_RATINGS.map(r => ({ value: r, label: r })), value: preset.rating || '' },
        { name: 'views', label: '播放 / 阅读数', type: 'number', placeholder: '如 12000' },
        { name: 'likes', label: '点赞数', type: 'number', placeholder: '如 230' },
        { name: 'comments', label: '评论数', type: 'number', placeholder: '如 18' },
        { name: 'shares', label: '转发数', type: 'number', placeholder: '如 5' },
        { name: 'fans', label: '涨粉数', type: 'number', placeholder: '如 38' },
        { name: 'good', label: '亮点 / 为什么好', type: 'textarea', value: preset.good || '' },
        { name: 'bad', label: '不足 / 为什么差', type: 'textarea', value: preset.bad || '' },
        { name: 'fix', label: '下次具体动作', type: 'textarea', value: preset.fix || '' },
      ]).then(async f => {
        if (!f || !f.title) return;
        const metrics = { views: +f.views || 0, likes: +f.likes || 0, comments: +f.comments || 0, shares: +f.shares || 0, fans: +f.fans || 0 };
        await DB.put('reviews', Object.assign({ date: todayStr(), createdAt: Date.now() }, {
          title: f.title, platform: f.platform || '其他', rating: f.rating || '未评',
          metrics: metrics, good: f.good, bad: f.bad, fix: f.fix
        }));
        refresh();
      });
    }

    $('#addRev').onclick = () => addReview();
    $('#revTpl').onclick = () => {
      const m = el('<div class="modal-mask"><div class="modal" style="max-width:320px"><h3>📝 选个复盘模板</h3><div class="col" style="display:flex;flex-direction:column;gap:10px;margin-top:8px">' +
        '<button class="btn" id="tDaily">📅 日复盘（5 分钟）</button>' +
        '<button class="btn" id="tWeek">🗓 周复盘（30 分钟）</button>' +
        '<button class="btn" id="tMonth">📆 月复盘（1 小时）</button></div>' +
        '<div class="modal-actions"><button class="btn ghost grow" id="tClose">取消</button></div></div></div>');
      document.body.append(m); requestAnimationFrame(() => m.classList.add('show'));
      const close = () => { m.classList.remove('show'); setTimeout(() => m.remove(), 200); };
      m.querySelector('#tClose').onclick = close; m.onclick = e => { if (e.target === m) close(); };
      m.querySelector('#tDaily').onclick = () => { close(); addReview({ tag: '日复盘', title: '【日复盘】' + todayStr(), good: '今天数据最好的内容 / 亮点：', bad: '今天数据最差的：', fix: '明天改进（只写 1 条）：' }); };
      m.querySelector('#tWeek').onclick = () => { close(); addReview({ tag: '周复盘', title: '【周复盘】' + weekRange(), good: '本周最佳 2 条及原因：', bad: '本周最差 2 条及原因：', fix: '下周重点（1-3 条）：' }); };
      m.querySelector('#tMonth').onclick = () => { close(); addReview({ tag: '月复盘', title: '【月复盘】' + new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' }), good: '本月爆款 / 最佳共性：', bad: '本月问题通病：', fix: '下月核心目标（1-3 条）：' }); };
    };
    $('#revFilter').onchange = refresh;
    $('#revInsight').onclick = genRevInsight;

    async function genRevInsight() {
      const list = await DB.all('reviews');
      if (!list.length) { toast('还没有复盘记录，先记几条吧'); return; }
      const scored = list.map(r => ({ r, s: RATING_SCORE[r.rating] || 3 }));
      scored.sort((a, b) => b.s - a.s);
      const best = scored.slice(0, 3).filter(x => x.r.rating && x.r.rating !== '未评').map(x => '· 《' + (x.r.title || '无标题') + '》[' + x.r.rating + (x.r.platform ? ('/' + x.r.platform) : '') + '] 亮点：' + (x.r.good || '—'));
      const worst = scored.slice(-3).reverse().filter(x => x.r.rating && x.r.rating !== '未评').map(x => '· 《' + (x.r.title || '无标题') + '》[' + x.r.rating + '] 不足：' + (x.r.bad || '—'));
      const dist = {}; list.forEach(r => { const k = r.rating || '未评'; dist[k] = (dist[k] || 0) + 1; });
      const distStr = REV_RATINGS.concat(['未评']).filter(k => dist[k]).map(k => k + ' ' + dist[k]).join(' / ');
      const pf = {}; list.forEach(r => { const p = r.platform || '其他'; pf[p] = (pf[p] || 0) + 1; });
      const pfStr = Object.keys(pf).map(p => p + ' ' + pf[p] + '条').join('、');
      const pfBomb = {}; list.forEach(r => { if (r.rating === '爆款') { const p = r.platform || '其他'; pfBomb[p] = (pfBomb[p] || 0) + 1; } });
      const pfBombStr = Object.keys(pfBomb).length ? Object.keys(pfBomb).map(p => p + ' ' + pfBomb[p] + '爆').join('、') : '暂无爆款';
      const fixes = list.map(r => r.fix).filter(Boolean).slice(0, 6);
      const avg = (list.reduce((s, r) => s + (RATING_SCORE[r.rating] || 3), 0) / list.length).toFixed(1);
      let one;
      if (dist['爆款']) one = '已经跑出爆款苗头🎉 把最佳那条的成功原因固化成你的「爆款模板」，下一批照着做，让好结果可复制。';
      else if (avg >= 4) one = '整体表现不错，重点是把「良好」往「爆款」推——挑一条复制它的开头和标题结构。';
      else if (avg <= 2.5) one = '还在摸索期很正常，多记录、多测试不同开头 / 标题 / 发布时间，规律会慢慢浮现，别急。';
      else one = '有起有伏，关键是把「最佳」和「最差」的原因写清楚，下次照着好的做、避开差的。';
      const text = '📊 内容复盘报告（共 ' + list.length + ' 条）\n\n' +
        '📈 表现分布：' + distStr + '\n' +
        '🏆 最佳（评级高）：\n' + (best.join('\n') || '（暂无评级）') + '\n\n' +
        '🔧 待改进（评级低）：\n' + (worst.join('\n') || '（暂无评级）') + '\n\n' +
        '📱 平台分布：' + pfStr + '\n' +
        '🔥 各平台爆款数：' + pfBombStr + '\n\n' +
        '💡 你写下的「下次动作」：\n' + (fixes.map((f, i) => (i + 1) + '. ' + f).join('\n') || '（暂无）') + '\n\n' +
        '—— 一句话 ——\n' + one;
      const mask = el('<div class="modal-mask"><div class="modal review-modal"><h3>📊 内容复盘报告</h3><div class="review-box"></div><div class="modal-actions"><button class="btn ghost grow" id="riClose">关闭</button><button class="btn ghost grow" id="riCopy">📋 复制</button><button class="btn grow" id="riSave">💾 存为备忘</button></div></div></div>');
      mask.querySelector('.review-box').textContent = text;
      document.body.append(mask); requestAnimationFrame(() => mask.classList.add('show'));
      const close = () => { mask.classList.remove('show'); setTimeout(() => mask.remove(), 250); };
      mask.querySelector('#riClose').onclick = close;
      mask.querySelector('#riCopy').onclick = () => {
        if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(() => toast('已复制 ✓')).catch(() => toast('复制失败')); }
        else { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.append(ta); ta.select(); try { document.execCommand('copy'); toast('已复制 ✓'); } catch (e) { toast('复制失败'); } ta.remove(); }
      };
      mask.querySelector('#riSave').onclick = async () => {
        await DB.put('memos', { title: '内容复盘报告 ' + todayStr(), body: text, tags: ['复盘', '内容复盘'].concat(autoClassify(text)), media: [], pinned: false, fav: false, createdAt: Date.now(), updatedAt: Date.now() });
        toast('已存为备忘 ✓'); close();
      };
    }

    refresh();
  }

  // 智能分类：根据内容自动打标签（纯前端关键词匹配，离线可用，不依赖外部 AI）
  function autoClassify(text) {
    const t = (text || '').toLowerCase();
    if (!t.trim()) return [];
    const CATS = {
      '副业': ['副业', '公众号', '短视频', '涨粉', '变现', '自媒体', '小红书', '抖音', '流量', '带货', '盈利', '赚钱', '创业', '选题', '标题党'],
      '越南语': ['越南语', '越南', '越语', '河内', '胡志明', 'hoaimy', '发音'],
      '英语': ['英语', '英文', 'english', '单词', '四六级', '雅思', '托福'],
      '学习': ['学习', '读书', '阅读', '课程', '备考', '考试', '笔记', '网课'],
      '健身': ['健身', '运动', '跑步', '瑜伽', '金刚功', '八段锦', '锻炼', '减肥', '拉伸', '体态'],
      '健康': ['健康', '睡眠', '失眠', '饮食', '养生', '医院', '身体', '头疼', '感冒', '体检'],
      '工作': ['工作', '面试', '简历', '招聘', '人事', '工资', '离职', '跳槽', '同事', '老板', '公积金'],
      '生活': ['生活', '家务', '购物', '买菜', '做饭', '旅行', '旅游', '快递', '装修', '搬家'],
      '情感': ['心情', '情绪', '焦虑', '开心', '难过', '家人', '朋友', '恋爱', '孤独', '压力', 'emo'],
      '灵感': ['灵感', '创意', '点子', '想法', '金句'],
      '待办': ['待办', '计划', '目标', '明天', '下周', '记得', '安排', '预约', '截止', '提醒'],
      '财务': ['钱', '理财', '存款', '收入', '支出', '预算', '攒钱', '花呗', '信用卡', '基金', '股票'],
    };
    const score = {};
    for (const cat in CATS) {
      let n = 0;
      for (const kw of CATS[cat]) if (t.includes(kw.toLowerCase())) n++;
      if (n) score[cat] = n;
    }
    let tags = Object.keys(score).sort((a, b) => score[b] - score[a]);
    if (tags.length > 3) tags = tags.slice(0, 3); // 最多 3 个，避免过碎
    if (!tags.length) tags = ['随记'];
    return tags;
  }

  // 5. 备忘录（升级版：极速记录 + 语音转文字 + 智能分类 + 搜索 + 图文 + 复盘 + 成文导出）
  async function renderMemo(view) {
    view.innerHTML =
      '<div class="memo-compose">' +
        '<textarea id="memoInput" placeholder="想到啥写啥，点 🎤 直接说话自动转文字；保存时按内容自动分类，不用您打标签"></textarea>' +
        '<div class="memo-compose-bar">' +
          '<button id="memoImg" class="btn ghost sm">🖼 图</button>' +
          '<button id="memoVoice" class="btn ghost sm">🎤 语音</button>' +
          '<button id="memoLink" class="btn ghost sm">🔗 链接</button>' +
          '<button id="memoSave" class="btn sm">记下来</button>' +
        '</div>' +
        '<input id="memoFile" type="file" accept="image/*" style="display:none"/>' +
      '</div>' +
      '<div class="memo-bar">' +
        '<input id="memoSearch" class="grow" placeholder="🔍 搜标题 / 内容 / 标签"/>' +
        '<button id="memoMulti" class="btn ghost sm">✅ 多选</button>' +
        '<button id="memoReview" class="btn ghost sm">🧠 复盘</button>' +
      '</div>' +
      '<div id="memoTags" class="memo-tags"></div>' +
      '<div class="memo-list-head">' +
        '<button id="memoListToggle" class="memo-list-toggle">📋 已记 <b id="memoCount">0</b> 条 <span id="memoChev">▾</span></button>' +
        '<button id="memoExpand" class="btn ghost sm" style="display:none"></button>' +
      '</div>' +
      '<div id="memoList" class="memo-list"></div>' +
      '<div id="memoExportBar" class="memo-export" style="display:none">' +
        '<span class="muted">已选 <b id="memoSelCount">0</b> 条</span>' +
        '<button id="memoExport" class="btn sm">📄 合并成文 / 导出</button>' +
      '</div>';

    let curTags = [];
    let curQuery = '';
    let selMode = false;
    const selIds = new Set();
    let pendingMedia = [];
    let listCollapsed = false;
    let listExpanded = false;
    const MEMO_LIMIT = 8;

    function parseTags(text) {
      const out = []; const re = /#([^\s#]+)/g; let mm;
      while ((mm = re.exec(text))) { const t = mm[1].replace(/[，。、,!！?？；;]/g, ''); if (t) out.push(t); }
      return out;
    }
    function fileToDataURL(file) {
      return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
    }

    async function load() {
      let list = await DB.all('memos');
      list.forEach(m => { m.tags = m.tags || []; m.media = m.media || []; });
      if (curQuery) {
        const q = curQuery.toLowerCase();
        list = list.filter(m => (m.title || '').toLowerCase().includes(q) || (m.body || '').toLowerCase().includes(q) || m.tags.join(' ').toLowerCase().includes(q));
      }
      if (curTags.length) list = list.filter(m => curTags.every(t => m.tags.includes(t)));
      list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
      const total = list.length;
      $('#memoCount').textContent = total;
      const chev = $('#memoChev'); if (chev) chev.textContent = listCollapsed ? '▸' : '▾';
      const expBtn = $('#memoExpand');
      if (total > MEMO_LIMIT) {
        expBtn.style.display = '';
        expBtn.textContent = listExpanded ? '收起到 ' + MEMO_LIMIT + ' 条' : '展开全部 ' + total + ' 条';
      } else { expBtn.style.display = 'none'; }
      const listEl = $('#memoList');
      if (listCollapsed) { listEl.style.display = 'none'; listEl.innerHTML = ''; return; }
      listEl.style.display = '';
      const shown = (!listExpanded && total > MEMO_LIMIT) ? list.slice(0, MEMO_LIMIT) : list;
      renderList(shown);
    }

    function renderTags() {
      DB.all('memos').then(all => {
        const set = {}; all.forEach(m => (m.tags || []).forEach(t => set[t] = 1));
        const box = $('#memoTags');
        const chips = Object.keys(set).map(t => '<span class="memo-chip' + (curTags.includes(t) ? ' on' : '') + '" data-t="' + esc(t) + '">#' + esc(t) + '</span>').join('');
        box.innerHTML = (curTags.length ? '<span class="memo-chip clear" data-t="">✕ 清除</span>' : '') + chips;
        box.querySelectorAll('.memo-chip').forEach(c => c.onclick = () => {
          const t = c.dataset.t;
          if (!t) { curTags = []; } else { curTags.includes(t) ? curTags.splice(curTags.indexOf(t), 1) : curTags.push(t); }
          load();
        });
      });
    }

    function renderList(list) {
      const box = $('#memoList');
      if (!list.length) { box.innerHTML = emptyTip('📝', curQuery || curTags.length ? '没有匹配的备忘' : '随手记点什么'); return; }
      box.innerHTML = '';
      list.forEach(m => {
        const card = el('<div class="memo-card"></div>');
        const tagsHtml = m.tags.map(t => '<span class="memo-tag">#' + esc(t) + '</span>').join('');
        const mediaHtml = m.media.map(md => {
          if (md.type === 'image') return '<img class="memo-media" src="' + md.data + '"/>';
          if (md.type === 'voice') return '<audio class="memo-media" controls src="' + md.data + '"></audio>';
          if (md.type === 'link') return '<a class="memo-link" href="' + esc(md.url) + '" target="_blank" onclick="event.stopPropagation()">🔗 ' + esc(md.url) + '</a>';
          return '';
        }).join('');
        card.innerHTML =
          '<div class="memo-head">' +
            (selMode ? '<input type="checkbox" class="memo-check"' + (selIds.has(m.id) ? ' checked' : '') + '/>' : (m.fav ? '<span class="memo-star">⭐</span>' : '')) +
            '<h4 class="memo-title">' + esc(m.title || '（无标题）') + '</h4>' +
            (m.pinned ? '<span class="memo-pin" title="已置顶">📌</span>' : '') +
            '<span class="memo-ops">' +
              '<button class="memo-op" data-act="pin">' + (m.pinned ? '📌' : '📍') + '</button>' +
              '<button class="memo-op" data-act="fav">' + (m.fav ? '⭐' : '☆') + '</button>' +
              '<button class="memo-op" data-act="del">🗑</button>' +
            '</span>' +
          '</div>' +
          (m.body ? '<p class="memo-body">' + esc(m.body) + '</p>' : '') +
          (mediaHtml ? '<div class="memo-media-wrap">' + mediaHtml + '</div>' : '') +
          (tagsHtml ? '<div class="memo-tags-inline">' + tagsHtml + '</div>' : '') +
          '<div class="memo-meta">' + esc(m.updatedAt ? new Date(m.updatedAt).toLocaleString('zh-CN') : '') + '</div>';

        card.querySelectorAll('.memo-op').forEach(btn => btn.onclick = async (e) => {
          e.stopPropagation();
          const act = btn.dataset.act;
          if (act === 'del') { if (await confirmDel('删除这条备忘？')) { await DB.del('memos', m.id); if (selIds.has(m.id)) selIds.delete(m.id); load(); } }
          else if (act === 'pin') { m.pinned = !m.pinned; m.updatedAt = Date.now(); await DB.put('memos', m); load(); }
          else if (act === 'fav') { m.fav = !m.fav; m.updatedAt = Date.now(); await DB.put('memos', m); load(); }
        });

        card.onclick = async (e) => {
          if (selMode) {
            const cb = e.target.closest('.memo-check');
            if (cb) { cb.checked ? selIds.add(m.id) : selIds.delete(m.id); updateSelCount(); return; }
            return;
          }
          if (e.target.closest('a') || e.target.closest('.memo-op') || e.target.closest('.memo-check')) return;
          const f = await promptForm('编辑备忘', [
            { name: 'title', label: '标题', value: m.title || '' },
            { name: 'body', label: '内容', type: 'textarea', value: m.body || '' },
            { name: 'tags', label: '标签（空格或 # 隔开）', value: m.tags.join(' ') },
          ]);
          if (f) {
            m.title = f.title; m.body = f.body;
            const manualTags = parseTags(f.tags + ' ' + f.body + ' ' + f.title);
            m.tags = [...new Set(manualTags.concat(autoClassify(f.title + ' ' + f.body)))];
            m.updatedAt = Date.now();
            await DB.put('memos', m); load();
          }
        };
        box.append(card);
      });
    }

    function updateSelCount() {
      $('#memoSelCount').textContent = selIds.size;
      $('#memoExportBar').style.display = (selMode && selIds.size) ? '' : 'none';
    }

    // 极速记录
    $('#memoSave').onclick = async () => {
      const text = $('#memoInput').value.trim();
      if (!text && !pendingMedia.length) { toast('写点啥，或加点图片 / 链接'); return; }
      const manualTags = parseTags(text);
      const autoTags = autoClassify(text);
      const tags = [...new Set(manualTags.concat(autoTags))];
      const rawFirst = (text.split('\n')[0] || '').trim();
      const title = rawFirst.replace(/#\S+/g, '').trim().slice(0, 40) || (pendingMedia.length ? '（媒体备忘）' : '（无标题）');
      const m = { title: title, body: text, tags: tags, media: pendingMedia.slice(), pinned: false, fav: false, createdAt: Date.now(), updatedAt: Date.now() };
      const id = await DB.put('memos', m);
      m.id = id;
      pendingMedia = [];
      $('#memoInput').value = '';
      toast('已记下 ✓ 自动归类：#' + tags.join(' #'));
      load();
    };
    $('#memoInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); $('#memoSave').click(); }
    });

    // 图片
    $('#memoImg').onclick = () => $('#memoFile').click();
    $('#memoFile').onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      pendingMedia.push({ type: 'image', data: await fileToDataURL(file) });
      toast('已加图片，点「记下来」保存');
      e.target.value = '';
    };

    // 语音输入（说话直接转成文字，保留打字）
    let recog = null, voiceOn = false, voiceBase = '', finalTranscript = '';
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    $('#memoVoice').onclick = () => {
      if (!SR) { toast('当前浏览器不支持语音输入，请直接打字'); return; }
      if (!voiceOn) {
        try {
          recog = new SR();
          recog.lang = 'zh-CN';
          recog.continuous = true;
          recog.interimResults = true;
          voiceBase = $('#memoInput').value;
          finalTranscript = '';
          recog.onresult = (e) => {
            let interim = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
              const r = e.results[i];
              if (r.isFinal) finalTranscript += r[0].transcript; else interim += r[0].transcript;
            }
            $('#memoInput').value = voiceBase + finalTranscript + interim;
          };
          recog.onerror = (e) => { toast('语音识别出错：' + (e.error || '未知错误')); };
          recog.onend = () => {
            voiceOn = false;
            $('#memoVoice').textContent = '🎤 语音';
            $('#memoVoice').classList.remove('listening');
            $('#memoInput').value = voiceBase + finalTranscript;
          };
          recog.start();
          voiceOn = true;
          $('#memoVoice').textContent = '⏹ 停止';
          $('#memoVoice').classList.add('listening');
        } catch (err) { toast('语音不可用：' + (err && err.message ? err.message : err)); }
      } else {
        try { recog.stop(); } catch (_) {}
      }
    };

    // 链接
    $('#memoLink').onclick = () => {
      const url = prompt('粘贴链接（网页 / 文章 / 视频）：');
      if (!url) return;
      pendingMedia.push({ type: 'link', url: url, data: '' });
      toast('已加链接，点「记下来」保存');
    };

    // 搜索
    $('#memoSearch').addEventListener('input', (e) => { curQuery = e.target.value.trim(); load(); });

    // 多选
    $('#memoMulti').onclick = () => {
      selMode = !selMode;
      if (!selMode) selIds.clear();
      $('#memoMulti').textContent = selMode ? '✅ 取消多选' : '✅ 多选';
      updateSelCount();
      load();
    };
    $('#memoExport').onclick = () => doExport();

    // 复盘
    $('#memoReview').onclick = () => doReview();

    // 列表折叠 / 展开全部
    $('#memoListToggle').onclick = () => { listCollapsed = !listCollapsed; load(); };
    $('#memoExpand').onclick = () => { listExpanded = !listExpanded; load(); };

    load();
  }

  // 复盘：扫描全部备忘，生成近期摘要（纯前端统计，离线可用）
  async function computeReview() {
    const list = await DB.all('memos');
    const total = list.length;
    const tagCount = {};
    list.forEach(m => (m.tags || []).forEach(t => tagCount[t] = (tagCount[t] || 0) + 1));
    const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const now = Date.now();
    const week = list.filter(m => (m.updatedAt || m.createdAt || 0) > now - 7 * 864e5).length;
    const days = new Set(list.map(m => new Date(m.updatedAt || m.createdAt).toLocaleDateString('zh-CN')));
    const recent = list.slice().sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)).slice(0, 5).map(m => '· ' + esc((m.title || m.body || '').slice(0, 30)));
    let s = '';
    s += '📊 你一共记了 ' + total + ' 条备忘\n';
    s += '🗓 最近 7 天记了 ' + week + ' 条\n';
    s += '📅 累计在 ' + days.size + ' 天里记过东西\n';
    if (topTags.length) s += '🏷 最近常想的主题：' + topTags.map(t => '#' + t[0] + '(' + t[1] + ')').join('、') + '\n';
    if (recent.length) s += '💡 最近的几条：\n' + recent.join('\n') + '\n';
    s += '\n👉 一句话：你最近主要在琢磨 ' + (topTags.length ? topTags.slice(0, 3).map(t => '#' + t[0]).join('、') : '各种事') + '，保持记录，想法会越来越清楚！';
    return s;
  }

  async function doReview() {
    const summary = await computeReview();
    const mask = el('<div class="modal-mask"><div class="modal review-modal"><h3>🧠 近期复盘</h3><div class="review-box"></div><div class="modal-actions"><button class="btn ghost grow" id="rClose">关闭</button><button class="btn ghost grow" id="rCopy">📋 复制</button><button class="btn grow" id="rSave">💾 存为备忘</button></div></div></div>');
    mask.querySelector('.review-box').textContent = summary;
    document.body.append(mask);
    requestAnimationFrame(() => mask.classList.add('show'));
    function close() { mask.classList.remove('show'); setTimeout(() => mask.remove(), 250); }
    mask.onclick = (e) => { if (e.target === mask) close(); };
    mask.querySelector('#rClose').onclick = close;
    mask.querySelector('#rCopy').onclick = async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(summary); toast('已复制 ✓'); }
        else { const ta = document.createElement('textarea'); ta.value = summary; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('已复制 ✓'); }
      } catch (_) { toast('复制失败，请手动选择文字'); }
    };
    mask.querySelector('#rSave').onclick = async () => {
      await DB.put('memos', { title: '复盘 ' + new Date().toLocaleDateString('zh-CN'), body: summary, tags: ['复盘'].concat(autoClassify(summary)), media: [], pinned: false, fav: false, createdAt: Date.now(), updatedAt: Date.now() });
      toast('复盘已存为备忘 ✓'); close();
    };
  }

  // 多选合并成文 + 导出（Markdown 下载 + 复制长文）
  async function doExport() {
    const all = await DB.all('memos');
    const pick = all.filter(m => selIds.has(m.id));
    if (!pick.length) { toast('先多选几条再合并'); return; }
    pick.sort((a, b) => (a.createdAt || a.updatedAt || 0) - (b.createdAt || b.updatedAt || 0));
    let md = '# 备忘合集（' + pick.length + ' 条）\n\n';
    pick.forEach(m => {
      if (m.title) md += '## ' + m.title + '\n';
      if (m.tags && m.tags.length) md += '*标签：' + m.tags.map(t => '#' + t).join(' ') + '*\n\n';
      if (m.body) md += m.body + '\n\n';
      (m.media || []).forEach(mm => { if (mm.type === 'image') md += '![图片](' + (mm.data && mm.data.slice(0, 30)) + '...)\n'; });
    });
    const plain = md.replace(/^#+\s*/gm, '').replace(/\*标签[^*]*\*/g, '').replace(/!\[图片\][^\n]*/g, '[图片]');
    try { await navigator.clipboard.writeText(plain); toast('已复制成长文，去公众号粘贴吧'); } catch (e) { toast('复制失败，可改用下载的 MD 文件'); }
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '备忘合集_' + new Date().toLocaleDateString('zh-CN') + '.md';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // 6. 尤克里里
  // 6. 尤克里里 — 按阶段自动推荐 + 技能点详情 + 视频入口（参考胡楚靓工作台）
  async function renderUke(view) {
    const meta = await DB.get('meta', 'ukeStages');
    const doneStages = (meta && meta.value) || [];
    const curStage = () => { for (let i = 0; i < UKE_STAGES.length; i++) if (!doneStages.includes(i)) return i; return UKE_STAGES.length; };
    view.innerHTML =
      '<div class="card uke-route"><div class="row spread uke-route-top">' +
        '<div><div class="uke-route-title">🎻 进阶路线</div><div class="muted" id="routeInfo"></div></div>' +
        '<button id="reset" class="btn ghost sm">重置进度</button></div>' +
      '<div class="progress" style="margin:10px 0"><i id="routeBar"></i></div>' +
      '<div id="routeList"></div></div>' +
      '<div class="card"><div class="card-title">📅 今日练习 <span class="muted" id="todayStage" style="font-size:13px"></span></div>' +
        '<p class="muted" style="margin:0 0 10px">根据当前阶段自动推荐，完成就打勾，每天自动重置。</p>' +
        '<div id="ukeRate" style="margin-bottom:10px"></div>' +
        '<div id="exList"></div></div>';
    const cs = curStage(), mastered = doneStages.length;
    $('#routeInfo').textContent = '已掌握 ' + mastered + '/' + UKE_STAGES.length + ' 阶段' + (cs < UKE_STAGES.length ? ' ｜ 当前：' + UKE_STAGES[cs].t : ' ｜ 全部完成 🎉');
    $('#todayStage').textContent = cs < UKE_STAGES.length ? '（' + UKE_STAGES[cs].t + '）' : '';
    $('#routeBar').style.width = Math.round(mastered / UKE_STAGES.length * 100) + '%';
    const rl = $('#routeList');
    UKE_STAGES.forEach((s, i) => {
      const isDone = doneStages.includes(i), isCur = i === cs, locked = i > cs;
      const row = el('<div class="stage-row' + (isDone ? ' done' : '') + (locked ? ' locked' : '') + '"></div>');
      row.innerHTML =
        '<div class="stage-head"><div class="stage-dot">' + (isDone ? '✓' : (locked ? '🔒' : (i + 1))) + '</div>' +
        '<div class="grow"><b>' + esc(s.t) + '</b>' + (isCur ? '<span class="chip stage-cur">进行中</span>' : (locked ? '<span class="chip stage-lock">未解锁</span>' : '')) +
        '<p class="muted" style="margin:2px 0 0;font-size:13px">' + esc(s.d) + '</p></div>' +
        '<span class="stage-arrow">▾</span></div><div class="stage-detail" style="display:none"></div>';
      rl.append(row);
      const detail = row.querySelector('.stage-detail');
      s.skills.forEach(sk => {
        const sc = el('<div class="skill-card"></div>');
        sc.innerHTML = '<b>' + esc(sk.title) + '</b>' +
          '<p class="muted" style="margin:4px 0">' + esc(sk.desc) + '</p>' +
          '<div class="skill-meta"><span>🎯 目标：' + esc(sk.goal) + '</span><span>✅ 过关：' + esc(sk.pass) + '</span></div>' +
          '<div class="row skill-actions">' +
          '<button class="btn sm ghost sk-bili">▶ 看教学视频</button>' +
          '<button class="btn sm ghost sk-bili2">B站搜更多</button>' +
          '<button class="btn sm ghost sk-dy">抖音跟练</button></div>';
        sc.querySelector('.sk-bili').onclick = () => openLink('https://search.bilibili.com/all?keyword=' + encodeURIComponent(sk.title + ' 尤克里里'));
        sc.querySelector('.sk-bili2').onclick = () => openLink('https://search.bilibili.com/all?keyword=' + encodeURIComponent('尤克里里 ' + sk.title + ' 教程'));
        sc.querySelector('.sk-dy').onclick = () => openLink('https://www.douyin.com/search/' + encodeURIComponent(sk.title + ' 尤克里里'));
        detail.append(sc);
      });
      if (isCur) {
        const mb = el('<button class="btn green block sk-master" style="margin-top:8px">✓ 标记掌握（已达过关标准）</button>');
        mb.onclick = async () => {
          const arr = doneStages.slice(); if (!arr.includes(i)) arr.push(i);
          await DB.put('meta', { id: 'ukeStages', value: arr });
          toast('🎉 第' + (i + 1) + '阶段已掌握！'); renderUke(view);
        };
        detail.append(mb);
      }
      row.querySelector('.stage-head').onclick = () => {
        const open = detail.style.display !== 'none';
        detail.style.display = open ? 'none' : 'block';
        row.querySelector('.stage-arrow').style.transform = open ? '' : 'rotate(180deg)';
      };
    });
    $('#reset').onclick = async () => { if (await confirmDel('确定重置所有阶段进度？')) { await DB.put('meta', { id: 'ukeStages', value: [] }); renderUke(view); } };
    // 今日练习（当前阶段 daily 自动推荐）
    const stage = UKE_STAGES[cs];
    let dailyRec = (await DB.all('uke')).find(r => r.type === 'daily' && r.date === todayStr());
    let checks = (dailyRec && dailyRec.checks) || {};
    async function saveChecks() {
      dailyRec = (await DB.all('uke')).find(r => r.type === 'daily' && r.date === todayStr());
      if (dailyRec) { dailyRec.checks = checks; await DB.put('uke', dailyRec); }
      else { await DB.put('uke', { id: 'daily_' + todayStr(), date: todayStr(), type: 'daily', checks: checks }); }
    }
    function renderRate() {
      const items = stage ? stage.daily : [];
      const total = items.length, done = total ? items.filter((_, idx) => checks[idx]).length : 0;
      const pct = total ? Math.round(done / total * 100) : 0;
      $('#ukeRate').innerHTML = '<div class="row spread" style="margin-bottom:6px"><span class="muted">今日完成</span><span class="rate-num" style="font-size:18px">' + done + '/' + total + '</span></div>' +
        '<div class="progress"><i style="width:' + pct + '%"></i></div>';
    }
    function renderEx() {
      const list = $('#exList'); list.innerHTML = '';
      const items = stage ? stage.daily : [];
      if (!items.length) { list.innerHTML = '<p class="empty-sm">已完成全部阶段，自由练习吧 🎉</p>'; renderRate(); return; }
      items.forEach((ex, idx) => {
        const done = !!checks[idx];
        const row = el('<div class="task' + (done ? ' done' : '') + '"></div>');
        row.innerHTML = '<div class="check' + (done ? ' done' : '') + '">' + (done ? '✓' : '') + '</div>' +
          '<div class="task-text"><div>' + esc(ex.text) + '</div>' +
          '<div class="muted" style="font-size:13px">约 ' + ex.min + ' 分钟 · ' + esc(ex.note || '') + '</div></div>';
        row.querySelector('.check').onclick = async () => {
          if (done) delete checks[idx]; else checks[idx] = true;
          await saveChecks(); renderEx(); renderRate();
        };
        list.append(row);
      });
    }
    renderEx(); renderRate();
  }

  // 7. 英语
      // 导游口语练习数据：长情景对话（每个场景多轮来回，像真实带团）
  // 结构：scene=场景名, icon=图标, dialogues=[{role,lines,zh}], keyPhrases=[{en,zh}]
  const EN_GUIDE = [
    {
      scene: '帮客户订酒店', icon: '🏨',
      dialogues: [
        { role:'You',  lines:['Good morning, Mr. Smith!','Have you settled in well?',"How's the hotel?"], zh:['早上好，Smith 先生！','您安顿好了吗？','酒店怎么样？'] },
        { role:'Client',lines:['Good morning! Yes, the room is lovely.','Thank you for arranging it.'], zh:['早上好！是的，房间很棒。','谢谢您安排。'] },
        { role:'You',  lines:["I'm glad you like it. I chose a room with a city view —",'the night scenery here is quite beautiful.'], zh:['很高兴您喜欢。我选了一间有城市景观的房间——','这里的夜景很美。'] },
        { role:'Client',lines:['Oh, I noticed! The skyline at night is stunning.','Great choice!'], zh:['哦，我注意到了！夜晚的天际线太美了。','选得好！'] },
        { role:'You',  lines:['If you need anything — laundry, gym access,','or restaurant recommendations — just let me know.'], zh:['如果您需要任何服务——洗衣、健身房、','或者餐厅推荐——尽管告诉我。'] },
        { role:'Client',lines:['Thank you, I really appreciate it.'], zh:['谢谢，非常感激。'] }
      ],
      keyPhrases:[{en:'settle in',zh:'安顿下来'},{en:'city view',zh:'城市景观'},{en:"I'm happy to help",zh:'我很乐意帮忙'}]
    },
    {
      scene: '机场接机', icon: '✈️',
      dialogues: [
        { role:'You',  lines:["Excuse me, are you Mr. Johnson from Australia?",'Welcome to China! I\'m your tour guide.'], zh:['请问，您是从澳大利亚来的 Johnson 先生吗？','欢迎来到中国！我是您的导游。'] },
        { role:'Client',lines:["Yes, that's me. Nice to meet you!",'Thank you for coming to pick me up.'], zh:['是我，很高兴见到你！','谢谢你来接我。'] },
        { role:'You',  lines:['My pleasure! How was your flight?',"I hope it wasn't too tiring."], zh:['我的荣幸！旅途怎么样？','希望不会太累。'] },
        { role:'Client',lines:['It was long but comfortable. I managed to sleep a bit.'], zh:['挺长的但还算舒服，我睡了一会儿。'] },
        { role:'You',  lines:['Great. Your luggage should be at Belt 7. Let me help you with that. ','Our bus is waiting outside — we\'ll head to the hotel first.'], zh:['很好。您的行李应该在 7 号传送带，我来帮您拿。','我们的大巴在外面等——先去酒店。'] },
        { role:'Client',lines:["Perfect. By the way, what's the weather like here?"], zh:['好的。顺便问一下，这边天气怎么样？'] },
        { role:'You',  lines:["It's warm and sunny today, around 28 degrees.",'Perfect sightseeing weather! Let\'s go.'], zh:['今天温暖晴朗，大概 28 度。','非常适合观光的天气！我们走吧。'] }
      ],
      keyPhrases:[{en:'pick someone up',zh:'接人'},{en:'luggage / baggage',zh:'行李'},{en:'sightseeing',zh:'观光游览'}]
    },
    {
      scene: '景点讲解·古镇', icon: '🏯',
      dialogues: [
        { role:'You',  lines:['Everyone, please gather round. We\'ve arrived at Water Town. ','This town has over 1,000 years of history.'], zh:['各位请聚过来一下。我们到了水镇。','这个小镇有一千多年的历史了。'] },
        { role:'Client',lines:['Wow, look at those stone bridges! They\'re beautiful.'], zh:['哇，看那些石桥！真漂亮。'] },
        { role:'You',  lines:['These are called "arched stone bridges." ','The most famous one is Rainbow Bridge — shall we walk across it?'], zh:['这些叫「拱石桥」。','最有名的是彩虹桥——我们走过去看看？'] },
        { role:'Client',lines:['Yes, please! What are those boats in the canal?'], zh:['好呀！运河里那些船是什么？'] },
        { role:'You',  lines:['Those are traditional wooden boats called wupeng boats. ','Locals used them for fishing and transport. Now they\'re mainly for tourists.'], zh:['那些是传统的木船，叫乌篷船。','当地人以前用来打鱼和运输。现在主要载游客。'] },
        { role:'Client',lines:['Can we take a boat ride later?'], zh:['我们待会儿能坐船吗？'] },
        { role:'You',  lines:['Absolutely! We have a boat ride scheduled at 4 PM. ','It\'s especially magical at sunset — the lanterns light up along the river.'], zh:['当然可以！我们安排了下午 4 点坐船。','日落时特别迷人——沿河的灯笼都会亮起来。'] }
      ],
      keyPhrases:[{en:'gather round',zh:'聚拢过来'},{en:'arched bridge',zh:'拱桥'},{en:'scheduled',zh:'已安排/已排定'}]
    },
    {
      scene: '餐饮推荐·本地菜', icon: '🍜',
      dialogues: [
        { role:'You',  lines:["It's almost lunchtime. Are you hungry? ","I know a great local restaurant nearby."], zh:['快到午饭时间了。你们饿了吗？','我知道附近一家很棒的本地餐馆。'] },
        { role:'Client',lines:["Yes, I'm starving! What do you recommend?"], zh:['饿坏了！你推荐什么？'] },
        { role:'You',  lines:['This region is famous for spicy hot pot and dumplings. ','If you can handle spicy food, the hot pot is a must-try.'], zh:['这个地区以麻辣火锅和饺子闻名。','如果你们能吃辣，火锅一定要试。'] },
        { role:'Client',lines:['I love spicy food! But is there anything... less adventurous?','My wife prefers something mild.'], zh:['我喜欢吃辣！但是有没有……不那么刺激的？','我太太偏好清淡的。'] },
        { role:'You',  lines:['Of course! For mild options, I recommend steamed fish ','with ginger and scallion, or braised pork belly. Both are delicious.'], zh:['当然可以！清淡的话，我推荐清蒸鱼','加姜葱，或者红烧肉。都很好吃。'] },
        { role:'Client',lines:['Sounds perfect. Do they have an English menu?'], zh:['听起来不错。他们有英文菜单吗？'] },
        { role:'You',  lines:['They do, but I can also order for you if you like. ','I\'ll explain each dish before it comes.'], zh:['有的，不过如果您愿意我也可以帮你们点菜。','每道菜上来前我会介绍。'] }
      ],
      keyPhrases:[{en:'must-try',zh:'必尝'},{en:'mild option',zh:'清淡选择'},{en:'braised',zh:'红烧/炖'}]
    },
    {
      scene: '购物陪同·纪念品', icon: '🛍️',
      dialogues: [
        { role:'Client',lines:['I want to buy some souvenirs for my family. Any suggestions?'], zh:['我想给家人买些纪念品。有什么建议吗？'] },
        { role:'You',  lines:['Great idea! This market is famous for silk, tea, and handicrafts. ','Let me show you around.'], zh:['好主意！这个市场以丝绸、茶叶和手工艺品闻名。','我带你们转转。'] },
        { role:'Client',lines:['This silk scarf is beautiful. How much is it?'], zh:['这条丝巾真漂亮。多少钱？'] },
        { role:'You',  lines:['The starting price is 200 yuan, but you can bargain. ','Try offering 120 yuan first — don\'t worry, it\'s expected here.'], zh:['开价是 200 元，不过可以讲价。','先试着出 120 元——别担心，这里都这样。'] },
        { role:'Client',lines:['Really? I feel bad bargaining. Is that rude?'], zh:['真的吗？讲价感觉不太好意思。会不会不礼貌？'] },
        { role:'You',  lines:['Not at all! Bargaining is part of the culture here. ','Shop owners actually enjoy it — just keep it friendly and smile.'], zh:['完全不会！讲价是这里文化的一部分。','店主其实很享受这个过程——保持友好、多笑就行。'] },
        { role:'Client',lines:["Alright, I'll try. Can you help me check if this silk is real?"], zh:['好吧，我试试。你能帮我看看这丝绸是不是真的吗？'] },
        { role:'You',  lines:['Sure. Real silk feels cool to the touch and has a subtle luster. ','Let me show you the authenticity label... Yes, this is genuine.'], zh:['当然。真丝摸起来凉凉的有微妙的光泽。','让我看一下鉴定标签……嗯，这是真的。'] }
      ],
      keyPhrases:[{en:'bargain',zh:'讲价/砍价'},{en:'authenticity',zh:'真实性/正品'},{en:'genuine',zh:'真的/正宗'}]
    },
    {
      scene: '处理游客投诉', icon: '⚠️',
      dialogues: [
        { role:'Client',lines:["I need to speak to you. I'm very unhappy with the hotel."], zh:['我要跟你谈谈。我对这家酒店很不满意。'] },
        { role:'You',  lines:["I'm sorry to hear that. Please tell me what happened, ","and I'll do my best to resolve it."], zh:['听到这个我很抱歉。请告诉我发生了什么，','我会尽力解决。'] },
        { role:'Client',lines:["The air conditioner in my room isn't working, ","and I asked twice but nobody came to fix it."], zh:['我房间空调坏了，','我叫了两次都没人来修。'] },
        { role:'You',  lines:["That's completely unacceptable. I apologize for the inconvenience. ","Let me call the manager right now."], zh:['这完全不能接受。给您带来不便我道歉。','我现在就给经理打电话。'] },
        { role:'You',  lines:["(on phone) Hello, this is the tour guide for Room 1205. ","My guest's AC has been broken for two days. Please send someone immediately."], zh:['（电话中）您好，我是 1205 房间客人的导游。','空调坏了两天了，请立刻派人过来。'] },
        { role:'You',  lines:['The manager apologizes and says a technician will be there in 10 minutes. ','In the meantime, would you like me to arrange a different room?'], zh:['经理道歉了，说技术人员 10 分钟内到。','这期间要不要我帮您换一间房？'] },
        { role:'Client',lines:['Thank you. I appreciate your quick response.'], zh:['谢谢，感谢你这么快处理。'] }
      ],
      keyPhrases:[{en:'resolve a problem',zh:'解决问题'},{en:'inconvenience',zh:'不便'},{en:'quick response',zh:'快速响应'}]
    },
    {
      scene: '紧急情况·医疗', icon: '🏥',
      dialogues: [
        { role:'Client',lines:["Guide... I don't feel well. My stomach hurts badly."], zh:['导游……我不舒服。胃很痛。'] },
        { role:'You',  lines:['Oh no! How long have you been feeling this way? ','Did you eat anything unusual today?'], zh:['天哪！这种情况多久了？','今天吃了什么不寻常的东西吗？'] },
        { role:'Client',lines:['It started after lunch. Maybe the street food...'], zh:['午饭后开始的。可能是路边摊……'] },
        { role:'You',  lines:["Don't worry, I'm taking you to the hospital right now. ","There's an international medical center 15 minutes from here."], zh:['别担心，我现在就带你去医院。','离这儿 15 分钟有个国际医疗中心。'] },
        { role:'You',  lines:['(to driver) Please drive to United Family Hospital, as fast as safely possible.'], zh:['（对司机）请开车去和睦家医院，在安全前提下尽快。'] },
        { role:'You',  lines:["We're almost there. The hospital has English-speaking doctors, ","so communication won't be a problem. I'll stay with you the whole time."], zh:['快到了。医院有会说英语的医生，','沟通不会有问题。我会一直陪着您。'] },
        { role:'Client',lines:['Thank you so much. I don\'t know what I\'d do without you.'], zh:['太感谢了。没有你我都不知道该怎么办。'] }
      ],
      keyPhrases:[{en:'international medical center',zh:'国际医疗中心'},{en:'English-speaking doctor',zh:'会英语的医生'},{en:'as fast as safely possible',zh:'安全前提下尽快'}]
    },
    {
      scene: '跨文化·中东客户', icon: '🕌',
      dialogues: [
        { role:'You',  lines:["Mr. Hassan, I'd like to confirm: are there any dietary restrictions ","I should know about for our group meals?"], zh:['Hassan 先生，我想确认一下：团队用餐有什么饮食禁忌','我应该知道的吗？'] },
        { role:'Client',lines:['Yes, thank you for asking. We don\'t eat pork, ','and all meat must be halal.'], zh:['好的，谢谢你问。我们不吃猪肉，','而且所有肉类必须是清真食品。'] },
        { role:'You',  lines:["Understood. I've already arranged halal-certified restaurants for all meals. ","Also, I noticed prayer times — there's a quiet prayer room ","at each venue we're visiting. Would that be helpful?"], zh:['明白了。我已经安排了所有餐食都在清真认证餐厅。','另外，我注意到祷告时间——','我们要去的每个景点都有安静的祷告室。这会有帮助吗？'] },
        { role:'Client',lines:["That's very thoughtful of you. Yes, we pray five times a day."], zh:['你想得很周到。是的，我们每天做五次礼拜。'] },
        { role:'Client',lines:['One more thing — in my culture, men and women don\'t usually ','shake hands unless they know each other well.'], zh:['还有一件事——在我的文化里，男女通常','不握手，除非彼此很熟悉。'] },
        { role:'You',  lines:['Thank you for letting me know. I\'ll make sure to respect that ','and brief the other staff as well. Is there anything else?'], zh:['谢谢您告诉我。我会确保尊重这一点','并告知其他工作人员。还有别的吗？'] },
        { role:'Client',lines:["No, that's all. You're very professional."], zh:['没了，就这些。你很专业。'] }
      ],
      keyPhrases:[{en:'dietary restriction',zh:'饮食禁忌'},{en:'halal',zh:'清真'},{en:'prayer room',zh:'祷告室'}]
    },
    {
      scene: '跨文化·日本客户', icon: '🗾',
      dialogues: [
        { role:'You',  lines:['Tanaka-san, welcome! I hope your flight was comfortable.'], zh:['田中先生，欢迎！希望您旅途舒适。'] },
        { role:'Client',lines:['Yes, it was fine. Thank you for having us.'], zh:['还好，谢谢接待。'] },
        { role:'You',  lines:["I've prepared a detailed itinerary for the next five days. ","Please take a look and let me know if you'd like any adjustments."], zh:['我准备了接下来五天的详细行程表。','请过目，有任何想调整的告诉我。'] },
        { role:'Client',lines:['(bowing slightly) Thank you. We appreciate thorough planning.'], zh:['（微微鞠躬）谢谢。我们欣赏周全的计划。'] },
        { role:'You',  lines:["Also, I'd like to mention: in Chinese culture, we often use two hands ","when giving or receiving business cards or gifts. It shows respect."], zh:['另外我想提一下：在中国文化里，递接名片或礼物时常用双手，','这是表示尊重。'] },
        { role:'Client',lines:['Ah, similar to Japan! We also value respect through small gestures.'], zh:['啊，跟日本很像！我们也重视通过小动作表达尊重。'] },
        { role:'You',  lines:['Yes, I think our cultures share many values. One difference though — ','Chinese people may offer food multiple times as hospitality. ','It\'s polite to accept at least a little.'], zh:['是的，我觉得我们文化有很多共同点。不过有一个区别——','中国人可能会多次劝菜表示好客。','至少接受一点是礼貌的。'] },
        { role:'Client',lines:['I see. I\'ll remember that. Arigatou gozaimasu.'], zh:['明白了。我会记住的。非常感谢。'] }
      ],
      keyPhrases:[{en:'itinerary',zh:'行程表'},{en:'thorough',zh:'周全/详尽'},{en:'hospitality',zh:'好客/款待'}]
    },
    {
      scene: '送别客人', icon: '👋',
      dialogues: [
        { role:'You',  lines:["Well, we've arrived at the airport. I can't believe the tour is already over!"], zh:['嗯，到机场了。不敢相信行程已经结束了！'] },
        { role:'Client',lines:['Me neither. These past ten days have been amazing. Thank you for everything.'], zh:['我也是。这十天太精彩了。感谢你所做的一切。'] },
        { role:'You',  lines:['It was my honor to be your guide. You were a wonderful group. ','Did you enjoy the highlights — the Great Wall, the water town, and Peking duck?'], zh:['能当你们的导游是我的荣幸。你们是很棒的团体。','你们喜欢那些亮点吗——长城、水镇、北京烤鸭？'] },
        { role:'Client',lines:['Every single moment! Especially the cooking class — I\'ll definitely make dumplings at home.'], zh:['每一刻都喜欢！尤其是烹饪课——我回家肯定要包饺子。'] },
        { role:'You',  lines:["That's wonderful to hear! Here are some souvenirs from our team — ","a silk fan and some tea. A small token of our appreciation."], zh:['听到这个太好了！这是我们团队的一点纪念品——','一把扇子和一些茶。一点小心意。'] },
        { role:'Client',lines:["Oh, you shouldn't have! This is so thoughtful. Thank you, guide."], zh:['哦，你们太客气了！太有心了。谢谢导游。'] },
        { role:'You',  lines:['Safe travels home, and please come back to visit China again! ','Feel free to contact me anytime if you need anything.'], zh:['回家一路平安，欢迎再来中国！','随时联系我，有任何需要都可以找我。'] }
      ],
      keyPhrases:[{en:'highlight',zh:'亮点/精彩部分'},{en:'token of appreciation',zh:'心意/纪念'},{en:'safe travels',zh:'一路平安'}]
    },
    {
      scene: '带团流程·第一天集合', icon: '🚌',
      dialogues: [
        { role:'You',  lines:['Good morning, everyone! Welcome to China. I\'m your national guide ','for this 8-day tour. Before we set off, let me go through today\'s plan.'], zh:['大家早上好！欢迎来到中国。我是你们这次 8 日游的全陪导游。','出发前，我先说一下今天的计划。'] },
        { role:'Client',lines:['Excuse me, where is the restroom on this bus?'], zh:['请问，大巴上的洗手间在哪？'] },
        { role:'You',  lines:["It's at the back of the bus on the right side. Also, there are bottled waters ","and umbrellas in the seat pockets — please take one, it might rain later."], zh:['在车厢后部右侧。座位口袋里有矿泉水','和雨伞——请各取一把，后面可能会下雨。'] },
        { role:'Client',lines:["What time do we arrive at the hotel?"], zh:['我们几点到酒店？'] },
        { role:'You',  lines:["We'll arrive around 5 PM. Check-in might take 30 minutes, so dinner is at 7. ","Tonight we'll have a welcome dinner with Peking Duck — it's included in your package."], zh:['大概下午 5 点到。入住可能要 30 分钟，所以晚餐 7 点。','今晚有欢迎晚宴吃北京烤鸭——包含在团费里的。'] },
        { role:'Client',lines:['Is WiFi available at the hotel?'], zh:['酒店有 WiFi 吗？'] },
        { role:'You',  lines:['Yes, free WiFi throughout. I\'ll share the password in our group chat. ','Speaking of which — could everyone please join this WeChat group? ','I\'ll post daily schedules, photos, and any updates there.'], zh:['有，全区域免费 WiFi。密码我会发到群里。','说到这个——请大家加入这个微信群好吗？','我会发每日行程、照片和更新通知。'] }
      ],
      keyPhrases:[{en:'national guide',zh:'全陪导游'},{en:'included in the package',zh:'包含在团费里'},{en:'daily schedule',zh:'每日行程'}]
    },
    {
      scene: '应对刁钻问题', icon: '🤔',
      dialogues: [
        { role:'Client',lines:["I read online that this 'ancient temple' was rebuilt in 2010. Is that true?"], zh:['我在网上看到这座「古庙」是 2010 年重建的。是真的吗？'] },
        { role:'You',  lines:["That's a great question. You're partly correct — ","the original temple dates back 600 years, but it was damaged in an earthquake ","and carefully restored between 2008 and 2010 using traditional methods."], zh:['这个问题问得好。你说对了一部分——','寺庙原件有 600 年历史，但在地震中受损，','于 2008 到 2010 年用传统工艺精心修复。'] },
        { role:'Client',lines:['So it\'s not really "ancient" then?'], zh:['那它其实不算「古老」咯？'] },
        { role:'You',  lines:["I understand why you'd say that. What makes it special is that ","the restoration used the original architectural drawings and 80% original materials ","recovered from the site. So while the completion date is recent, ","the craftsmanship and spirit truly are ancient."], zh:['我理解你为什么这么说。它的特别之处在于','修复用了原始建筑图纸和现场回收的 80% 原始材料。','所以虽然完工日期较近，','但工艺和精神确实是古老的。'] },
        { role:'Client',lines:['Hmm, fair point. I appreciate the honest answer.'], zh:['嗯，说得有道理。感谢你诚实的回答。'] },
        { role:'You',  lines:['Thank you. I always believe tourists deserve accurate information. ','Shall we go inside? The wood carvings are genuinely from the Ming dynasty.'], zh:['谢谢。我一直认为游客应得到准确信息。','我们进去吧？那些木雕确实来自明朝。'] }
      ],
      keyPhrases:[{en:'restoration',zh:'修复/复原'},{en:'craftsmanship',zh:'工艺'},{en:'accurate information',zh:'准确信息'}]
    }
  ];

  // 英语模块子标签：BBC 随身英语 / 导游口语练习
  function enTab(active) {
    return '<div class="en-tabs">' +
      '<button class="en-tab ' + (active === 'bbc' ? 'on' : '') + '" id="tabBbc">🌍 BBC 随身英语</button>' +
      '<button class="en-tab ' + (active === 'guide' ? 'on' : '') + '" id="tabGuide">🗣️ 导游口语练习</button>' +
    '</div>';
  }

  async function renderEnglish(view) {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    const fmt = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    view.innerHTML = enTab('bbc') +
      '<div class="card"><div class="card-title">🌍 英语学习 · BBC 随身英语</div>' +
      '<p class="muted" id="enMeta" style="margin:0 0 8px">每天 30 分钟盲听练习：先听不看译文，再对照学。挑一篇进入。</p>' +
      '<button id="refreshEn" class="btn ghost sm" style="margin-bottom:10px">🔄 立即刷新文章</button>' +
      '<div id="enVoicePick" style="margin:8px 0"></div></div>' +
      '<div id="artList"></div>' +
      '<div class="card"><div class="card-title">📈 学习统计</div><div id="stats"></div>' +
      '<button id="add" class="btn block" style="margin-top:10px">➕ 记录今天学习</button><div id="list" style="margin-top:10px"></div></div>';

    async function refreshStats() {
      const logs = await DB.all('english');
      const dates = logs.map(l => l.date);
      $('#stats').innerHTML = '<div class="stat-grid">' +
        '<div class="stat"><b>' + distinctDays(dates) + '</b><span>学习天数</span></div>' +
        '<div class="stat"><b>' + logs.reduce((s, l) => s + (Number(l.minutes) || 0), 0) + '</b><span>总分钟</span></div>' +
        '<div class="stat"><b>' + streak(dates) + '</b><span>连续天数</span></div></div>';
      const box = $('#list');
      logs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      if (!logs.length) { box.innerHTML = emptyTip('🍃', '还没记录'); return; }
      box.innerHTML = '';
      logs.forEach(l => {
        const card = el('<div class="item"></div>');
        card.innerHTML = '<div class="row spread"><b>' + esc(l.minutes || '0') + ' 分钟' + (l.shadow === '1' ? ' · 影子跟读' : '') + '</b><button class="del">🗑</button></div>' +
          (l.material ? '<p>' + esc(l.material) + '</p>' : '') + '<div class="meta">' + esc(l.date || '') + '</div>';
        card.querySelector('.del').onclick = async () => { if (await confirmDel('删除这条？')) { await DB.del('english', l.id); refreshStats(); } };
        box.append(card);
      });
    }
    $('#add').onclick = async () => {
      const f = await promptForm('记录英语学习', [
        { name: 'minutes', label: '学习分钟', type: 'number', placeholder: '如 15' },
        { name: 'material', label: '学习材料（选填）', placeholder: 'BBC / 单词 / 跟读' },
        { name: 'shadow', label: '是否影子跟读', type: 'select', options: [{ value: '0', label: '否' }, { value: '1', label: '是' }] },
      ]);
      if (f) { await DB.put('english', { date: todayStr(), minutes: f.minutes, material: f.material, shadow: f.shadow, createdAt: Date.now() }); refreshStats(); }
    };

    // 取自动化每天推过来的 BBC 文章；取不到（离线/电脑没开）就用内置 5 篇兜底
    async function loadDailyEn() {
      try {
        const r = await fetch('./data/daily-english.json?v=' + Date.now(), { cache: 'no-store' });
        if (!r.ok) return null;
        const j = await r.json();
        // 文件有效即用——不再强求日期=今天，避免跨天后被误判成离线兜底
        if (j && Array.isArray(j.articles) && j.articles && j.articles.length) {
          j._stale = (j.date !== todayStr());
          return j;
        }
      } catch (e) { /* 离线或取不到，走本地兜底 */ }
      return null;
    }
    function localDailyEn() {
      return { date: todayStr(), source: '本地自带（离线兜底）', articles: EN_ARTICLES };
    }
    let dailyEn = null;

    async function renderList() {
      const list = $('#artList');
      if (!list || !dailyEn || !dailyEn.articles) return;
      list.innerHTML = '';
      for (const a of dailyEn.articles) {
        const heard = (await DB.get('meta', 'enHeard_' + a.id) || {}).value || 0;
        const card = el('<div class="art-card"></div>');
        card.innerHTML =
          '<div class="row spread"><b class="art-title">' + esc(a.en) + '</b><span class="chip">BBC</span></div>' +
          '<div class="muted">' + esc(a.zh) + '</div>' +
          '<div class="art-meta">' + a.words + ' 词 · ' + fmt(a.dur) + ' · ' + a.vocab + ' 词汇量 · 已听 ' + heard + ' 次</div>' +
          (a.link ? '<div class="row" style="margin-top:8px"><button class="btn sm ghost en-link">🔗 看 BBC 原文</button></div>' : '');
        card.querySelector('.art-title').onclick = () => renderDetail(a);
        card.querySelector('.art-meta').onclick = () => renderDetail(a);
        if (a.link) card.querySelector('.en-link').onclick = (e) => { e.stopPropagation(); openLink(a.link); };
        list.append(card);
      }
    }

    function renderDetail(a) {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      let cur = 0, speed = 1, playing = false, showZh = false, loop = false;
      const total = a.body.length, synth = window.speechSynthesis, heardMeta = 'enHeard_' + a.id;
      (async () => { const h = (await DB.get('meta', heardMeta) || {}).value || 0; await DB.put('meta', { id: heardMeta, value: h + 1 }); })();

      view.innerHTML =
        '<button id="back" class="btn ghost sm" style="margin-bottom:10px">← 返回列表</button>' +
        '<div class="art-detail-head"><b class="art-title">' + esc(a.en) + '</b>' +
          '<div class="muted">' + esc(a.zh) + '</div>' +
          '<div class="art-meta">' + a.words + ' 词 · ' + fmt(a.dur) + ' · ' + a.vocab + ' 词汇量</div>' +
          '<div class="warn-note">⚠️ 译文为机器自动翻译，仅供参考</div>' +
          (a.link ? '<button id="srcLink" class="btn sm ghost" style="margin-top:8px">🔗 看 BBC 原文</button>' : '') + '</div>' +
        '<div class="row" style="gap:6px;margin:10px 0;flex-wrap:wrap">' +
          '<button id="showZh" class="btn sm ghost">📖 显示译文</button>' +
          '<button id="train" class="btn sm ghost">🎓 单词训练</button>' +
          '<button id="reset" class="btn sm ghost">🔄 重置进度</button></div>' +
        '<div id="body" class="art-body"></div>' +
        '<div class="player">' +
          '<div class="row" style="gap:8px;align-items:center"><span class="muted" style="font-size:12px">倍速</span>' +
            '<input type="range" id="rate" min="0.5" max="2" step="0.1" value="1" style="flex:1">' +
            '<span id="rateTxt" class="muted" style="font-size:12px;width:36px">1.0x</span></div>' +
          '<div class="progress player-bar" style="margin:8px 0"><i id="pbar"></i></div>' +
          '<div id="ptime" class="muted" style="font-size:12px">0:00 / ' + fmt(a.dur) + '</div>' +
          '<div class="row" style="gap:14px;justify-content:center;margin-top:6px">' +
            '<button id="prev" class="btn sm ghost">⏮</button>' +
            '<button id="play" class="btn sm">▶</button>' +
            '<button id="next" class="btn sm ghost">⏭</button>' +
            '<button id="loop" class="btn sm ghost">🔁</button></div>' +
        '</div>';

      const bodyEl = $('#body');
      function paintBody() {
        bodyEl.innerHTML = '';
        a.body.forEach((seg, i) => {
          const d = el('<div class="seg' + (i === cur ? ' cur' : '') + (showZh ? ' show-zh' : '') + '"></div>');
          d.innerHTML = '<div class="en">' + esc(seg[0]) + '</div>' + (showZh ? '<div class="zh">' + esc(seg[1]) + '</div>' : '');
          d.querySelector('.en').onclick = () => { synth.cancel(); playing = true; $('#play').textContent = '⏸'; playSeg(i); };
          bodyEl.append(d);
        });
      }
      function updateProgress() {
        $('#pbar').style.width = (total ? Math.round((cur + 1) / total * 100) : 0) + '%';
        const played = a.body.slice(0, cur).reduce((s) => s + a.dur / total, 0);
        $('#ptime').textContent = fmt(played) + ' / ' + fmt(a.dur);
      }
      function speak(text, onend) {
        speakLang(text, 'en-US', { rate: speed, onend: onend || null });
        warnVoiceOnce('en-US', '设备无英语母语发音包，朗读可能带口音');
      }
      function playSeg(i) {
        if (i >= total) {
          if (loop) { cur = 0; paintBody(); updateProgress(); speak(a.body[0][0], () => playing && playSeg(1)); }
          else { playing = false; $('#play').textContent = '▶'; }
          return;
        }
        cur = i; paintBody(); updateProgress();
        const seg = bodyEl.querySelectorAll('.seg')[i]; if (seg) seg.scrollIntoView({ block: 'center', behavior: 'smooth' });
        speak(a.body[i][0], () => { if (playing) playSeg(i + 1); });
      }
      paintBody(); updateProgress();

      $('#back').onclick = () => { synth.cancel(); renderEnglish(view); };
      if (a.link) $('#srcLink').onclick = () => openLink(a.link);
      $('#showZh').onclick = () => { showZh = !showZh; $('#showZh').textContent = '📖 ' + (showZh ? '隐藏译文' : '显示译文'); paintBody(); };
      $('#train').onclick = () => {
        const rows = a.tips.map(t => '<div class="bil" style="margin-bottom:8px"><div class="en">' + esc(t[0]) + '</div><div class="zh">' + esc(t[1]) + '</div></div>').join('');
        const m = el('<div class="modal-mask show"><div class="modal"><h3>🎓 单词训练 · ' + esc(a.zh) + '</h3>' + rows + '<div class="modal-actions"><button class="btn block" id="closeTrain">知道了</button></div></div></div>');
        view.append(m);
        m.querySelector('#closeTrain').onclick = () => m.remove();
      };
      $('#reset').onclick = async () => {
        synth.cancel(); playing = false; cur = 0; showZh = true;
        $('#showZh').textContent = '📖 隐藏译文'; paintBody(); updateProgress(); $('#play').textContent = '▶';
        await DB.put('meta', { id: heardMeta, value: 0 }); toast('进度已重置');
      };
      $('#rate').oninput = () => { speed = parseFloat($('#rate').value); $('#rateTxt').textContent = speed.toFixed(1) + 'x'; };
      $('#play').onclick = () => {
        if (playing) { playing = false; synth.cancel(); $('#play').textContent = '▶'; }
        else { playing = true; $('#play').textContent = '⏸'; playSeg(cur); }
      };
      $('#prev').onclick = () => { synth.cancel(); cur = Math.max(0, cur - 1); playing = true; $('#play').textContent = '⏸'; playSeg(cur); };
      $('#next').onclick = () => { synth.cancel(); cur = Math.min(total - 1, cur + 1); playing = true; $('#play').textContent = '⏸'; playSeg(cur); };
      $('#loop').onclick = () => { loop = !loop; $('#loop').classList.toggle('on', loop); toast(loop ? '循环播放：开' : '循环播放：关'); };
    }

    $('#refreshEn').onclick = async () => {
      dailyEn = await loadDailyEn() || localDailyEn();
      const _stale = dailyEn._stale ? ' · 非今日生成（点刷新可重载）' : '';
      $('#enMeta').textContent = '更新于 ' + dailyEn.date + ' · ' + (dailyEn.source || '本地自带') + _stale + '。每天 9 点自动更新。';
      await renderList(); toast('已刷新 🔄');
    };

    dailyEn = await loadDailyEn() || localDailyEn();
    const _stale = dailyEn._stale ? ' · 非今日生成（点刷新可重载）' : '';
    $('#enMeta').textContent = '更新于 ' + dailyEn.date + ' · ' + (dailyEn.source || '本地自带') + _stale + '。每天 9 点自动更新。';
    await renderList(); refreshStats();
    renderVoicePicker('en-US', $('#enVoicePick'), '🗣 英语发音人');
    const tg = $('#tabGuide'); if (tg) tg.onclick = () => renderGuide(view);
  }


  // 8. 导游口语练习（新增：场景对话 + 关键短语提示 + 跟读 + 收藏/错题 + 按天轮换）
  async function renderGuide(view) {
    if (window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (e) {} }
    function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
    function daySeed(){return parseInt(todayStr().replace(/-/g,''),10);}
    function dayPick(seed,arr,n){const rnd=mulberry32(seed);const pool=arr.slice();const out=[];for(let i=0;i<n&&pool.length;i++)out.push(pool.splice(Math.floor(rnd()*pool.length),1)[0]);return out;}
    const STORE_FAV='enFav';
    async function favList(){return await DB.all(STORE_FAV);}
    async function favHas(id){return !!(await DB.get(STORE_FAV,id));}
    async function favAdd(sceneName){if(await favHas(sceneName))return false;await DB.put(STORE_FAV,{id:sceneName,scene:sceneName,createdAt:Date.now()});return true;}
    async function favDel(id){await DB.del(STORE_FAV,id);}

    // 每天自动更新 3 个情景对话
    const todayScenes = dayPick(daySeed() + 333, EN_GUIDE, 3);

    view.innerHTML = enTab('guide') +
      '<div class="card"><div class="card-title">🗣️ 导游口语练习</div>' +
      '<p class="muted" style="margin:0 0 10px">每天自动更新 <b>3 个</b>导游情景对话。点击卡片展开完整对话，<b>点英文句子可显示/隐藏中文翻译</b>。</p>' +
      '<div id="guideVoice" style="margin:8px 0"></div>' +
      '<div id="guideList"></div></div>' +
      '<div class="card" style="margin-top:12px"><div class="card-title">⭐ 我的收藏(<span id="favN">0</span>)</div>' +
      '<button class="btn sm" id="tFav" style="margin-top:6px">查看收藏的对话</button>' +
      '<div id="storeBox" style="margin-top:10px"></div></div>';

    $('#tabBbc').onclick = () => renderEnglish(view);

    // 英语发音人选择器（和 BBC 随身英语一致，可挑最顺耳的嗓音）
    renderVoicePicker('en-US', $('#guideVoice'), '🗣 英语发音人');

    // 渲染一个长对话场景卡片：一开始就渲染完整对话，用 CSS 控制显示/隐藏（折叠默认隐藏）
    function paintSceneCard(sc, idx) {
      const cardId = 'dgScene_' + idx;
      const card = el('<div class="dg-scene-card" id="' + cardId + '"></div>');

      // 卡片头部（折叠状态）：场景名 + 图标 + 预览
      let previewEn = '', previewZh = '';
      if (sc.dialogues && sc.dialogues[0]) {
        previewEn = sc.dialogues[0].lines ? sc.dialogues[0].lines[0] : '';
        previewZh = sc.dialogues[0].zh ? sc.dialogues[0].zh[0] : '';
      }

      // 安全检查：对话数据缺失时给出友好提示，不静默失败
      const hasData = sc.dialogues && Array.isArray(sc.dialogues) && sc.dialogues.length > 0;

      // 对话轮次（一开始就拼好，放到 body 里，默认隐藏）
      let turnsHtml = '';
      if (hasData) {
        sc.dialogues.forEach((turn, ti) => {
          const isYou = turn.role === 'You';
          const roleLabel = isYou ? 'You（导游）' : 'Client（游客）';
          const roleClass = isYou ? 'dg-role-you' : 'dg-role-client';
          const ls = Array.isArray(turn.lines) ? turn.lines : (turn.lines ? [turn.lines] : []);
          const enLines = ls.map((line, li) =>
            '<div class="dg-en-line" data-scene="' + esc(sc.scene) + '" data-turn="' + ti + '" data-line="' + li + '">' +
              esc(line) +
              '<span class="dg-zh-toggle" style="display:none">' + esc((turn.zh && turn.zh[li]) || '') + '</span>' +
            '</div>'
          ).join('');
          turnsHtml +=
            '<div class="dg-turn' + (isYou ? ' dg-turn-you' : ' dg-turn-client') + '">' +
              '<div class="dg-role-label ' + roleClass + '">' + esc(roleLabel) + '</div>' +
              '<div class="dg-turn-content">' + enLines + '</div>' +
            '</div>';
        });
      } else {
        turnsHtml = '<div style="color:#C86A5A;padding:10px">⚠️ 对话数据加载失败</div>';
      }

      // 关键短语区域
      let kpHtml = '';
      if (sc.keyPhrases && sc.keyPhrases.length) {
        kpHtml =
          '<div class="dg-key-phrases"><div class="dg-kp-label">💡 关键短语：</div>' +
          sc.keyPhrases.map(kp =>
            '<span class="dg-kp-item"><b>' + esc(kp.en) + '</b>（' + esc(kp.zh) + '）</span>'
          ).join('') + '</div>';
      }

      card.innerHTML =
        '<div class="dg-scene-header" data-idx="' + idx + '">' +
          '<div class="dg-scene-title">' + (sc.icon || '💬') + ' ' + esc(sc.scene) + '</div>' +
          '<div class="dg-scene-preview"><span class="muted" style="font-size:13px">' + esc(previewEn) + '</span></div>' +
          '<span class="dg-expand-hint">点击展开对话 ▼</span>' +
        '</div>' +
        '<div class="dg-scene-body">' +
          turnsHtml +
          kpHtml +
          '<div class="dg-actions">' +
            '<button class="btn sm" data-act="listenAll">🎧 听整段对话</button>' +
            '<button class="btn sm ghost" data-act="fav">⭐ 收藏此对话</button>' +
          '</div>' +
        '</div>';

      // 点击头部：只切换 .expanded class，由 CSS 控制 body 显隐（极简，不会失败）
      const header = card.querySelector('.dg-scene-header');
      header.onclick = () => {
        const willExpand = !card.classList.contains('expanded');
        card.classList.toggle('expanded');
        const hint = card.querySelector('.dg-expand-hint');
        if (hint) hint.textContent = willExpand ? '收起 ▲' : '点击展开对话 ▼';
      };

      // 绑定每句英文的「点击显隐中文翻译」
      card.querySelectorAll('.dg-en-line').forEach(lineEl => {
        lineEl.onclick = () => {
          const zhEl = lineEl.querySelector('.dg-zh-toggle');
          if (zhEl.style.display === 'none') { zhEl.style.display = 'block'; lineEl.classList.add('show-zh'); }
          else { zhEl.style.display = 'none'; lineEl.classList.remove('show-zh'); }
        };
      });

      // 听整段：改用 speakLang（自动读取用户发音人选择），逐句顺序播放
      card.querySelector('[data-act="listenAll"]').onclick = () => {
        if (!hasData) return;
        const allLines = [];
        sc.dialogues.forEach(turn => { const ls = Array.isArray(turn.lines) ? turn.lines : (turn.lines ? [turn.lines] : []); ls.forEach(line => allLines.push(line)); });
        let i = 0;
        const speakCur = () => {
          if (i >= allLines.length) { toast('播放完毕'); return; }
          // noCancel:true 让顺序连播不被打断；rate 0.92 更清晰
          speakLang(allLines[i], 'en-US', {
            rate: 0.92, noCancel: true,
            onend: () => { i++; setTimeout(speakCur, 350); }
          });
        };
        try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
        speakCur();
        toast('开始播放整段对话');
      };

      // 收藏
      card.querySelector('[data-act="fav"]').onclick = async () => {
        if (await favAdd(sc.scene)) {
          toast('已收藏「' + esc(sc.scene) + '」');
          refreshN();
          const b = card.querySelector('[data-act="fav"]'); b.textContent = '★ 已收藏'; b.classList.add('on');
        } else {
          toast('已在此收藏中');
        }
      };

      // 检查是否已收藏
      (async () => {
        if (await favHas(sc.scene)) {
          const b = card.querySelector('[data-act="fav"]');
          if (b) { b.textContent = '★ 已收藏'; b.classList.add('on'); }
        }
      })();

      return card;
    }

    // 渲染列表
    function paintList() {
      const box = $('#guideList');
      box.innerHTML = '';
      todayScenes.forEach((sc, idx) => {
        box.appendChild(paintSceneCard(sc, idx));
      });
    }

    // 收藏列表
    async function refreshN() { $('#favN').textContent = (await favList()).length; }
    $('#tFav').onclick = async () => {
      const box = $('#storeBox');
      const favs = await favList();
      if (!favs.length) { box.innerHTML = '<div class="muted">还没有收藏对话</div>'; return; }
      box.innerHTML = '';
      favs.forEach(w => {
        const r = el('<div class="dg-fav-item"></div>');
        // 找到原始场景数据
        const orig = EN_GUIDE.find(s => s.scene === w.scene) || w;
        r.innerHTML = '<div class="dg-fav-title">' + ((orig&&orig.icon)||'💬') + ' ' + esc(w.scene) + '</div>' +
          '<div class="row" style="gap:6px;margin-top:6px">' +
            '<button class="btn sm ghost dg-fav-listen">🎧 听</button>' +
            '<button class="btn sm ghost dg-fav-del">✕ 删除</button>' +
          '</div>';
        // 快速预览前两句
        if (orig && orig.dialogues) {
          const prev = el('<div class="dg-fav-prev muted" style="font-size:12px;margin-top:4px"></div>');
          let lineCount = 0;
          orig.dialogues.some(turn => {
            const ls = Array.isArray(turn.lines) ? turn.lines : (turn.lines ? [turn.lines] : []);
            ls.some(line => {
              if (lineCount >= 2) return true;
              prev.innerHTML += '<div>' + esc(line) + '</div>';
              lineCount++;
              return false;
            });
            return lineCount >= 2;
          });
          r.prepend(prev);
        }
        r.querySelector('.dg-fav-listen').onclick = () => {
          if (orig && orig.dialogues) {
            if (window.speechSynthesis) try { window.speechSynthesis.cancel(); } catch(e){}
            const allLines = [];
            orig.dialogues.forEach(turn => { (turn.lines||[]).forEach(l => allLines.push(l)); });
            let i = 0; const synth = window.speechSynthesis;
            function next(){ if(i>=allLines.length)return; const u=new SpeechSynthesisUtterance(allLines[i]); u.lang='en-US'; u.rate=0.9; u.onend=()=>{i++;next();}; u.onerror=()=>{i++;next();}; synth.speak(u); }
            next();
          }
        };
        r.querySelector('.dg-fav-del').onclick = async () => { await favDel(w.id); $('#tFav').click(); refreshN(); };
        box.append(r);
      });
    };

    paintList(); refreshN();
  }

  // 8.5 越南语学习（全新蓝图：仪表盘 + 四张功能卡 + 听/跟练 + 收藏 + 分阶段）
  async function renderViet(view) {
    try {
    console.log('[VN] renderViet start, view=', !!view);
    if (window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (e) {} }
    console.log('[VN] before bumpCheckin');
    await bumpCheckin(); // 打开即打卡当天
    console.log('[VN] after bumpCheckin');

    // ---------- 本地存储助手 ----------
    const STORE_FAV = 'vnFav', STORE_WRONG = 'vnWrong';
    async function getStage() { const m = await DB.get('meta', 'vnStage'); return (m && typeof m.value === 'number') ? m.value : 0; }
    async function setStage(n) { await DB.put('meta', { id: 'vnStage', value: n }); }
    function ymd(y) { const p = x => String(x).padStart(2, '0'); const [Y, M, D] = y.split('-').map(Number); const d = new Date(Y, M - 1, D); d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
    function curStreak(arr) { const s = new Set(arr); let n = 0, base = todayStr(); if (!s.has(base)) { const y = ymd(base); if (!s.has(y)) return 0; base = y; } while (s.has(base)) { n++; base = ymd(base); } return n; }
    async function bumpCheckin() { const m = await DB.get('meta', 'vnCheckin'); const arr = (m && Array.isArray(m.value)) ? m.value : []; const t = todayStr(); if (!arr.includes(t)) arr.push(t); await DB.put('meta', { id: 'vnCheckin', value: arr }); return curStreak(arr); }
    async function getStreak() { const m = await DB.get('meta', 'vnCheckin'); return curStreak((m && Array.isArray(m.value)) ? m.value : []); }
    async function getDone() { const m = await DB.get('meta', 'vnDone_' + todayStr()); return (m && Array.isArray(m.value)) ? m.value : []; }
    async function addDone(key) { const arr = await getDone(); if (!arr.includes(key)) { arr.push(key); await DB.put('meta', { id: 'vnDone_' + todayStr(), value: arr }); } }
    async function getSpoke() { const m = await DB.get('meta', 'vnSpoke_' + todayStr()); return !!(m && m.value); }
    async function markSpoke() { try { await DB.put('meta', { id: 'vnSpoke_' + todayStr(), value: true }); } catch (e) {} }
    async function favList() { return await DB.all(STORE_FAV); }
    async function favHas(id) { return !!(await DB.get(STORE_FAV, id)); }
    async function favAdd(vn, zh) { if (await favHas(vn)) return false; await DB.put(STORE_FAV, { id: vn, vn, zh, createdAt: Date.now() }); return true; }
    async function favDel(id) { await DB.del(STORE_FAV, id); }
    async function wrongList() { return await DB.all(STORE_WRONG); }
    async function wrongAdd(vn, zh) { if (await DB.get(STORE_WRONG, vn)) return; await DB.put(STORE_WRONG, { id: vn, vn, zh, createdAt: Date.now() }); }
    async function wrongDel(id) { await DB.del(STORE_WRONG, id); }
    function daySeed() { return parseInt(todayStr().replace(/-/g, ''), 10); }
    function dayPick(seed, arr, n) { const rnd = mulberry32(seed); const pool = arr.slice(); const out = []; for (let i = 0; i < n && pool.length; i++) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]); return out; }
    // ── 越南语预录音频包（完全离线、国内可用）──
    // 原因：iOS 中文 iPhone 的 Web Speech 不把越南语嗓音暴露给网页（已确诊），
    // 故改用微软 Edge TTS 预录的 mp3 文件，点「听发音」= 播放本地音频。
    // 音频文件在 audio/vn/ 目录，由 scripts/gen_vn_audio.py 批量生成。
    // 越南语文本 → 音频文件 key 的对照表（覆盖所有模块中可能传入 vnSpeak 的文本）
    const VN_AUDIO_MAP = (function () {
      var m = {};
      // 字母表（29 个）
      'a ă â e ê i o ô ơ u ư y'.split(' ').forEach(function (l) { m[l] = 'L_' + l; });
      'b c d đ g h k l m n p q r s t v x'.split(' ').forEach(function (l) { m[l] = 'L_' + l; });
      // 高频词汇
      m['Xin chào'] = 'W_xinchao'; m['Cảm ơn'] = 'W_camon'; m['Phở'] = 'W_pho';
      m['Tạm biệt'] = 'W_tambiet'; m['Bạn khỏe không?'] = 'W_bankhoe';
      m['Tôi tên là…'] = 'W_tenla'; m['Không'] = 'W_khong'; m['Có'] = 'W_co';
      m['Bao nhiêu?'] = 'W_baonhieu'; m['Ngon'] = 'W_ngon';
      // 常用句子
      m['Xin chào, tôi tên là Ngọc.'] = 'S_hello';
      m['Tôi đang học tiếng Việt.'] = 'S_learning';
      m['Một ngày một chút.'] = 'S_daily';
      m['Cảm ơn bạn rất nhiều.'] = 'S_thanks';
      m['Việt Nam rất đẹp.'] = 'S_beautiful';
      // 声调 ma 家族
      m['ma'] = 'T_ma_ngang'; m['mà'] = 'T_ma_huyen'; m['má'] = 'T_ma_sac';
      m['mả'] = 'T_ma_hoi'; m['mã'] = 'T_ma_nga'; m['mạ'] = 'T_ma_nang';
      // 拼读示例
      m['phở'] = 'SP_pho'; m['cà phê'] = 'SP_cafe'; m['xin chào'] = 'SP_xinchao';
      // 场景对话
      m['Cho tôi một bát phở.'] = 'SC_order1'; m['Không cay nhé.'] = 'SC_order2';
      m['Ngon quá!'] = 'SC_order3'; m['Tính tiền.'] = 'SC_order4';
      m['Cái này bao nhiêu tiền?'] = 'SC_shop1'; m['Đắt quá!'] = 'SC_shop2';
      m['Giảm giá được không?'] = 'SC_shop3'; m['Tôi mua cái này.'] = 'SC_shop4';
      m['Nhà vệ sinh ở đâu?'] = 'SC_dir1'; m['Đi thẳng.'] = 'SC_dir2';
      m['Rẽ trái.'] = 'SC_dir3'; m['Ở gần đây không?'] = 'SC_dir4';
      m['Cứu tôi với!'] = 'SC_emerg1'; m['Tôi bị lạc.'] = 'SC_emerg2';
      m['Tôi cần bác sĩ.'] = 'SC_emerg3'; m['Bạn nói tiếng Anh không?'] = 'SC_emerg4';
      // 课程句子
      m['Xin chào.'] = 'U1_1'; m['Bạn khỏe không?'] = 'U1_2';
      m['Tôi khỏe, cảm ơn.'] = 'U1_3'; m['Tạm biệt!'] = 'U1_4';
      m['Tôi tên là Lan.'] = 'U2_1'; m['Rất vui được gặp bạn.'] = 'U2_2';
      m['Tôi đến từ Trung Quốc.'] = 'U2_3'; m['Bạn làm nghề gì?'] = 'U2_4';
      m['một, hai, ba'] = 'U3_1'; m['bốn, năm, sáu'] = 'U3_2';
      m['bảy, tám, chín, mười'] = 'U3_3'; m['Tôi có hai con mèo.'] = 'U3_4';
      m['Tôi không hiểu.'] = 'U4_3'; m['Bạn nói tiếng Trung không?'] = 'U4_4';
      // 课程词汇（单词级别）
      m['khỏe'] = 'V_khoe'; m['tên'] = 'V_ten'; m['rất vui'] = 'V_ratvui';
      m['đến từ'] = 'V_dentu'; m['nghề'] = 'V_nghiep'; m['một'] = 'V_mot';
      m['hai'] = 'V_hai'; m['năm'] = 'V_nam'; m['mười'] = 'V_muoi';
      m['bao nhiêu'] = 'V_baonhieu_word'; m['tiền'] = 'V_tien';
      m['hiểu'] = 'V_hieu';
      m['Không có gì'] = 'NW_001';
      m['Xin lỗi'] = 'NW_002';
      m['Tên tôi là…'] = 'NW_003';
      m['Bạn tên là gì?'] = 'NW_004';
      m['Không sao.'] = 'NW_005';
      m['Cơm'] = 'NW_006';
      m['Bánh mì'] = 'NW_007';
      m['Nước'] = 'NW_008';
      m['Cà phê'] = 'NW_009';
      m['Trà'] = 'NW_010';
      m['Thịt'] = 'NW_011';
      m['Cá'] = 'NW_012';
      m['Rau'] = 'NW_013';
      m['Khách sạn'] = 'NW_014';
      m['Phòng'] = 'NW_015';
      m['Nhà'] = 'NW_016';
      m['Giường'] = 'NW_017';
      m['Nhà vệ sinh'] = 'NW_018';
      m['Nóng'] = 'NW_019';
      m['Lạnh'] = 'NW_020';
      m['Sạch'] = 'NW_021';
      m['Bẩn'] = 'NW_022';
      m['Chìa khóa'] = 'NW_023';
      m['Xe buýt'] = 'NW_024';
      m['Xe taxi'] = 'NW_025';
      m['Xe máy'] = 'NW_026';
      m['Sân bay'] = 'NW_027';
      m['Ga tàu'] = 'NW_028';
      m['Đi'] = 'NW_029';
      m['Đến'] = 'NW_030';
      m['Về'] = 'NW_031';
      m['Trạm dừng'] = 'NW_032';
      m['Vé'] = 'NW_033';
      m['Tiền'] = 'NW_034';
      m['Bao nhiêu'] = 'NW_035';
      m['Đắt'] = 'NW_036';
      m['Rẻ'] = 'NW_037';
      m['Mua'] = 'NW_038';
      m['Bán'] = 'NW_039';
      m['Chợ'] = 'NW_040';
      m['Cửa hàng'] = 'NW_041';
      m['Màu'] = 'NW_042';
      m['Kích thước'] = 'NW_043';
      m['Bác sĩ'] = 'NW_044';
      m['Thuốc'] = 'NW_045';
      m['Bệnh viện'] = 'NW_046';
      m['Đau'] = 'NW_047';
      m['Sốt'] = 'NW_048';
      m['Mệt'] = 'NW_049';
      m['Cứu'] = 'NW_050';
      m['Hiệu thuốc'] = 'NW_051';
      m['Tiêm'] = 'NW_052';
      m['Nhức'] = 'NW_053';
      m['Tôi'] = 'NW_054';
      m['Bạn'] = 'NW_055';
      m['Anh'] = 'NW_056';
      m['Chị'] = 'NW_057';
      m['Em'] = 'NW_058';
      m['Bố'] = 'NW_059';
      m['Mẹ'] = 'NW_060';
      m['Con'] = 'NW_061';
      m['Người'] = 'NW_062';
      m['Gia đình'] = 'NW_063';
      m['Hôm nay'] = 'NW_064';
      m['Ngày'] = 'NW_065';
      m['Tháng'] = 'NW_066';
      m['Năm'] = 'NW_067';
      m['Giờ'] = 'NW_068';
      m['Sáng'] = 'NW_069';
      m['Chiều'] = 'NW_070';
      m['Tối'] = 'NW_071';
      m['Một'] = 'NW_072';
      m['Hai'] = 'NW_073';
      m['Trời'] = 'NW_074';
      m['Mưa'] = 'NW_075';
      m['Nắng'] = 'NW_076';
      m['Gió'] = 'NW_077';
      m['Núi'] = 'NW_078';
      m['Sông'] = 'NW_079';
      m['Biển'] = 'NW_080';
      m['Cây'] = 'NW_081';
      m['Hoa'] = 'NW_082';
      m['Mặt trời'] = 'NW_083';
      m['Ăn'] = 'NW_084';
      m['Uống'] = 'NW_085';
      m['Ngủ'] = 'NW_086';
      m['Thích'] = 'NW_087';
      m['Biết'] = 'NW_088';
      m['Hiểu'] = 'NW_089';
      m['Nói'] = 'NW_090';
      m['Nghe'] = 'NW_091';
      m['Xem'] = 'NW_092';
      m['Làm'] = 'NW_093';
      m['Đâu'] = 'NW_094';
      m['Đây'] = 'NW_095';
      m['Đó'] = 'NW_096';
      m['Trái'] = 'NW_097';
      m['Phải'] = 'NW_098';
      m['Trước'] = 'NW_099';
      m['Sau'] = 'NW_100';
      m['Gần'] = 'NW_101';
      m['Xa'] = 'NW_102';
      m['Trên'] = 'NW_103';
      m['Hộ chiếu'] = 'NW_104';
      m['Visa'] = 'NW_105';
      m['Vali'] = 'NW_106';
      m['Quà'] = 'NW_107';
      m['Ảnh'] = 'NW_108';
      m['Bản đồ'] = 'NW_109';
      m['Danh bạ'] = 'NW_110';
      m['Điện thoại'] = 'NW_111';
      m['Internet'] = 'NW_112';
      m['Sim'] = 'NW_113';
      // 自动为新增主题词分配 NX_ 序号（跳过已有手写映射的词，避免覆盖旧 NW_ 文件）
      (function () {
        var n = 1;
        (typeof VN_TOPIC_WORDS !== 'undefined' ? VN_TOPIC_WORDS : []).forEach(function (t) {
          (t.words || []).forEach(function (w) {
            if (w && w.vn && !m[w.vn]) { m[w.vn] = 'NX_' + ('000' + n).slice(-3); n++; }
          });
        });
      })();
      return m;
    })();
    // 音频文件基础路径（与 gen_vn_audio.py 输出目录对应）
    const VN_AUDIO_BASE = 'audio/vn/';
    // 播放越南语预录音频：查找 VN_AUDIO_MAP 匹配文本 → 播放对应 mp3；
    // 未命中时降级提示（不再走 Web Speech / Google 等注定拼字母的方案）。
    function vnSpeak(text, opts) {
      opts = opts || {};
      text = (text || '').toString().trim();
      if (!text) return false;
      const key = VN_AUDIO_MAP[text];
      if (key) {
        // 命中预录音频 → 本地播放（离线、国内可用、发音标准）
        const url = VN_AUDIO_BASE + key + '.mp3';
        const speed = (opts.rate != null ? opts.rate : 1);
        try {
          const a = new Audio(url);
          a.playbackRate = speed;
          if (opts.onend) a.onended = opts.onend;
          a.onerror = function () {
            // 本地文件缺失时静默失败（不应发生，生成脚本应覆盖全量）
            console.warn('[VN] 音频未找到:', url);
            if (opts.onend) try { opts.onend(); } catch (e) {}
          };
          a.play().catch(function () {
            // Safari 需要用户交互才能 autoplay，已在按钮点击回调中调用则不会触发
            if (opts.onend) try { opts.onend(); } catch (e) {}
          });
          return true;
        } catch (e) {
          console.warn('[VN] Audio 播放异常:', e);
          return false;
        }
      }
      // 未命中预录音频 → 仅在浏览器本机确有越南语嗓音时，用 Web Speech 朗读；
      // （iPhone 中文机通常不暴露越南语音，故仍静默；避免无嗓音时被当成英文字母逐字念）
      try {
        var synth2 = window.speechSynthesis;
        if (synth2 && synth2.getVoices) {
          var vs = synth2.getVoices();
          var vi = null;
          for (var k = 0; k < vs.length; k++) { if ((vs[k].lang || '').toLowerCase().indexOf('vi') === 0) { vi = vs[k]; break; } }
          if (vi) {
            var u = new SpeechSynthesisUtterance(text);
            u.lang = vi.lang; u.voice = vi; u.rate = (opts.rate != null ? opts.rate : 0.95);
            synth2.cancel(); synth2.speak(u);
            return true;
          }
        }
      } catch (e2) { /* 忽略，走下面的静默 */ }
      console.warn('[VN] 无预录音频且本机无越南语音:', text);
      if (!opts || !opts.silent) toast('该词暂无可播放发音：可在电脑安装「越南语语音包」后重试，或等待音频包更新');
      return false;
    }
    function makeRecorder() {
      let rec = null, stream = null, chunks = [];
      return {
        supported: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder),
        async start() { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); rec = new MediaRecorder(stream); chunks = []; rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); }; rec.start(); },
        stop() { return new Promise(res => { rec.onstop = () => { const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' }); const url = URL.createObjectURL(blob); if (stream) stream.getTracks().forEach(t => t.stop()); res(url); }; rec.stop(); }); }
      };
    }
    function buildLesson(stage) {
      let items = [];
      if (stage <= 0) {
        // 完整字母表：12 元音 + 17 辅音，一次列全；6 个特殊字母标「特」
        const sp = {}; VN_SPECIAL.forEach(s => sp[s.l] = true);
        VN_VOWELS.forEach(l => items.push({ kind: 'letter', vn: l.l, zh: l.c, key: 'L' + l.l, vtype: 'vowel', special: !!sp[l.l] }));
        VN_CONSONANTS.forEach(l => items.push({ kind: 'letter', vn: l.l, zh: l.c, key: 'L' + l.l, vtype: 'consonant', special: !!sp[l.l] }));
      } else if (stage === 1) {
        VN_TONES.forEach(t => items.push({ kind: 'tone', vn: t.word, zh: t.cn + ' ' + t.zh, key: 'T' + t.word }));
        VN_SPELL.forEach(s => items.push({ kind: 'spell', vn: s.word, zh: s.zh, note: s.note, key: 'P' + s.word }));
      } else if (stage === 2) {
        VN_WORDS_ALL.forEach(w => items.push({ kind: 'word', vn: w.vn, zh: w.zh, key: 'W' + w.vn }));
      } else if (stage === 3) {
        VN_SENTENCES.forEach(s => items.push({ kind: 'sentence', vn: s.vn, zh: s.zh, key: 'SE' + s.vn }));
        VN_SCENES.reduce((a, sc) => a.concat(sc.items), []).forEach(s => items.push({ kind: 'sentence', vn: s[0], zh: s[1], key: 'SC' + s[0] }));
      } else {
        VN_WORDS_ALL.forEach(w => items.push({ kind: 'word', vn: w.vn, zh: w.zh, key: 'W' + w.vn }));
        VN_SENTENCES.forEach(s => items.push({ kind: 'sentence', vn: s.vn, zh: s.zh, key: 'SE' + s.vn }));
        VN_SCENES.reduce((a, sc) => a.concat(sc.items), []).forEach(s => items.push({ kind: 'sentence', vn: s[0], zh: s[1], key: 'SC' + s[0] }));
      }
      return items;
    }
    function card(icon, title, sub, go) { return '<div class="vn-card" data-go="' + go + '"><div class="vn-card-ic">' + icon + '</div><div class="vn-card-t">' + esc(title) + '</div><div class="vn-card-s">' + esc(sub) + '</div></div>'; }

    // ---------- 仪表盘 ----------
    async function paintHome() {
      const stage = await getStage();
      const done = await getDone();
      const ckM = await DB.get('meta', 'vnCheckin');
      const ckArr = (ckM && Array.isArray(ckM.value)) ? ckM.value : [];
      const streakN = curStreak(ckArr);
      const totalDays = ckArr.length;
      const favs = await favList();
      const wrongs = await wrongList();
      const spoke = await getSpoke();
      const stageInfo = VN_STAGES[stage];
      const lesson = buildLesson(stage);
      const total = lesson.length;
      const doneCount = lesson.filter(it => done.includes(it.key)).length;
      const remain = total - doneCount;
      const pct = total ? Math.round(doneCount / total * 100) : 0;
      const now = new Date();
      const wd = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];
      const dateStr = wd + ' · ' + (now.getMonth() + 1) + '月' + now.getDate() + '日';
      const ringOff = (150.8 * (1 - pct / 100)).toFixed(1);
      const lessonSub = remain > 0 ? ('第' + (stage + 1) + '阶段 · 还差' + remain + '节') : '今日已完成 ✓';
      const speakSub = spoke ? '今日已练 ✓' : '今日未练习';
      view.innerHTML =
        '<div class="vn-home">' +
        '<div class="vn-top">' +
          '<div class="vn-greet"><div class="vn-greet-h">Xin chào!</div><div class="muted" style="font-size:12px">' + dateStr + '</div></div>' +
          '<div class="vn-stats">' +
            '<div class="vn-stat"><b style="color:#e24b4a">' + streakN + '</b><span>连续天</span></div>' +
            '<div class="vn-stat"><b style="color:#378add">' + totalDays + '</b><span>累计天</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="vn-action">' +
          '<svg width="56" height="56" viewBox="0 0 56 56" style="flex:0 0 auto">' +
            '<circle cx="28" cy="28" r="24" fill="none" stroke="#e6e6e6" stroke-width="6"/>' +
            '<circle cx="28" cy="28" r="24" fill="none" stroke="#378add" stroke-width="6" stroke-dasharray="150.8" stroke-dashoffset="' + ringOff + '" transform="rotate(-90 28 28)"/>' +
            '<text x="28" y="32" text-anchor="middle" font-size="13" fill="#378add" font-weight="500">' + pct + '%</text>' +
          '</svg>' +
          '<div style="flex:1;min-width:0">' +
            '<div class="vn-action-t">今日课程' + (remain > 0 ? '还差 ' + remain + ' 节' : '已完成') + '</div>' +
            '<div class="muted" style="font-size:12px;margin:2px 0 8px">已完成 ' + doneCount + ' / ' + total + ' 节</div>' +
            '<button class="vn-action-btn" id="goLesson">继续学习</button>' +
          '</div>' +
        '</div>' +
        '<div class="vn-grid">' +
          card('📚', '今日课程', lessonSub, 'paintLesson') +
          card('🎮', '单词闯关', wrongs.length ? ('错题 ' + wrongs.length + ' 待复习') : '听音选义练耳', 'paintChallenge') +
          card('🎤', '口语练习', speakSub, 'paintSpeak') +
          card('🃏', '闪卡与生词本', favs.length ? ('收藏 ' + favs.length + ' 词') : '翻卡记忆', 'paintFlash') +
        '</div>' +
        '<div class="card"><div class="card-title">🧭 学习路线（5 阶段）</div><div id="vnRoute"></div></div>' +
        '<div class="card"><div class="card-title">⭐ 推荐资源</div><div id="vnRes"></div></div>' +
        '</div>';
      $('#goLesson').onclick = paintLesson;
      view.querySelectorAll('.vn-card').forEach(c => c.onclick = () => {
        const f = c.getAttribute('data-go');
        if (f === 'paintLesson') paintLesson();
        else if (f === 'paintChallenge') paintChallenge();
        else if (f === 'paintSpeak') paintSpeak();
        else if (f === 'paintFlash') paintFlash();
      });
      const route = $('#vnRoute'); if (route) { let h = '<div class="vn-route">'; VN_STAGES.forEach((s, i) => { const st = i < stage ? 'done' : (i === stage ? 'cur' : ''); h += '<div class="vn-step ' + st + '" data-i="' + i + '"><b>' + (i + 1) + '</b><span>' + esc(s.t) + '</span></div>'; }); h += '</div><div class="muted" style="font-size:12px;margin-top:8px">已点亮 ' + stage + ' / ' + VN_STAGES.length + ' 阶段 · 当前：第 ' + (stage + 1) + ' 阶段「' + (VN_STAGES[stage] ? VN_STAGES[stage].t : '') + '」 · <span style="color:#0E9C8E;font-weight:600">点任意阶段可跳转复习 ↺</span></div>'; route.innerHTML = h; route.querySelectorAll('.vn-step').forEach(elStep => { elStep.onclick = async () => { const i = +elStep.getAttribute('data-i'); if (i === stage) return; await setStage(i); toast('已切到第 ' + (i + 1) + ' 阶段'); paintHome(); }; }); }
      const res = $('#vnRes'); if (res) res.innerHTML = VN_RES.map(r => '<a class="vn-res" href="' + r.url + '" target="_blank" rel="noopener">' + esc(r.t) + '</a>').join('');
    }

    // ---------- 今日课程 ----------
    async function paintLesson() {
      if (window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (e) {} }
      const stage = await getStage();
      const done = await getDone();
      const lesson = buildLesson(stage);
      const total = lesson.length;
      let dc = lesson.filter(it => done.includes(it.key)).length;
      const pct = total ? Math.round(dc / total * 100) : 0;
      const isAlpha = stage === 0;
      view.innerHTML =
        '<button class="btn ghost sm" id="back" style="margin-bottom:10px">← 返回</button>' +
        '<div class="card"><div class="card-title">📚 今日课程 · 第 ' + (stage + 1) + ' 阶段 · ' + esc(VN_STAGES[stage] ? VN_STAGES[stage].t : '') + '</div>' +
        '<p class="muted" style="margin:0 0 8px">' + esc(VN_STAGES[stage] ? VN_STAGES[stage].goal : '') + '</p>' +
        (isAlpha ? '<p class="muted" style="margin:0 0 8px;font-size:12px">🔤 元音标绿、辅音标蓝；带「特」的是越南语特有字母，重点记。点 🔊 听发音并标记已会。</p>' : '') +
        '<div class="vn-prog"><i style="width:' + pct + '%"></i></div>' +
        '<div class="muted" style="font-size:12px;margin:6px 0 0">已完成 <span class="vn-donecount">' + dc + '</span>/' + total + ' 个</div></div>' +
        '<div id="lessonList"></div>' +
        (stage < VN_STAGES.length - 1 ? '<button class="btn block" id="master" style="margin-top:10px">✅ 标记掌握本阶段</button>' : '<div class="muted" style="margin-top:10px">已是最后一阶段，保持练习即可 🎉</div>');
      const list = $('#lessonList');
      if (isAlpha) {
        const vowels = lesson.filter(it => it.vtype === 'vowel');
        const cons = lesson.filter(it => it.vtype === 'consonant');
        const tile = it => {
          const d = done.includes(it.key);
          return '<div class="vn-alpha-tile ' + (it.vtype === 'vowel' ? 'vowel' : 'consonant') + (it.special ? ' special' : '') + (d ? ' done' : '') + '" data-key="' + esc(it.key) + '" data-vn="' + esc(it.vn) + '">' +
            (it.special ? '<span class="vn-sp-badge">特</span>' : '') +
            '<div class="vn-alpha-l">' + esc(it.vn) + '</div>' +
            '<div class="vn-alpha-c">' + esc(it.zh) + '</div>' +
            '<button class="vn-alpha-play">🔊 听</button>' +
            (d ? '<span class="vn-done">✓</span>' : '') + '</div>';
        };
        list.innerHTML = '<div class="vn-alpha-group"><div class="vn-alpha-label">元音（' + vowels.length + ' 个）</div><div class="vn-alpha-grid">' + vowels.map(tile).join('') + '</div></div>' +
                         '<div class="vn-alpha-group"><div class="vn-alpha-label">辅音（' + cons.length + ' 个）</div><div class="vn-alpha-grid">' + cons.map(tile).join('') + '</div></div>';
        list.querySelectorAll('.vn-alpha-tile').forEach(t => {
          const key = t.getAttribute('data-key'), vn = t.getAttribute('data-vn');
          t.querySelector('.vn-alpha-play').onclick = () => {
            vnSpeak(vn);
            if (!done.includes(key)) {
              addDone(key); t.classList.add('done');
              if (!t.querySelector('.vn-done')) t.append(el('<span class="vn-done">✓</span>'));
              dc++;
              const bar = view.querySelector('.vn-prog i'); if (bar) bar.style.width = (total ? Math.round(dc / total * 100) : 0) + '%';
              const t2 = view.querySelector('.vn-donecount'); if (t2) t2.textContent = dc;
            }
          };
        });
      } else {
        lesson.forEach(it => {
          const row = el('<div class="vn-row"></div>');
          const doneIt = done.includes(it.key);
          const extra = (it.kind === 'spell' && it.note) ? '<div class="muted" style="font-size:12px;margin-top:4px">' + esc(it.note) + '</div>' : '';
          row.innerHTML = '<div class="vn-row-main"><div class="vn-row-vn">' + esc(it.vn) + '</div><div class="vn-row-zh">' + esc(it.zh) + '</div></div>' +
            extra +
            '<div class="vn-row-btns"><button class="btn sm ghost vn-listen">🔊 听</button><button class="btn sm ghost vn-follow">🎤 跟练</button>' + (doneIt ? '<span class="vn-done">✓</span>' : '') + '</div>';
          row.querySelector('.vn-listen').onclick = () => vnSpeak(it.vn);
          row.querySelector('.vn-follow').onclick = () => {
            vnSpeak(it.vn, { rate: 0.9 });
            addDone(it.key);
            if (!row.querySelector('.vn-done')) { row.querySelector('.vn-row-btns').append(el('<span class="vn-done">✓</span>')); dc++; const bar = view.querySelector('.vn-prog i'); if (bar) bar.style.width = (total ? Math.round(dc / total * 100) : 0) + '%'; const t = view.querySelector('.vn-donecount'); if (t) t.textContent = dc; }
          };
          list.append(row);
        });
      }
      $('#back').onclick = paintHome;
      const mb = $('#master');
      if (mb) mb.onclick = async () => { await setStage(stage + 1); toast('已解锁第 ' + (stage + 2) + ' 阶段'); paintHome(); };
    }

    // ---------- 单词闯关 ----------
    async function paintChallenge() {
      if (window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (e) {} }
      const words = VN_WORDS_ALL.map(w => ({ vn: w.vn, zh: w.zh }));
      const sents = VN_SENTENCES.map(s => ({ vn: s.vn, zh: s.zh }));
      const sceneItems = VN_SCENES.reduce((a, sc) => a.concat(sc.items.map(i => ({ vn: i[0], zh: i[1] }))), []);
      const pool = words.concat(sents, sceneItems);
      const seed = daySeed() + 777; const N = 8; const quiz = [];
      const chosen = dayPick(seed, pool, N);   // 从题池抽 8 个互不相同的词
      for (let i = 0; i < N; i++) {
        const item = chosen[i];
        const type = i % 2 === 0 ? 'listen' : 'zh2vn';
        const others = pool.filter(o => o.vn !== item.vn);
        const distractors = dayPick(seed + i * 101 + 7, others, 3);   // 3 个干扰项（不重复、且非正确答案）
        const opts = dayPick(seed + i * 211 + 13, [item].concat(distractors), 4);  // 打乱选项顺序（每天固定）
        quiz.push({ type, item, opts });
      }
      let qi = 0, score = 0;
      view.innerHTML = '<button class="btn ghost sm" id="back" style="margin-bottom:10px">← 返回</button>' +
        '<div class="card"><div class="card-title">🎮 单词闯关</div><div id="qbox"></div></div>' +
        '<div class="card"><div class="card-title">📕 错题集（' + (await wrongList()).length + '）</div><div id="wrongBox"></div></div>';
      $('#back').onclick = paintHome;
      paintWrong($('#wrongBox'));
      paintQ();
      function paintQ() {
        const box = $('#qbox');
        if (qi >= N) { box.innerHTML = '<div class="vn-end">本轮完成！得分 <b>' + score + '/' + N + '</b><br><span class="muted">明天题目会自动换一批</span></div>'; return; }
        const q = quiz[qi];
        const title = q.type === 'listen' ? '👂 听发音，选中文意思' : '🀄 看中文，选越南语';
        let h = '<div class="vn-q-head">第 ' + (qi + 1) + '/' + N + ' 题 · ' + title + '</div>';
        if (q.type === 'listen') h += '<button class="btn sm" id="qplay">🔊 播放</button>'; else h += '<div class="vn-q-zh">' + esc(q.item.zh) + '</div>';
        h += '<div class="vn-q-opts">';
        q.opts.forEach((o, idx) => { h += '<button class="vn-q-opt" data-i="' + idx + '">' + esc(q.type === 'listen' ? o.zh : o.vn) + '</button>'; });
        h += '</div>';
        box.innerHTML = h;
        if (q.type === 'listen') { $('#qplay').onclick = () => vnSpeak(q.item.vn); vnSpeak(q.item.vn); }
        box.querySelectorAll('.vn-q-opt').forEach(b => b.onclick = () => {
          const chosen = q.opts[+b.getAttribute('data-i')];
          const correct = chosen.vn === q.item.vn;
          box.querySelectorAll('.vn-q-opt').forEach(x => x.disabled = true);
          b.classList.add(correct ? 'right' : 'wrong');
          box.querySelectorAll('.vn-q-opt').forEach(x => { if (q.opts[+x.getAttribute('data-i')].vn === q.item.vn) x.classList.add('right'); });
          if (!correct) wrongAdd(q.item.vn, q.item.zh);
          setTimeout(() => { qi++; paintQ(); }, 950);
        });
      }
      function paintWrong(mount) {
        wrongList().then(list => {
          if (!list.length) { mount.innerHTML = '<div class="muted" style="font-size:13px">还没有错题，闯关全对就清空啦 🎉</div>'; return; }
          mount.innerHTML = '';
          list.slice(0, 20).forEach(w => {
            const r = el('<div class="vn-row"></div>');
            r.innerHTML = '<div class="vn-row-main"><div class="vn-row-vn">' + esc(w.vn) + '</div><div class="vn-row-zh">' + esc(w.zh) + '</div></div>' +
              '<div class="vn-row-btns"><button class="btn sm ghost vn-listen">🔊</button><button class="btn sm ghost vn-fav">⭐</button><button class="btn sm ghost vn-del">✕</button></div>';
            r.querySelector('.vn-listen').onclick = () => vnSpeak(w.vn);
            r.querySelector('.vn-fav').onclick = async () => { if (await favAdd(w.vn, w.zh)) toast('已加入收藏'); };
            r.querySelector('.vn-del').onclick = async () => { await wrongDel(w.id); paintWrong(mount); };
            mount.append(r);
          });
        });
      }
    }

    // ---------- 口语练习（居中跟读 + 录音回放） ----------
    async function paintSpeak(focus) {
      if (window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (e) {} }
      const stage = await getStage();
      let list = stage <= 2 ? VN_WORDS_ALL.map(w => ({ vn: w.vn, zh: w.zh })) : VN_SENTENCES.map(s => ({ vn: s.vn, zh: s.zh }));
      if (stage >= 3) VN_SCENES.forEach(sc => sc.items.forEach(i => list.push({ vn: i[0], zh: i[1] })));
      const picks = dayPick(daySeed() + 99, list, 5);
      if (focus && !picks.find(p => p.vn === focus.vn)) picks.unshift(focus);
      let idx = 0; const rec = makeRecorder();
      view.innerHTML =
        '<button class="btn ghost sm" id="back" style="margin-bottom:10px">← 返回</button>' +
        '<div class="vn-speak">' +
          '<div class="vn-speak-card" id="spCard"><div class="vn-speak-vn" id="spVn"></div><div class="vn-speak-zh" id="spZh"></div><div class="vn-ex" id="spEx" style="display:none"></div></div>' +
          '<div class="vn-speak-btns"><button class="btn sm" id="spListen">🔊 听标准音</button><button class="btn sm" id="spRec">🎤 跟读录音</button><button class="btn sm ghost" id="spPlay" style="display:none">▶ 听我的</button><button class="btn sm ghost" id="spExBtn" style="display:none">💡 例句</button></div>' +
          '<div class="muted" style="font-size:12px;text-align:center;margin-top:8px" id="spHint">' + (rec.supported ? '点「跟读录音」读完点停止，再「听我的」对比标准音' : '本设备不支持录音，可直接听标准音跟读') + '</div>' +
        '</div>' +
        '<div class="card" style="margin-top:12px"><div class="card-title">今日练习词（点任一切换）</div><div id="spList" class="vn-sp-list"></div></div>';
      $('#back').onclick = paintHome;
      let curEx = null;
      function show(i) { idx = i; const it = picks[i]; $('#spVn').textContent = it.vn; $('#spZh').textContent = it.zh; $('#spPlay').style.display = 'none'; $('#spEx').style.display = 'none'; curEx = VN_EX_MAP[it.vn] || null; const exb = $('#spExBtn'); exb.style.display = ''; const rb = $('#spRec'); rb.textContent = '🎤 跟读录音'; rb.disabled = false; rb.classList.remove('rec'); }
      $('#spListen').onclick = () => { vnSpeak(picks[idx].vn); markSpoke(); };
      $('#spExBtn').onclick = () => { const b = $('#spEx'); if (b.style.display === 'block') { b.style.display = 'none'; return; } if (!curEx) { b.innerHTML = '💡 这个词暂未配例句，先跟读单词吧～'; b.style.display = 'block'; return; } b.innerHTML = '💡 例句：<b>' + esc(curEx.vn) + '</b><br><span class="muted">' + esc(curEx.zh) + '</span>'; b.style.display = 'block'; };
      $('#spRec').onclick = async () => {
        const btn = $('#spRec');
        if (btn.textContent.indexOf('停止') < 0) {
          try { await rec.start(); btn.textContent = '■ 停止录音'; btn.classList.add('rec'); }
          catch (e) { toast('无法访问麦克风，请检查权限'); }
        } else {
          btn.textContent = '🎤 跟读录音'; btn.classList.remove('rec');
          const url = await rec.stop(); const a = new Audio(url); $('#spPlay').style.display = ''; $('#spPlay').onclick = () => a.play();
          markSpoke(); toast('录好了，点「听我的」对比标准音');
        }
      };
      const spList = $('#spList');
      picks.forEach((it, i) => { const b = el('<button class="vn-sp-item"></button>'); b.textContent = it.vn; b.onclick = () => show(i); spList.append(b); });
      show(0);
    }

    // ---------- 闪卡与生词本 ----------
    async function paintFlash() {
      if (window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (e) {} }
      const stage = await getStage();
      const stageName = (VN_STAGES[stage - 1] && VN_STAGES[stage - 1].t) || '';
      // 抽卡范围跟着学习阶段扩展：前期只抽必背词；学到后面阶段自动加入句子与场景短句，与口语练习保持一致
      let pool = stage <= 2 ? VN_WORDS_ALL.slice() : VN_SENTENCES.map(s => ({ vn: s.vn, zh: s.zh }));
      if (stage >= 3) VN_SCENES.forEach(sc => sc.items.forEach(i => pool.push({ vn: i[0], zh: i[1] })));
      const deck = dayPick(daySeed() + 55, pool, 8);
      view.innerHTML =
        '<button class="btn ghost sm" id="back" style="margin-bottom:10px">← 返回</button>' +
        '<div class="row" style="gap:6px;margin-bottom:10px"><button class="btn sm" id="tFlash">🃏 闪卡</button><button class="btn sm ghost" id="tFav">⭐ 收藏夹(' + (await favList()).length + ')</button></div>' +
        '<div class="muted" style="font-size:12px;margin-bottom:10px">当前阶段：' + esc(stageName) + ' · 抽卡范围随进度扩展（前期记词，后期加句子与场景短句）</div>' +
        '<div id="flashBox"></div>';
      $('#back').onclick = paintHome;
      function paintDeck() {
        const box = $('#flashBox'); box.innerHTML = '';
        deck.forEach(w => {
          const c = el('<div class="vn-flash"></div>');
          c.innerHTML = '<div class="vn-flash-inner"><div class="vn-flash-front">' + esc(w.vn) + '</div><div class="vn-flash-back">' + esc(w.zh) + '</div></div>' +
            '<div class="vn-flash-btns"><button class="btn sm ghost vn-listen">🔊 听</button><button class="btn sm ghost vn-fav">⭐ 收藏</button></div>';
          const inner = c.querySelector('.vn-flash-inner');
          inner.onclick = () => inner.classList.toggle('flip');
          c.querySelector('.vn-listen').onclick = e => { e.stopPropagation(); vnSpeak(w.vn); };
          c.querySelector('.vn-fav').onclick = async e => { e.stopPropagation(); if (await favAdd(w.vn, w.zh)) toast('已加入收藏'); };
          box.append(c);
        });
      }
      async function paintFav() {
        const box = $('#flashBox'); const favs = await favList();
        if (!favs.length) { box.innerHTML = '<div class="muted">还没有收藏，去闪卡点 ⭐ 加入吧</div>'; return; }
        box.innerHTML = '';
        favs.forEach(w => {
          const r = el('<div class="vn-row"></div>');
          r.innerHTML = '<div class="vn-row-main"><div class="vn-row-vn">' + esc(w.vn) + '</div><div class="vn-row-zh">' + esc(w.zh) + '</div></div>' +
            '<div class="vn-row-btns"><button class="btn sm ghost vn-listen">🔊</button><button class="btn sm ghost vn-del">✕</button></div>';
          r.querySelector('.vn-listen').onclick = () => vnSpeak(w.vn);
          r.querySelector('.vn-del').onclick = async () => { await favDel(w.id); paintFav(); $('#tFav').textContent = '⭐ 收藏夹(' + (await favList()).length + ')'; };
          box.append(r);
        });
      }
      $('#tFlash').onclick = () => { $('#tFlash').classList.remove('ghost'); $('#tFav').classList.add('ghost'); paintDeck(); };
      $('#tFav').onclick = () => { $('#tFav').classList.remove('ghost'); $('#tFlash').classList.add('ghost'); paintFav(); };
      paintDeck();
    }

    console.log('[VN] about to call paintHome');
    paintHome();
    console.log('[N] paintHome done, no error');
    } catch (err) {
      const msg = '⚠️ 越南语模块加载出错：' + String(err.stack || err.message);
      console.error('[VN ERROR]', err);
      alert(msg);
      if (view) view.innerHTML = '<div style="padding:20px;color:#e24b4a;font-size:14px;white-space:pre-wrap;background:#fff">' + msg.replace(/</g,'&lt;') + '</div>';
      document.body.insertAdjacentHTML('beforeend', '<div style="position:fixed;top:0;left:0;right:0;z-index:99999;padding:16px;background:#e24b4a;color:#fff;font-size:14px;white-space:pre-wrap">' + msg.replace(/</g,'&lt;') + '</div>');
    }
  }

  // 9. 古法健身操
  async function renderFitness(view) {
    view.innerHTML =
      '<div class="card"><div class="card-title">💪 古法健身操</div>' +
      '<p class="muted" style="margin:0 0 4px">挑一种今天练，点「打开跟练视频」就能找到对应教学。</p>' +
      '<div id="fitTypes"></div></div>' +
      '<div class="card"><div class="card-title">📈 练习统计</div><div id="stats"></div>' +
      '<button id="add" class="btn block" style="margin-top:10px">➕ 记录今天练习</button><div id="list" style="margin-top:10px"></div></div>';
    const box = $('#fitTypes');
    FITNESS_TYPES.forEach(t => {
      const c = el('<div class="fit-type"></div>');
      c.innerHTML = '<div class="fit-head"><span class="fit-icon">' + t.icon + '</span>' +
        '<div style="flex:1"><b>' + esc(t.name) + '</b>' +
        '<div class="muted" style="font-size:13px;margin-top:2px">' + esc(t.tip) + '</div>' +
        '<div class="fit-suggest">' + esc(t.suggest) + '</div></div></div>' +
        '<button class="btn green sm fit-video" data-kw="' + esc(t.kw) + '">▶ 打开跟练视频</button>';
      c.querySelector('.fit-video').onclick = () => openLink('https://search.bilibili.com/all?keyword=' + encodeURIComponent(t.kw));
      box.append(c);
    });
    async function refresh() {
      const logs = await DB.all('fitness');
      const dates = logs.map(l => l.date);
      $('#stats').innerHTML = '<div class="stat-grid">' +
        '<div class="stat"><b>' + distinctDays(dates) + '</b><span>练习天数</span></div>' +
        '<div class="stat"><b>' + logs.reduce((s, l) => s + (Number(l.minutes) || 0), 0) + '</b><span>总分钟</span></div>' +
        '<div class="stat"><b>' + streak(dates) + '</b><span>连续天数</span></div></div>';
      const box = $('#list');
      logs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      if (!logs.length) { box.innerHTML = emptyTip('🍃', '还没记录'); return; }
      box.innerHTML = '';
      logs.forEach(l => {
        const card = el('<div class="item"></div>');
        card.innerHTML = '<div class="row spread"><b>' + esc(l.minutes || '0') + ' 分钟</b><button class="del">🗑</button></div>' +
          (l.note ? '<p>' + esc(l.note) + '</p>' : '') + '<div class="meta">' + esc(l.date || '') + '</div>';
        card.querySelector('.del').onclick = async () => { if (await confirmDel('删除这条？')) { await DB.del('fitness', l.id); refresh(); } };
        box.append(card);
      });
    }
    $('#add').onclick = async () => {
      const f = await promptForm('记录健身操', [
        { name: 'minutes', label: '练习分钟', type: 'number', placeholder: '如 20' },
        { name: 'note', label: '备注（选填）', type: 'textarea', placeholder: '今天感觉如何' },
      ]);
      if (f) { await DB.put('fitness', { date: todayStr(), minutes: f.minutes, note: f.note, createdAt: Date.now() }); refresh(); }
    };
    refresh();
  }

  // 古法健身操：细分类别（每类点开即搜跟练视频）
  const FITNESS_TYPES = [
    { icon: '🧘', name: '八段锦', tip: '8 个动作一组，舒展筋骨、调理气血，最适合清晨刚起床。', suggest: '建议：每天 1 遍，约 12 分钟；动作要慢、配合呼吸，别憋气。', kw: '八段锦 全套 跟练 初学者' },
    { icon: '🐯', name: '五禽戏', tip: '模仿虎、鹿、熊、猿、鸟五种动物，活动全身、趣味性强。', suggest: '建议：挑 1–2 种动物先练，每戏 3–5 遍；动作夸张点更到位。', kw: '五禽戏 教学 跟练 完整版' },
    { icon: '☯️', name: '太极拳', tip: '以柔克刚、缓慢连绵，强平衡、稳心神，适合想静心的你。', suggest: '建议：从「24 式简化太极」入门，每天 15–20 分钟，重在对得住气。', kw: '太极拳 24式 简化 教学 跟练' },
    { icon: '📜', name: '易筋经', tip: '拉筋伸骨、强筋健体，动作稍用力，练完浑身通透。', suggest: '建议：每周 3–4 次，每式停留 3–5 个呼吸；韧带紧的别硬拉。', kw: '易筋经 12式 跟练 教学' },
    { icon: '🌬️', name: '六字诀', tip: '用「嘘呵呼呬吹嘻」六个字配呼吸，调理五脏六腑。', suggest: '建议：早晚各 1 遍，每字 6 次呼吸，重在呼气时吐字。', kw: '六字诀 呼吸 养生 教学' },
    { icon: '💎', name: '金刚功', tip: '八式刚劲舒展，疏通经络、强筋壮骨，练完浑身发热、通透有力。', suggest: '建议：每天 1 遍约 15 分钟，动作连贯有力、配合自然呼吸；饭后 1 小时再练。', kw: '金刚功 张至顺 8式 跟练 教学' },
  ];

  // ---------- 导航 / 路由 ----------
  async function renderGratitude(view) {
    const today = todayStr();
    const saved = await DB.get('gratitude', today);
    const items = (saved && saved.items) || [];
    const count = 5;

    view.innerHTML =
      '<div class="card"><div class="card-title">🙏 每日感恩 · 今天</div>' +
      '<p class="muted" style="margin:0 0 10px">睡前写下今天值得感恩的事，哪怕很小。写完点保存，回头能翻看。</p>' +
      '<div class="row spread" style="margin-bottom:8px"><button id="gMusic" class="btn sm ghost">🎵 治愈轻音乐</button></div>' +
      '<div id="gList"></div>' +
      '<button id="gSave" class="btn green block" style="margin-top:14px">💾 保存今天的感恩</button>' +
      '<div id="gMsg" class="muted" style="margin-top:8px;text-align:center"></div></div>' +
      '<div class="card"><div class="card-title">📚 历史回看</div><div id="gHistory"></div></div>';

    const list = $('#gList');
    function paintList(fill) {
      list.innerHTML = '';
      for (let i = 0; i < count; i++) {
        const row = el('<div class="g-item"></div>');
        row.innerHTML = '<span class="g-no">' + (i + 1) + '</span>' +
          '<input class="g-input" maxlength="120" placeholder="第 ' + (i + 1) + ' 件值得感恩的事…" value="' + esc((fill && fill[i]) || '') + '">';
        list.append(row);
      }
    }
    paintList(items);
    // 感恩固定为 5 件，不提供 3/10 切换

    let gratAudio = null;
    $('#gMusic').onclick = async () => {
      if (gratAudio) { gratAudio.stop(); gratAudio = null; $('#gMusic').textContent = '🎵 治愈轻音乐'; return; }
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = new Ctx();
        if (ctx.state === 'suspended') await ctx.resume();          // 部分浏览器需手动解锁
        const master = ctx.createGain(); master.gain.value = 0.0001; master.connect(ctx.destination);

        // 空灵回声，营造治愈空间感
        const delay = ctx.createDelay(1.0); delay.delayTime.value = 0.34;
        const fb = ctx.createGain(); fb.gain.value = 0.33;
        const wet = ctx.createGain(); wet.gain.value = 0.45;
        delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);

        // 柔和和声垫（Cmaj7 低八度，缓慢呼吸）
        const padG = ctx.createGain(); padG.gain.value = 0.05; padG.connect(master);
        const padOscs = [130.81, 164.81, 196.00, 246.94].map(f => {
          const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
          o.connect(padG); o.start(); return o;
        });
        const padLfo = ctx.createOscillator(); padLfo.frequency.value = 0.06;
        const padLfoG = ctx.createGain(); padLfoG.gain.value = 0.025;
        padLfo.connect(padLfoG); padLfoG.connect(padG.gain); padLfo.start();

        // 治愈系轻音乐 · C 大调五声音阶旋律（舒缓留白，像八音盒）[频率, 时长, 间隔]
        const M = [
          [523.25,1.6,0.9],[440.00,1.6,0.9],[392.00,1.8,1.0],[329.63,1.6,0.9],
          [293.66,1.8,1.1],[329.63,1.6,0.9],[392.00,2.0,1.2],[523.25,1.6,0.9],
          [587.33,1.6,0.9],[659.25,2.0,1.3],[587.33,1.6,0.9],[523.25,1.8,1.0],
          [440.00,1.6,0.9],[392.00,2.0,1.2],[329.63,1.8,1.0],[261.63,2.4,1.4]
        ];
        let mi = 0, timer = null;
        function note(freq, t, dur, vol) {
          const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
          const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2; // 泛音，更润
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          o.connect(g); o2.connect(g); g.connect(master); g.connect(delay);
          o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
        }
        function tick() {
          const [f, d, gap] = M[mi % M.length];
          note(f, ctx.currentTime + 0.04, d, 0.2);
          mi++;
          timer = setTimeout(tick, gap * 1000);
        }
        tick();
        master.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 2.5); // 2.5 秒渐入到舒适音量

        gratAudio = { stop() {
          if (timer) clearTimeout(timer);
          try { master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8); } catch (e) {}
          setTimeout(() => {
            try { padOscs.forEach(o => o.stop()); padLfo.stop(); } catch (e) {}
            try { ctx.close(); } catch (e) {}
          }, 900);
        } };
        $('#gMusic').textContent = '⏹ 停止音乐';
      } catch (e) { toast('当前设备不支持播放音乐'); }
    };

    $('#gSave').onclick = async () => {
      const vals = [...list.querySelectorAll('.g-input')].map(inp => inp.value.trim()).filter(Boolean);
      if (!vals.length) { $('#gMsg').textContent = '⚠️ 先写下至少 1 件吧～'; return; }
      await DB.put('gratitude', { id: today, date: today, items: vals, ts: Date.now() });
      $('#gMsg').textContent = '✅ 已保存 ' + vals.length + ' 件，感恩完成！';
      toast('感恩已记下 💚');
      paintList([]);
      paintHistory();
    };

    async function paintHistory() {
      const all = (await DB.all('gratitude')).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const box = $('#gHistory');
      if (!all.length) { box.innerHTML = emptyTip('🌙', '还没有历史记录'); return; }
      box.innerHTML = '';
      all.forEach(rec => {
        const card = el('<div class="g-hist"></div>');
        const isToday = rec.date === today;
        card.innerHTML = '<div class="g-hist-head row spread"><b>' + esc(rec.date) + (isToday ? ' · 今天' : '') + '</b>' +
          '<span><button class="g-view">展开</button> <button class="del">🗑</button></span></div>' +
          '<div class="g-hist-body" style="display:none"></div>';
        const body = card.querySelector('.g-hist-body');
        body.innerHTML = (rec.items || []).map((t, i) => '<div class="g-hist-line"><span>' + (i + 1) + '.</span> ' + esc(t) + '</div>').join('');
        card.querySelector('.g-view').onclick = () => {
          const open = body.style.display !== 'none';
          body.style.display = open ? 'none' : 'block';
          card.querySelector('.g-view').textContent = open ? '展开' : '收起';
        };
        card.querySelector('.del').onclick = async () => {
          if (await confirmDel('删除 ' + rec.date + ' 的感恩记录？')) { await DB.del('gratitude', rec.id); paintHistory(); }
        };
        box.append(card);
      });
    }
    paintHistory();
  }

  const MODULES = [
    { key: 'home', emoji: '🌿', title: '概览', render: renderHome },
    { key: 'daily', emoji: '📋', title: '每日计划', render: renderDaily },
    { key: 'ideas', emoji: '💡', title: '选题灵感', render: renderIdeas },
    { key: 'hot', emoji: '🔥', title: '爆款二创', render: renderHot },
    { key: 'english', emoji: '🌍', title: '英语学习', render: renderEnglish },
    { key: 'viet', emoji: '🇻🇳', title: '越南语学习', render: renderViet, flag: true },
    { key: 'uke', emoji: '🎻', title: '尤克里里', render: renderUke },
    { key: 'fitness', emoji: '💪', title: '古法健身操', render: renderFitness },
    { key: 'gratitude', emoji: '🙏', title: '每日感恩', render: renderGratitude },
    { key: 'memo', emoji: '📝', title: '备忘录', render: renderMemo },
    { key: 'review', emoji: '📊', title: '内容复盘', render: renderReview },
  ];

  function go(key) { if (location.hash !== '#/' + key) location.hash = '#/' + key; else route(); }
  function route() {
    const key = (location.hash.replace('#/', '') || 'home');
    const m = MODULES.find(x => x.key === key) || MODULES[0];
    $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.key === m.key));
    $('#pageTitle').textContent = m.title;
    const view = $('#view'); view.scrollTop = 0; view.innerHTML = '';
    closeDrawer();
    try { m.render(view); } catch (syncErr) {
      view.innerHTML = '<div style="padding:20px;color:#e24b4a;font-size:14px">⚠️ [' + m.key + '] 同步错误：' + String(syncErr.stack || syncErr.message) + '</div>';
    }
  }

  function openDrawer() { $('#drawer').classList.add('open'); $('#backdrop').classList.add('show'); $('#drawer').setAttribute('aria-hidden', 'false'); }
  function closeDrawer() { $('#drawer').classList.remove('open'); $('#backdrop').classList.remove('show'); $('#drawer').setAttribute('aria-hidden', 'true'); }

  async function exportAll() {
    const out = {};
    for (const s of ['tasks', 'ideas', 'hot', 'reviews', 'memos', 'uke', 'english', 'viet', 'fitness', 'gratitude', 'quotes', 'meta', 'vnFav', 'vnWrong', 'enFav', 'enWrong']) out[s] = await DB.all(s);
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'Happy赖工作台备份_' + todayStr() + '.json'; a.click();
    toast('已导出备份到下载文件夹');
  }

  async function importAll(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const stores = ['tasks', 'ideas', 'hot', 'reviews', 'memos', 'uke', 'english', 'viet', 'fitness', 'gratitude', 'quotes', 'meta', 'vnFav', 'vnWrong', 'enFav', 'enWrong'];
      let count = 0;
      for (const s of stores) {
        const arr = data[s];
        if (!Array.isArray(arr)) continue;
        for (const rec of arr) {
          if (rec && typeof rec === 'object') { await DB.put(s, rec); count++; }
        }
      }
      toast('已从备份恢复 ' + count + ' 条数据 💚');
      route();
    } catch (e) {
      console.error(e);
      toast('导入失败：这好像不是备份文件');
    }
  }

  function init() {
    window.addEventListener('unhandledrejection', function(e) {
      console.error('[UNHANDLED]', e.reason);
      alert('⚠️ 未捕获错误：' + String(e.reason && (e.reason.stack || e.reason.message || e.reason)));
    });
    const nav = $('#nav');
    MODULES.forEach(m => {
      const icon = m.flag ? vnFlag('vn-flag nav-flag') : '<span class="emoji">' + m.emoji + '</span>';
      const it = el('<div class="nav-item" data-key="' + m.key + '">' + icon + '<span>' + m.title + '</span></div>');
      it.onclick = () => go(m.key);
      nav.append(it);
    });
    // 数据备份：默认收起，点「💾 数据备份」才展开导出/导入
    const backupBox = el('<div class="backup-box"></div>');
    backupBox.innerHTML =
      '<button id="backupToggle" class="backup-toggle" type="button">💾 数据备份</button>' +
      '<div id="backupActions" class="backup-actions" style="display:none">' +
        '<button id="exportBtn" class="btn ghost sm block" type="button">⬇ 导出备份</button>' +
        '<button id="importBtn" class="btn ghost sm block" type="button">⬆ 导入备份</button>' +
      '</div>';
    const fileInput = el('<input type="file" accept="application/json" style="display:none">');
    fileInput.onchange = () => { if (fileInput.files && fileInput.files[0]) importAll(fileInput.files[0]); fileInput.value = ''; };
    const sn = $('#storageNote');
    sn.before(backupBox); sn.before(fileInput);
    $('#backupToggle').onclick = () => {
      const box = $('#backupActions');
      box.style.display = box.style.display === 'none' ? 'flex' : 'none';
    };
    $('#exportBtn').onclick = exportAll;
    $('#importBtn').onclick = () => fileInput.click();

    $('#menuBtn').onclick = openDrawer;
    $('#homeBtn').onclick = () => go('home');
    $('#backdrop').onclick = closeDrawer;
    const dl = $('#dateLabel'); if (dl) dl.textContent = topDate();
    window.addEventListener('hashchange', route);
    route();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // 注册 Service Worker（离线打开）
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
