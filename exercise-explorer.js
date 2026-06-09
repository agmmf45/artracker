// ═══════════════════════════════════════════════════════════════
//  Exercise Explorer — دقيق fitness add-on
//  Hooks into dashMuscleClick() to add:
//   • ExerciseDB API  (exercisedb.io — free, no key required)
//   • Tabbed detail panel: مقدمة / تمارين / فيديوهات / تعافي
//   • Draggable, collapsible video player panel
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // ── Config ────────────────────────────────────────────────────
  const API       = 'https://exercisedb.io/api';
  const CACHE_KEY = 'artrk_exdb_v1_';
  const CACHE_TTL = 24 * 3600 * 1000; // 24 h
  const EX_LIMIT  = 15;

  // ── Arabic label → ExerciseDB target + bodyPart ───────────────
  const MUS_MAP = {
    'صدر':     { target:'pectorals',             bodyPart:'chest' },
    'ظهر':     { target:'lats',                  bodyPart:'back' },
    'كتف':     { target:'delts',                 bodyPart:'shoulders' },
    'باي':     { target:'biceps',                bodyPart:'upper arms' },
    'بايسبس':  { target:'biceps',                bodyPart:'upper arms' },
    'تراي':    { target:'triceps',               bodyPart:'upper arms' },
    'ترايسبس': { target:'triceps',               bodyPart:'upper arms' },
    'رجل':     { target:'quads',                 bodyPart:'upper legs' },
    'ساق':     { target:'quads',                 bodyPart:'upper legs' },
    'بطن':     { target:'abs',                   bodyPart:'waist' },
    'ساعد':    { target:'forearms',              bodyPart:'lower arms' },
    'كارديو':  { target:'cardiovascular system', bodyPart:'cardio' },
    'أرداف':   { target:'glutes',               bodyPart:'upper legs' },
  };

  // ── Curated YouTube video IDs (preferred channels) ───────────
  // Add / update video IDs here from: Jeff Nippard, Athlean-X,
  // Jeremy Ethier, Renaissance Periodization, Built With Science
  // Format: { id, title, channel }
  const VID_DB = {
    'bench press':           [{ id:'rT7DgCr-3pg', title:'Bench Press Full Guide',     ch:'Jeff Nippard' },
                              { id:'SCVCLChPQEY', title:'Perfect Bench Press',         ch:'Athlean-X' }],
    'incline bench press':   [{ id:'DbFgADa2PL8', title:'Incline Bench Press Guide',  ch:'Jeremy Ethier' }],
    'barbell squat':         [{ id:'ultWZbUMPL8', title:'How To Squat',               ch:'Athlean-X' },
                              { id:'nEQQle9-0NA', title:'Squat Technique',             ch:'Jeremy Ethier' }],
    'deadlift':              [{ id:'op9kVnSso6Q', title:'Deadlift Tutorial',          ch:'Athlean-X' },
                              { id:'ytGaGIn3SjE', title:'Deadlift Technique',          ch:'Jeff Nippard' }],
    'romanian deadlift':     [{ id:'JCXUYuzwNrM', title:'Romanian Deadlift Guide',   ch:'Jeff Nippard' }],
    'overhead press':        [{ id:'2yjwXTZbDtY', title:'Overhead Press Form',        ch:'Athlean-X' }],
    'lateral raise':         [{ id:'FeRxNWuVxzw', title:'Lateral Raise Tutorial',     ch:'Jeremy Ethier' }],
    'pull-up':               [{ id:'eGo4IYlbE5g', title:'Pull-Up Tutorial',           ch:'Athlean-X' }],
    'lat pulldown':          [{ id:'CAwf7n6Luuc', title:'Lat Pulldown Guide',         ch:'Jeremy Ethier' }],
    'barbell row':           [{ id:'kBWAon7ItDw', title:'Barbell Row Technique',      ch:'Jeff Nippard' }],
    'bicep curl':            [{ id:'ykJmrZ5v0Oo', title:'Bicep Curl Tutorial',        ch:'Athlean-X' }],
    'hammer curl':           [{ id:'zC3nLlEvin4', title:'Hammer Curl Guide',          ch:'Jeff Nippard' }],
    'tricep pushdown':       [{ id:'2-LAMcpzODU', title:'Tricep Pushdown Form',       ch:'Athlean-X' }],
    'skull crusher':         [{ id:'d_KZxkY_0cM', title:'Skull Crusher Tutorial',    ch:'Jeff Nippard' }],
    'leg press':             [{ id:'yZmx_Ac3R8k', title:'Leg Press Technique',        ch:'Athlean-X' }],
    'lunge':                 [{ id:'QOVaHwm-Q6U', title:'Lunge Form Guide',           ch:'Jeremy Ethier' }],
    'plank':                 [{ id:'pvIjChbkIZs', title:'Perfect Plank Form',         ch:'Athlean-X' }],
    'cable fly':             [{ id:'TAj8LFhLMrk', title:'Cable Fly Tutorial',         ch:'Athlean-X' }],
  };

  // ── Recovery data per bodyPart ────────────────────────────────
  const REC = {
    'chest':      { rest:'48–72 ساعة', vol:'10–20 جلسة/أسبوع',
                    tips:['تمدّد عضلة الصدر 30 ث × 3 بعد كل جلسة',
                          'بروتين خلال 30 دقيقة من انتهاء التمرين',
                          'الضغط الخفيف يوم الراحة يزيد تدفق الدم'] },
    'back':       { rest:'48–72 ساعة', vol:'10–20 جلسة/أسبوع',
                    tips:['تمدّد العمود الفقري للأمام 20 ثانية',
                          'نوم 7–9 ساعات يُضاعف إفراز هرمون النمو',
                          'تدريب أحادي الذراع يقلل الإجهاد'] },
    'shoulders':  { rest:'48 ساعة',    vol:'12–20 جلسة/أسبوع',
                    tips:['تجنّب الرفع فوق الرأس في أيام الراحة',
                          'تمدّد الدلتا الأمامي والخلفي 20 ث',
                          'الكتف تُحمّل في كل تمرين علوي — راحتها مهمة'] },
    'upper arms': { rest:'48 ساعة',    vol:'12–20 جلسة/أسبوع',
                    tips:['تمدّد الباي والتراي مع الإحماء',
                          'الذراعان تتعافيان أسرع من الجذع',
                          'تدريبها مرتين/أسبوع مثالي للبداية'] },
    'upper legs': { rest:'72 ساعة',    vol:'10–20 جلسة/أسبوع',
                    tips:['المشي الخفيف يوم بعد السكوات يسرّع التعافي',
                          'تمدّد رباعية الفخذ 30 ث × 2 جانب',
                          'الساقان تحتاج أطول راحة — لا تتسرع'] },
    'waist':      { rest:'24–48 ساعة', vol:'12–25 جلسة/أسبوع',
                    tips:['البطن يتحمّل تدريباً خفيفاً يومياً',
                          'ربط التنفس بالحركة يضاعف التأثير',
                          'الرياضة الهوائية تحرق دهون البطن أكثر'] },
    'lower arms': { rest:'24 ساعة',    vol:'8–16 جلسة/أسبوع',
                    tips:['تمدّد المعصم للأمام والخلف 15 ث',
                          'الساعد يتعافى بسرعة ويتحمّل التكرار',
                          'قبضة الحديد تتطور مع الوقت — لا تتعجّل'] },
    'cardio':     { rest:'24 ساعة',    vol:'150 دقيقة/أسبوع',
                    tips:['الكارديو المعتدل يسرّع تعافي العضلات',
                          'ابقَ مرطّبًا: 30–40 مل ماء لكل كجم يومياً',
                          'النوم الجيد يوازن هرمونات الطاقة'] },
  };
  const REC_DEFAULT = REC['chest'];

  // ─────────────────────────────────────────────
  //  Cache helpers
  // ─────────────────────────────────────────────
  function cGet(key) {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY + key);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (Date.now() - obj.ts > CACHE_TTL) { sessionStorage.removeItem(CACHE_KEY + key); return null; }
      return obj.data;
    } catch { return null; }
  }
  function cSet(key, data) {
    try { sessionStorage.setItem(CACHE_KEY + key, JSON.stringify({ ts: Date.now(), data })); } catch { }
  }

  // ─────────────────────────────────────────────
  //  ExerciseDB API
  // ─────────────────────────────────────────────
  async function fetchExercises(muscle) {
    const map = MUS_MAP[muscle] || { target: muscle.toLowerCase(), bodyPart: muscle.toLowerCase() };
    const ck  = map.target;
    const hit = cGet(ck);
    if (hit) return hit;

    const tryFetch = async (url) => {
      const r = await fetch(url, { signal: AbortSignal.timeout(7000) });
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      if (!Array.isArray(d) || !d.length) throw new Error('empty');
      return d;
    };

    try {
      const data = await tryFetch(`${API}/exercises/target/${encodeURIComponent(map.target)}?limit=${EX_LIMIT}`);
      cSet(ck, data); return data;
    } catch {
      try {
        const data = await tryFetch(`${API}/exercises/bodyPart/${encodeURIComponent(map.bodyPart)}?limit=${EX_LIMIT}`);
        cSet(ck, data); return data;
      } catch { return null; }
    }
  }

  // ─────────────────────────────────────────────
  //  Video helpers
  // ─────────────────────────────────────────────
  function findCurated(exName) {
    const k = (exName || '').toLowerCase();
    if (VID_DB[k]) return VID_DB[k];
    for (const [key, vids] of Object.entries(VID_DB)) {
      if (k.includes(key) || key.includes(k)) return vids;
    }
    return [];
  }
  function ytThumb(id) { return `https://img.youtube.com/vi/${id}/hqdefault.jpg`; }
  function ytSearch(q) { return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`; }

  // ─────────────────────────────────────────────
  //  Draggable video panel
  // ─────────────────────────────────────────────
  let _panel = null, _panelMin = false;

  function ensurePanel() {
    if (_panel) return;
    _panel = document.createElement('div');
    _panel.id = 'exdb-vid-panel';
    _panel.innerHTML = `
      <div id="exdb-vid-hdr">
        <span id="exdb-vid-label" style="flex:1;font-size:11px;font-weight:700;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;padding-right:4px"></span>
        <button class="evb" onclick="exdbVidToggle()" title="تصغير/تكبير">⬛</button>
        <button class="evb" onclick="exdbVidExpand()" title="توسيع">⬜</button>
        <button class="evb" onclick="exdbVidClose()" title="إغلاق">✕</button>
      </div>
      <div id="exdb-vid-body">
        <iframe id="exdb-vid-frame" frameborder="0"
          allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture"
          allowfullscreen style="width:100%;height:100%;border:0;display:block"></iframe>
      </div>`;
    document.body.appendChild(_panel);
    makeDraggable(_panel, document.getElementById('exdb-vid-hdr'));
  }

  window.exdbPlayVideo = function (id, title) {
    ensurePanel();
    document.getElementById('exdb-vid-label').textContent = title || 'فيديو';
    document.getElementById('exdb-vid-frame').src =
      `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&autoplay=0`;
    _panel.style.display = 'block';
    _panelMin = false;
    document.getElementById('exdb-vid-body').style.display = 'block';
  };
  window.exdbVidToggle = function () {
    _panelMin = !_panelMin;
    const body = document.getElementById('exdb-vid-body');
    body.style.display = _panelMin ? 'none' : 'block';
    if (_panelMin) document.getElementById('exdb-vid-frame').src = ''; // stop playback
  };
  window.exdbVidExpand = function () {
    _panel && _panel.classList.toggle('exdb-vid-xl');
    if (_panelMin) { window.exdbVidToggle(); }
  };
  window.exdbVidClose = function () {
    if (!_panel) return;
    document.getElementById('exdb-vid-frame').src = '';
    _panel.style.display = 'none';
    _panel.classList.remove('exdb-vid-xl');
    _panelMin = false;
  };

  function makeDraggable(el, handle) {
    let sx = 0, sy = 0, ox = 0, oy = 0, active = false;
    handle.style.cursor = 'move';
    handle.addEventListener('pointerdown', e => {
      if (e.target.closest('.evb')) return;
      active = true;
      handle.setPointerCapture(e.pointerId);
      sx = e.clientX; sy = e.clientY;
      const r = el.getBoundingClientRect();
      ox = r.left; oy = r.top;
      el.style.right = 'auto'; el.style.bottom = 'auto';
      el.style.left = ox + 'px'; el.style.top = oy + 'px';
    });
    handle.addEventListener('pointermove', e => {
      if (!active) return;
      el.style.left = Math.max(0, ox + e.clientX - sx) + 'px';
      el.style.top  = Math.max(0, oy + e.clientY - sy) + 'px';
    });
    handle.addEventListener('pointerup', () => { active = false; });
  }

  // ─────────────────────────────────────────────
  //  Explorer modal state
  // ─────────────────────────────────────────────
  let _muscle = null, _exercises = [], _tab = 'overview', _fetching = false;

  function openExplorer(muscle) {
    _muscle    = muscle;
    _exercises = [];
    _tab       = 'overview';
    _fetching  = true;
    const m = document.getElementById('exdb-modal');
    if (!m) return;
    document.getElementById('exdb-modal-title').textContent = '💪 ' + muscle;
    m.classList.add('open');
    renderTab('overview');

    fetchExercises(muscle).then(data => {
      _fetching = false;
      if (data) _exercises = data;
      // Refresh current tab if it's waiting for data
      if (_tab === 'exercises' || _tab === 'videos') renderTab(_tab);
      // Also refresh overview exercise preview
      if (_tab === 'overview') _refreshOverviewPrev();
    });
  }
  window.openMuscleExplorer = openExplorer;

  // ─────────────────────────────────────────────
  //  Tab renderer
  // ─────────────────────────────────────────────
  function renderTab(tab) {
    _tab = tab;
    document.querySelectorAll('.exdb-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === tab));
    const body = document.getElementById('exdb-modal-body');
    if (!body) return;

    const map = MUS_MAP[_muscle] || {};
    const bp  = map.bodyPart || _muscle;
    const rec = REC[bp] || REC_DEFAULT;

    // ── Overview ──────────────────────────────
    if (tab === 'overview') {
      body.innerHTML = `
        <div class="exdb-ov-hero">
          <div class="exdb-ov-name">${_muscle}</div>
          <div class="exdb-ov-eng">${bp}</div>
        </div>
        <div class="exdb-ov-chips">
          <div class="exdb-chip">⏱ ${rec.rest}</div>
          <div class="exdb-chip">📊 ${rec.vol}</div>
        </div>
        <div class="exdb-sec">نصائح التعافي</div>
        <ul class="exdb-tips">${rec.tips.map(t => `<li>${t}</li>`).join('')}</ul>
        <div class="exdb-sec">معاينة التمارين</div>
        <div class="exdb-ov-prev" id="exdb-ov-prev">
          ${_exercises.length
            ? _exercises.slice(0, 4).map(_exMiniCard).join('')
            : `<div class="exdb-ov-loading"><div class="exdb-spin"></div><span>جاري التحميل…</span></div>`}
        </div>
        <button class="exdb-more-btn" onclick="renderExplorerTab('exercises')">عرض جميع التمارين ←</button>`;
      return;
    }

    // ── Exercises ─────────────────────────────
    if (tab === 'exercises') {
      if (_fetching || (!_exercises.length && _fetching)) {
        body.innerHTML = `<div class="exdb-loading"><div class="exdb-spin"></div><div>جاري تحميل التمارين…</div></div>`;
        return;
      }
      if (!_exercises.length) {
        body.innerHTML = `<div class="exdb-empty">⚠️ تعذّر تحميل بيانات ExerciseDB — تحقق من الاتصال</div>`;
        return;
      }
      body.innerHTML = `
        <div class="exdb-count">${_exercises.length} تمرين لـ <strong>${_muscle}</strong> · ExerciseDB</div>
        <div class="exdb-ex-list">${_exercises.map((ex, i) => _exCard(ex, i)).join('')}</div>`;
      return;
    }

    // ── Videos ────────────────────────────────
    if (tab === 'videos') {
      // Collect curated videos for exercises we have
      const sections = (_exercises.length ? _exercises : [{ name: _muscle }])
        .slice(0, 10)
        .map(ex => ({ name: ex.name, vids: findCurated(ex.name) }))
        .filter(s => s.vids.length);

      const searchQueries = [
        { label: 'الأسلوب الصحيح',  q: `${_muscle} proper form` },
        { label: 'شرح مبسط',         q: `${_muscle} tutorial` },
        { label: 'نصائح متقدمة',     q: `${_muscle} technique tips Jeff Nippard Athlean-X` },
      ];

      body.innerHTML = `
        ${sections.length ? `
          <div class="exdb-sec" style="margin-top:4px">فيديوهات مقترحة</div>
          <div class="exdb-vid-grid">
            ${sections.flatMap(s => s.vids.map(v => `
              <div class="exdb-vid-card" onclick="exdbPlayVideo('${v.id}','${v.title.replace(/'/g,"\\'")}')">
                <div class="exdb-vid-thumb-w">
                  <img src="${ytThumb(v.id)}" alt="${v.title}" class="exdb-vid-thumb" loading="lazy">
                  <div class="exdb-vid-play">▶</div>
                </div>
                <div class="exdb-vid-info">
                  <div class="exdb-vid-title">${v.title}</div>
                  <div class="exdb-vid-ch">${v.ch}</div>
                </div>
              </div>`)).join('')}
          </div>` : ''}
        <div class="exdb-sec" style="margin-top:${sections.length ? '16px' : '4px'}">🔍 بحث على YouTube</div>
        <div class="exdb-yt-links">
          ${searchQueries.map(q => `
            <a href="${ytSearch(q.q)}" target="_blank" rel="noopener" class="exdb-yt-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.19a3 3 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3 3 0 0 0 .5 6.19C0 8.04 0 12 0 12s0 3.96.5 5.81a3 3 0 0 0 2.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3 3 0 0 0 2.12-2.14C24 15.96 24 12 24 12s0-3.96-.5-5.81zM9.75 15.5V8.5l6.25 3.5-6.25 3.5z"/></svg>
              ${q.label}
            </a>`).join('')}
        </div>
        <div class="exdb-vid-note">
          💡 افتح فيديو من YouTube ثم انسخ معرّف الفيديو (الحروف بعد watch?v=) وأدخله هنا:
          <div class="exdb-vid-paste">
            <input type="text" id="exdb-vid-id-inp" placeholder="مثال: dZgVxmf6jkA" class="exdb-inp" maxlength="20" dir="ltr">
            <button class="exdb-btn-sm" onclick="exdbPlayFromInput()">تشغيل</button>
          </div>
        </div>`;
      return;
    }

    // ── Recovery ──────────────────────────────
    if (tab === 'recovery') {
      body.innerHTML = `
        <div class="exdb-rec-grid">
          <div class="exdb-rec-card"><div class="exdb-rec-ico">⏱</div>
            <div><div class="exdb-rec-lbl">وقت الراحة</div><div class="exdb-rec-val">${rec.rest}</div></div></div>
          <div class="exdb-rec-card"><div class="exdb-rec-ico">📊</div>
            <div><div class="exdb-rec-lbl">الحجم الأسبوعي</div><div class="exdb-rec-val">${rec.vol}</div></div></div>
          <div class="exdb-rec-card"><div class="exdb-rec-ico">🍗</div>
            <div><div class="exdb-rec-lbl">بروتين موصى به</div><div class="exdb-rec-val">1.6–2.2 جم/كجم</div></div></div>
          <div class="exdb-rec-card"><div class="exdb-rec-ico">💧</div>
            <div><div class="exdb-rec-lbl">ماء يومي</div><div class="exdb-rec-val">30–40 مل/كجم</div></div></div>
        </div>
        <div class="exdb-sec">نصائح التعافي</div>
        <ul class="exdb-tips">
          ${rec.tips.map(t => `<li>${t}</li>`).join('')}
          <li>النوم 7–9 ساعات يُضاعف إفراز هرمون النمو</li>
          <li>الإحماء الخفيف يوم الراحة يسرّع التعافي</li>
        </ul>
        <div class="exdb-sec">⚠️ علامات الإفراط في التدريب</div>
        <div class="exdb-warns">
          <div class="exdb-warn">ألم حاد لا يزول بعد 72 ساعة</div>
          <div class="exdb-warn">ضعف غير مبرر في الأداء</div>
          <div class="exdb-warn">اضطراب في النوم أو الشهية</div>
        </div>`;
      return;
    }
  }
  window.renderExplorerTab = renderTab;

  window.exdbPlayFromInput = function () {
    const v = (document.getElementById('exdb-vid-id-inp')?.value || '').trim();
    if (!v) return;
    window.exdbPlayVideo(v, _muscle + ' — فيديو');
  };

  // ─────────────────────────────────────────────
  //  Card templates
  // ─────────────────────────────────────────────
  function _exMiniCard(ex) {
    return `<div class="exdb-mini-card">
      ${ex.gifUrl
        ? `<img src="${ex.gifUrl}" alt="${ex.name}" loading="lazy" class="exdb-mini-gif">`
        : `<div class="exdb-mini-gif exdb-mini-ph">💪</div>`}
      <div class="exdb-mini-lbl">${ex.name}</div>
    </div>`;
  }

  function _exCard(ex, i) {
    const vids    = findCurated(ex.name);
    const hasMul  = ex.secondaryMuscles?.length;
    const hasInst = ex.instructions?.length;
    return `
      <div class="exdb-ex-card">
        <div class="exdb-ex-gif-w">
          ${ex.gifUrl
            ? `<img src="${ex.gifUrl}" alt="${ex.name}" loading="lazy" class="exdb-ex-gif">`
            : `<div class="exdb-ex-gif exdb-gif-ph">💪</div>`}
        </div>
        <div class="exdb-ex-body">
          <div class="exdb-ex-name">${ex.name}</div>
          <div class="exdb-ex-tags">
            <span class="exdb-tag exdb-tag-prim">${ex.target || ''}</span>
            ${(ex.secondaryMuscles || []).slice(0, 2).map(m => `<span class="exdb-tag">${m}</span>`).join('')}
            <span class="exdb-tag exdb-tag-eq">🏋 ${ex.equipment || 'body weight'}</span>
          </div>
          ${hasInst ? `
            <div id="exdb-inst-${i}" style="display:none;margin:8px 0">
              ${ex.instructions.map((s, n) => `
                <div class="exdb-step"><span class="exdb-step-n">${n + 1}</span>${s}</div>`).join('')}
            </div>
            <button class="exdb-toggle-btn" onclick="
              var d=document.getElementById('exdb-inst-${i}');
              var open=d.style.display!=='none';
              d.style.display=open?'none':'block';
              this.textContent=open?'▸ خطوات التنفيذ':'▴ إخفاء';
            ">▸ خطوات التنفيذ</button>` : ''}
          <div class="exdb-ex-act">
            <button class="exdb-btn-sm" onclick="exdbLog('${ex.name.replace(/'/g,"\\'")}','${(_muscle||'').replace(/'/g,"\\'")}')">+ سجّل</button>
            ${vids.length
              ? `<button class="exdb-btn-sm exdb-btn-vid" onclick="exdbPlayVideo('${vids[0].id}','${ex.name.replace(/'/g,"\\'")}')">🎬 فيديو</button>`
              : `<a class="exdb-btn-sm exdb-btn-yt" href="${ytSearch(ex.name + ' tutorial')}" target="_blank" rel="noopener">🔍 YouTube</a>`}
          </div>
        </div>
      </div>`;
  }

  function _refreshOverviewPrev() {
    const el = document.getElementById('exdb-ov-prev');
    if (!el || _tab !== 'overview') return;
    el.innerHTML = _exercises.slice(0, 4).map(_exMiniCard).join('');
  }

  window.exdbLog = function (name, muscle) {
    document.getElementById('exdb-modal')?.classList.remove('open');
    if (typeof openQuickLog === 'function') openQuickLog(name, muscle);
  };

  // ─────────────────────────────────────────────
  //  Inject CSS
  // ─────────────────────────────────────────────
  function injectCSS() {
    const s = document.createElement('style');
    s.textContent = `
