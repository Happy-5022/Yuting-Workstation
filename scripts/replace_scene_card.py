import re

path = 'D:/workbuddy/2026-07-22-20-29-18/js/app.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = '    // 渲染一个长对话场景卡片（折叠/展开）'
end_marker = '    // 渲染列表'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx)

if start_idx < 0 or end_idx < 0:
    print('ERROR: markers not found', start_idx, end_idx)
    exit(1)

new_block = '''    // 渲染一个长对话场景卡片：一开始就渲染完整对话，用 CSS 控制显示/隐藏（折叠默认隐藏）
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
          const enLines = (turn.lines || []).map((line, li) =>
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
        sc.dialogues.forEach(turn => { (turn.lines || []).forEach(line => allLines.push(line)); });
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

'''

content = content[:start_idx] + new_block + content[end_idx:]

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Replacement done. Verifying...')
# Verify markers still exist (the new block should not contain the old end_marker incorrectly)
with open(path, 'r', encoding='utf-8') as f:
    v = f.read()
print('Has new paintSceneCard:', '// 渲染一个长对话场景卡片：一开始就渲染完整对话，用 CSS 控制显示/隐藏' in v)
print('Has DG_LIST marker:', '// 渲染列表' in v)
print('Old paintSceneBody removed:', 'function paintSceneBody' not in v)
print('Uses speakLang for listenAll:', "speakLang(allLines[i], 'en-US'" in v)
