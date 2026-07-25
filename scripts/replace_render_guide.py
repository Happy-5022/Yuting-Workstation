"""Replace renderGuide function with new long-dialogue card format"""
with open('D:/workbuddy/2026-07-22-20-29-18/js/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find renderGuide start and end
start_marker = '  async function renderGuide(view) {'
end_marker = '  // 8.5 越南语学习'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print(f"ERROR: Could not find markers. start={start_idx}, end={end_idx}")
else:
    print(f"Replacing renderGuide: {start_idx} to {end_idx} ({end_idx-start_idx} chars)")

    NEW_RENDER_GUIDE = r'''  async function renderGuide(view) {
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
      '<div id="guideList"></div></div>' +
      '<div class="card" style="margin-top:12px"><div class="card-title">⭐ 我的收藏(<span id="favN">0</span>)</div>' +
      '<button class="btn sm" id="tFav" style="margin-top:6px">查看收藏的对话</button>' +
      '<div id="storeBox" style="margin-top:10px"></div></div>';

    $('#tabBbc').onclick = () => renderEnglish(view);

    // 渲染一个长对话场景卡片（折叠/展开）
    function paintSceneCard(sc, idx) {
      const cardId = 'dgScene_' + idx;
      const card = el('<div class="dg-scene-card" id="' + cardId + '"></div>');

      // 卡片头部（折叠状态）：场景名 + 图标 + 预览
      let previewEn = '', previewZh = '';
      if (sc.dialogues && sc.dialogues[0]) {
        previewEn = sc.dialogues[0].lines ? sc.dialogues[0].lines[0] : '';
        previewZh = sc.dialogues[0].zh ? sc.dialogues[0].zh[0] : '';
      }

      card.innerHTML =
        '<div class="dg-scene-header" data-idx="' + idx + '">' +
          '<div class="dg-scene-title">' + (sc.icon || '💬') + ' ' + esc(sc.scene) + '</div>' +
          '<div class="dg-scene-preview"><span class="muted" style="font-size:13px">' + esc(previewEn) + '</span></div>' +
          '<span class="dg-expand-hint">点击展开对话 ▼</span>' +
        '</div>';

      // 点击头部展开/折叠
      const header = card.querySelector('.dg-scene-header');
      header.onclick = () => {
        if (card.classList.contains('expanded')) {
          card.classList.remove('expanded');
          // 移除展开内容，恢复折叠
          const body = card.querySelector('.dg-scene-body');
          if (body) body.remove();
          card.querySelector('.dg-expand-hint').textContent = '点击展开对话 ▼';
        } else {
          card.classList.add('expanded');
          card.querySelector('.dg-expand-hint').textContent = '收起 ▲';
          paintSceneBody(card, sc);
        }
      };

      return card;
    }

    // 渲染展开后的完整对话内容
    function paintSceneBody(card, sc) {
      // 防止重复添加
      if (card.querySelector('.dg-scene-body')) return;

      const body = el('<div class="dg-scene-body"></div>');

      // 对话轮次
      sc.dialogues.forEach((turn, ti) => {
        const isYou = turn.role === 'You';
        const turnEl = el('<div class="dg-turn' + (isYou ? ' dg-turn-you' : ' dg-turn-client') + '"></div>');

        // 角色标签
        const roleLabel = isYou ? 'You（导游）' : 'Client（游客）';
        const roleClass = isYou ? 'dg-role-you' : 'dg-role-client';

        // 英文行（每句可点显隐翻译）
        const enLines = (turn.lines || []).map((line, li) =>
          '<div class="dg-en-line" data-scene="' + esc(sc.scene) + '" data-turn="' + ti + '" data-line="' + li + '">' +
            esc(line) +
            '<span class="dg-zh-toggle" style="display:none">' + esc(turn.zh && turn.zh[li] || '') + '</span>' +
          '</div>'
        ).join('');

        turnEl.innerHTML =
          '<div class="dg-role-label ' + roleClass + '">' + esc(roleLabel) + '</div>' +
          '<div class="dg-turn-content">' + enLines + '</div>';

        // 绑定点击显隐翻译
        turnEl.querySelectorAll('.dg-en-line').forEach(el => {
          el.onclick = () => {
            const zhEl = el.querySelector('.dg-zh-toggle');
            if (zhEl.style.display === 'none') {
              zhEl.style.display = 'block';
              el.classList.toggle('show-zh', true);
            } else {
              zhEl.style.display = 'none';
              el.classList.toggle('show-zh', false);
            }
          };
        });

        body.append(turnEl);
      });

      // 关键短语区域
      if (sc.keyPhrases && sc.keyPhrases.length) {
        const kpEl = el('<div class="dg-key-phrases"></div>');
        kpEl.innerHTML = '<div class="dg-kp-label">💡 关键短语：</div>' +
          sc.keyPhrases.map(kp =>
            '<span class="dg-kp-item"><b>' + esc(kp.en) + '</b>（' + esc(kp.zh) + '）</span>'
          ).join('');
        body.append(kpEl);
      }

      // 操作按钮栏
      const actions = el('<div class="dg-actions"></div>');
      actions.innerHTML =
        '<button class="btn sm" data-act="listenAll">🎧 听整段对话</button>' +
        '<button class="btn sm ghost" data-act="fav">⭐ 收藏此对话</button>';

      // 听整段：依次朗读所有 You 和 Client 的 lines
      actions.querySelector('[data-act="listenAll"]').onclick = () => {
        if (window.speechSynthesis) try { window.speechSynthesis.cancel(); } catch(e){}
        const allLines = [];
        sc.dialogues.forEach(turn => {
          (turn.lines||[]).forEach(line => allLines.push(line));
        });
        let i = 0;
        const synth = window.speechSynthesis;
        function speakNext() {
          if (i >= allLines.length) return;
          const u = new SpeechSynthesisUtterance(allLines[i]);
          u.lang = 'en-US';
          u.rate = 0.9;
          u.onend = () => { i++; speakNext(); };
          u.onerror = () => { i++; speakNext(); };
          synth.speak(u);
        }
        speakNext();
        toast('开始播放整段对话');
      };

      // 收藏
      actions.querySelector('[data-act="fav"]').onclick = async () => {
        if (await favAdd(sc.scene)) {
          toast('已收藏「' + esc(sc.scene) + '」');
          refreshN();
          actions.querySelector('[data-act="fav"]').textContent = '★ 已收藏';
          actions.querySelector('[data-act="fav"]').classList.add('on');
        } else {
          toast('已在此收藏中');
        }
      };

      // 检查是否已收藏
      (async () => {
        if (await favHas(sc.scene)) {
          const btn = actions.querySelector('[data-act="fav"]');
          if (btn) { btn.textContent = '★ 已收藏'; btn.classList.add('on'); }
        }
      })();

      body.append(actions);
      card.append(body);
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
            (turn.lines||[]).some(line => {
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

'''

    content = content[:start_idx] + NEW_RENDER_GUIDE + content[end_idx:]

    with open('D:/workbuddy/2026-07-22-20-29-18/js/app.js', 'w', encoding='utf-8') as f:
        f.write(content)

    # Verify
    with open('D:/workbuddy/2026-07-22-20-29-18/js/app.js', 'r', encoding='utf-8') as f:
        v = f.read()
    checks = ['paintSceneCard', 'dg-scene-card', 'dg-en-line', 'dg-zh-toggle', 'dg-key-phrases', '每天自动更新 3 个']
    found = [c for c in checks if c in v]
    print(f'Done! Found {len(found)}/{len(checks)} key markers: {found}')