/* ── Explorer modal backdrop ── */
#exdb-modal{
  position:fixed;inset:0;z-index:4200;
  display:flex;align-items:flex-end;justify-content:center;
  background:rgba(0,0,0,0);pointer-events:none;
  transition:background .25s;
}
#exdb-modal.open{background:rgba(0,0,0,.55);pointer-events:all;}

/* ── Sheet ── */
#exdb-sheet{
  width:100%;max-width:560px;
  background:var(--surface);border-radius:20px 20px 0 0;
  height:78vh;display:flex;flex-direction:column;
  transform:translateY(100%);
  transition:transform .32s cubic-bezier(.34,1,.64,1);
  overflow:hidden;
}
#exdb-modal.open #exdb-sheet{transform:translateY(0);}

#exdb-drag-bar{width:40px;height:4px;border-radius:99px;background:var(--border);margin:12px auto 6px;flex-shrink:0;}
#exdb-modal-hdr{display:flex;align-items:center;justify-content:space-between;padding:0 16px 10px;flex-shrink:0;}
#exdb-modal-title{font-size:18px;font-weight:900;margin:0;}
.exdb-close-btn{background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer;padding:4px 8px;}

/* ── Tabs ── */
.exdb-tabs{display:flex;gap:4px;padding:0 12px 10px;border-bottom:1px solid var(--border);overflow-x:auto;flex-shrink:0;}
.exdb-tab{background:none;border:none;color:var(--muted);font-size:12px;font-weight:700;
  padding:6px 14px;border-radius:99px;cursor:pointer;white-space:nowrap;
  transition:all .15s;font-family:inherit;}
.exdb-tab.active{background:var(--accent);color:#fff;}

/* ── Body ── */
#exdb-modal-body{flex:1;overflow-y:auto;padding:14px 16px 24px;}

/* ── Overview ── */
.exdb-ov-hero{text-align:center;padding:8px 0 14px;}
.exdb-ov-name{font-size:32px;font-weight:900;}
.exdb-ov-eng{font-size:13px;color:var(--muted);margin-top:3px;text-transform:capitalize;}
.exdb-ov-chips{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:16px;}
.exdb-chip{background:var(--surface2);border:1px solid var(--border);border-radius:99px;padding:5px 14px;font-size:12px;font-weight:700;}
.exdb-sec{font-size:11px;font-weight:900;color:var(--muted);text-transform:uppercase;letter-spacing:.7px;margin:14px 0 8px;}
.exdb-tips{padding-right:18px;margin:0;display:flex;flex-direction:column;gap:7px;}
.exdb-tips li{font-size:13px;line-height:1.55;}
.exdb-ov-prev{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;}
.exdb-ov-loading{grid-column:1/-1;display:flex;align-items:center;gap:8px;color:var(--muted);font-size:12px;padding:8px 0;}
.exdb-mini-card{background:var(--surface2);border:1px solid var(--border);border-radius:12px;
  padding:8px 4px;display:flex;flex-direction:column;align-items:center;gap:5px;}
.exdb-mini-gif{width:56px;height:56px;border-radius:8px;object-fit:cover;background:var(--surface);}
.exdb-mini-ph{display:flex;align-items:center;justify-content:center;font-size:24px;}
.exdb-mini-lbl{font-size:9px;font-weight:700;text-align:center;line-height:1.3;text-transform:capitalize;}
.exdb-more-btn{width:100%;padding:10px;background:none;border:1.5px solid var(--border);
  border-radius:12px;color:var(--accent);font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;}

/* ── Exercise list ── */
.exdb-count{font-size:11px;color:var(--muted);margin-bottom:10px;}
.exdb-count strong{color:var(--accent);}
.exdb-ex-list{display:flex;flex-direction:column;gap:10px;}
.exdb-ex-card{display:flex;gap:12px;background:var(--surface2);
  border:1.5px solid var(--border);border-radius:14px;padding:12px;overflow:hidden;}
.exdb-ex-gif-w{flex-shrink:0;width:80px;height:80px;border-radius:10px;overflow:hidden;background:var(--surface);}
.exdb-ex-gif{width:80px;height:80px;object-fit:cover;display:block;}
.exdb-gif-ph{display:flex;align-items:center;justify-content:center;font-size:28px;}
.exdb-ex-body{flex:1;min-width:0;}
.exdb-ex-name{font-size:13px;font-weight:800;text-transform:capitalize;margin-bottom:6px;line-height:1.3;}
.exdb-ex-tags{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;}
.exdb-tag{font-size:9px;font-weight:700;padding:2px 7px;border-radius:99px;background:var(--surface);border:1px solid var(--border);}
.exdb-tag-prim{background:color-mix(in srgb,var(--accent) 15%,transparent);
  border-color:color-mix(in srgb,var(--accent) 30%,transparent);color:var(--accent);}
.exdb-tag-eq{background:color-mix(in srgb,var(--green) 12%,transparent);
  border-color:color-mix(in srgb,var(--green) 25%,transparent);}
.exdb-step{display:flex;gap:8px;font-size:11px;line-height:1.5;margin-bottom:4px;}
.exdb-step-n{flex-shrink:0;width:18px;height:18px;background:var(--accent);color:#fff;
  border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;margin-top:1px;}
.exdb-toggle-btn{background:none;border:none;color:var(--accent);font-size:11px;font-weight:700;cursor:pointer;padding:3px 0;font-family:inherit;}
.exdb-ex-act{display:flex;gap:6px;margin-top:8px;}
.exdb-btn-sm{font-size:11px;font-weight:700;padding:5px 10px;border-radius:8px;
  border:1.5px solid var(--border);background:var(--surface);cursor:pointer;font-family:inherit;color:var(--text);}
.exdb-btn-vid{border-color:var(--accent);color:var(--accent);}
a.exdb-btn-yt{border-color:#cc0000;color:#cc0000;text-decoration:none;display:inline-flex;align-items:center;}

/* ── Videos tab ── */
.exdb-vid-grid{display:flex;flex-direction:column;gap:10px;}
.exdb-vid-card{display:flex;gap:10px;cursor:pointer;background:var(--surface2);
  border:1.5px solid var(--border);border-radius:12px;padding:10px;transition:border-color .15s;}
.exdb-vid-card:hover{border-color:var(--accent);}
.exdb-vid-thumb-w{flex-shrink:0;width:100px;height:60px;border-radius:8px;overflow:hidden;
  background:var(--surface);position:relative;}
.exdb-vid-thumb{width:100%;height:100%;object-fit:cover;display:block;}
.exdb-vid-play{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  background:rgba(0,0,0,.35);color:#fff;font-size:20px;opacity:0;transition:opacity .15s;}
.exdb-vid-card:hover .exdb-vid-play{opacity:1;}
.exdb-vid-info{flex:1;min-width:0;}
.exdb-vid-title{font-size:12px;font-weight:700;line-height:1.3;text-transform:capitalize;}
.exdb-vid-ch{font-size:11px;color:var(--muted);margin-top:3px;}
.exdb-yt-links{display:flex;flex-direction:column;gap:7px;}
.exdb-yt-link{display:flex;align-items:center;gap:10px;padding:10px 13px;
  background:var(--surface2);border:1.5px solid var(--border);border-radius:10px;
  color:var(--text);text-decoration:none;font-size:13px;font-weight:600;transition:border-color .15s;}
.exdb-yt-link:hover{border-color:var(--accent);color:var(--accent);}
.exdb-vid-note{margin-top:16px;padding:12px;background:var(--surface2);border-radius:10px;
  font-size:12px;color:var(--muted);line-height:1.6;}
.exdb-vid-paste{display:flex;gap:8px;margin-top:8px;}
.exdb-inp{flex:1;background:var(--surface);border:1.5px solid var(--border);border-radius:8px;
  padding:7px 10px;font-size:13px;color:var(--text);font-family:inherit;outline:none;}
.exdb-inp:focus{border-color:var(--accent);}

/* ── Recovery ── */
.exdb-rec-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:4px;}
.exdb-rec-card{display:flex;align-items:center;gap:12px;background:var(--surface2);
  border:1.5px solid var(--border);border-radius:12px;padding:12px;}
.exdb-rec-ico{font-size:24px;flex-shrink:0;}
.exdb-rec-lbl{font-size:10px;color:var(--muted);font-weight:700;}
.exdb-rec-val{font-size:14px;font-weight:900;margin-top:2px;}
.exdb-warns{display:flex;flex-direction:column;gap:6px;}
.exdb-warn{font-size:12px;padding:9px 12px;
  background:color-mix(in srgb,var(--red) 10%,transparent);
  border:1px solid color-mix(in srgb,var(--red) 20%,transparent);border-radius:8px;}
.exdb-warn::before{content:'⚠️ ';margin-left:4px;}

/* ── Loading / empty ── */
.exdb-loading{display:flex;flex-direction:column;align-items:center;justify-content:center;
  height:160px;gap:10px;color:var(--muted);font-size:13px;}
.exdb-empty{text-align:center;padding:24px;color:var(--muted);font-size:13px;}
.exdb-spin{width:26px;height:26px;border:3px solid var(--border);
  border-top-color:var(--accent);border-radius:50%;animation:exdb-spin .8s linear infinite;}
@keyframes exdb-spin{to{transform:rotate(360deg)}}

/* ── Video panel ── */
#exdb-vid-panel{
  position:fixed;right:14px;bottom:76px;
  width:300px;background:var(--surface);
  border:1.5px solid var(--border);border-radius:14px;
  box-shadow:0 8px 32px rgba(0,0,0,.45);
  z-index:5500;display:none;overflow:hidden;
  transition:width .2s,height .2s;
}
#exdb-vid-panel.exdb-vid-xl{width:420px;}
#exdb-vid-hdr{
  display:flex;align-items:center;gap:4px;
  padding:8px 10px;background:var(--surface2);
  border-bottom:1px solid var(--border);
  user-select:none;
}
.evb{background:none;border:none;cursor:pointer;
  font-size:11px;padding:3px 7px;border-radius:6px;
  color:var(--muted);font-family:inherit;}
.evb:hover{background:var(--border);color:var(--text);}
#exdb-vid-body{height:175px;transition:height .2s;}
#exdb-vid-panel.exdb-vid-xl #exdb-vid-body{height:250px;}
`;
    document.head.appendChild(s);
  }

  // ─────────────────────────────────────────────
  //  Inject HTML
  // ─────────────────────────────────────────────
  function injectHTML() {
    const el = document.createElement('div');
    el.id = 'exdb-modal';
    el.onclick = e => { if (e.target === el) el.classList.remove('open'); };
    el.innerHTML = `
      <div id="exdb-sheet">
        <div id="exdb-drag-bar"></div>
        <div id="exdb-modal-hdr">
          <h3 id="exdb-modal-title">💪 العضلة</h3>
          <button class="exdb-close-btn" onclick="document.getElementById('exdb-modal').classList.remove('open')">✕</button>
        </div>
        <div class="exdb-tabs">
          <button class="exdb-tab active" data-tab="overview"  onclick="renderExplorerTab('overview')">مقدمة</button>
          <button class="exdb-tab"        data-tab="exercises" onclick="renderExplorerTab('exercises')">تمارين</button>
          <button class="exdb-tab"        data-tab="videos"    onclick="renderExplorerTab('videos')">فيديوهات</button>
          <button class="exdb-tab"        data-tab="recovery"  onclick="renderExplorerTab('recovery')">تعافي</button>
        </div>
        <div id="exdb-modal-body"></div>
      </div>`;
    document.body.appendChild(el);
  }

  // ─────────────────────────────────────────────
  //  Hook into dashMuscleClick
  // ─────────────────────────────────────────────
  function hookDashMuscleClick() {
    if (typeof window.dashMuscleClick !== 'function') return;
    const orig = window.dashMuscleClick;
    window.dashMuscleClick = function (muscle) {
      orig.call(this, muscle);
      document.getElementById('exdb-modal-title').textContent = '💪 ' + muscle;
      openExplorer(muscle);
    };
  }

  // ─────────────────────────────────────────────
  //  Boot
  // ─────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectCSS(); injectHTML(); hookDashMuscleClick();
    });
  } else {
    injectCSS(); injectHTML();
    // dashMuscleClick is defined in the main inline script — tiny delay to be safe
    setTimeout(hookDashMuscleClick, 50);
  }

})();
