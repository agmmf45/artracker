/**
 * health-settings.js — Health Integration Settings UI
 * Injects a settings card into the profile page (#page-profile).
 * Depends on: health-sync/health-sync.js (window.HealthSync)
 *
 * Load after health-sync.js: <script src="health-sync/health-settings.js"></script>
 */
(function (window) {
  'use strict';

  // ─────────────────────────────────────────────────────────
  //  CSS  (injected once into <head>)
  // ─────────────────────────────────────────────────────────
  var CSS = `
/* ── Health Settings Card ── */
#health-integration-card { display: none; }
.hs-card-title {
  font-size: 13px; font-weight: 800; color: var(--muted);
  text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 14px;
}
.hs-header {
  display: flex; align-items: center; gap: 12px; margin-bottom: 16px;
}
.hs-platform-icon { font-size: 32px; line-height: 1; }
.hs-platform-name { font-size: 16px; font-weight: 900; }
.hs-status-line   {
  font-size: 12px; color: var(--muted); margin-top: 3px;
  display: flex; align-items: center; gap: 5px;
}
.hs-status-dot {
  width: 8px; height: 8px; border-radius: 50%;
  display: inline-block; background: var(--muted);
}
.hs-status-dot.connected    { background: var(--green); }
.hs-status-dot.disconnected { background: var(--muted); }
.hs-status-dot.error        { background: var(--red);   }

.hs-toggle-list { display: flex; flex-direction: column; gap: 0; }
.hs-toggle-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 11px 0; border-bottom: 1px solid var(--border);
}
.hs-toggle-row:last-child { border-bottom: none; }
.hs-toggle-label { font-size: 14px; font-weight: 600; }
.hs-toggle-sub   { font-size: 11px; color: var(--muted); margin-top: 2px; }

/* iOS-style toggle */
.hs-toggle {
  position: relative; width: 44px; height: 26px;
  cursor: pointer; flex-shrink: 0;
}
.hs-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
.hs-toggle-track {
  position: absolute; inset: 0; border-radius: 13px;
  background: var(--border); transition: background 0.2s;
}
.hs-toggle input:checked ~ .hs-toggle-track { background: var(--accent); }
.hs-toggle-thumb {
  position: absolute; top: 3px; left: 3px;
  width: 20px; height: 20px; border-radius: 50%;
  background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.25);
  transition: left 0.2s;
}
.hs-toggle input:checked ~ .hs-toggle-thumb { left: 21px; }

.hs-actions {
  display: flex; flex-direction: column; gap: 8px; margin-top: 16px;
}
.hs-sync-now {
  width: 100%; padding: 12px; border-radius: var(--r-sm);
  background: var(--accent); color: #fff; font-weight: 800;
  font-size: 14px; border: none; cursor: pointer;
  font-family: inherit; transition: opacity 0.15s;
}
.hs-sync-now:disabled { opacity: 0.55; cursor: not-allowed; }
.hs-connect-btn {
  width: 100%; padding: 11px; border-radius: var(--r-sm);
  background: none; border: 1.5px solid var(--accent);
  color: var(--accent); font-weight: 700; font-size: 13px;
  cursor: pointer; font-family: inherit; transition: all 0.15s;
}
.hs-connect-btn:hover { background: var(--accent-light); }
.hs-disconnect-btn {
  width: 100%; padding: 11px; border-radius: var(--r-sm);
  background: none; border: 1.5px solid var(--border);
  color: var(--muted); font-weight: 700; font-size: 13px;
  cursor: pointer; font-family: inherit;
}
.hs-last-sync {
  text-align: center; font-size: 11px; color: var(--muted); margin-top: 6px;
}
.hs-web-notice {
  text-align: center; padding: 16px 8px;
  font-size: 13px; color: var(--muted); line-height: 1.6;
}
.hs-web-notice strong { color: var(--text); }

/* Sync dot in top bar */
#health-sync-dot {
  font-size: 13px; cursor: default;
  display: none; margin-right: 4px;
}

/* Workout source badge */
.hs-source-badge {
  font-size: 13px; margin-left: 5px;
  vertical-align: middle; cursor: default;
}
`;

  function _injectCSS() {
    if (document.getElementById('health-sync-css')) return;
    var style = document.createElement('style');
    style.id  = 'health-sync-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  // ─────────────────────────────────────────────────────────
  //  TOGGLE COMPONENT
  // ─────────────────────────────────────────────────────────
  function _makeToggle(id, checked, onChangeFn) {
    return `
      <label class="hs-toggle" for="${id}">
        <input type="checkbox" id="${id}" ${checked ? 'checked' : ''}
               onchange="(${onChangeFn.toString()})(this.checked)">
        <span class="hs-toggle-track"></span>
        <span class="hs-toggle-thumb"></span>
      </label>`;
  }

  // ─────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────
  function render() {
    var card = document.getElementById('health-integration-card');
    if (!card) return;

    var hs = window.HealthSync;
    if (!hs) return;

    // Only show on Capacitor (iOS / Android)
    if (!hs.isCapacitor()) {
      // Show a subtle web notice instead of hiding entirely
      card.style.display = 'block';
      card.innerHTML = `
        <div class="hs-card-title">🫀 تكامل الصحة</div>
        <div class="hs-web-notice">
          مزامنة <strong>Apple Health</strong> و
          <strong>Google Health Connect</strong><br>
          متاحة في تطبيق دقيق على جهازك
        </div>`;
      return;
    }

    var prefs      = hs.getPrefs();
    var state      = hs.getState();
    var isIOS      = hs.isIOS();
    var connected  = prefs.enabled;
    var platform   = isIOS ? 'Apple Health' : 'Google Health Connect';
    var icon       = isIOS ? '🍎' : '🤖';
    var dotClass   = connected ? 'connected' : 'disconnected';
    var statusText = connected
      ? (state.lastSyncAt
          ? 'آخر مزامنة: ' + _relTime(state.lastSyncAt)
          : 'متصل — لم تتم مزامنة بعد')
      : 'غير مرتبط';

    card.style.display = 'block';
    card.innerHTML = `
      <div class="hs-card-title">🫀 تكامل الصحة</div>

      <div class="hs-header">
        <div class="hs-platform-icon">${icon}</div>
        <div>
          <div class="hs-platform-name">${platform}</div>
          <div class="hs-status-line">
            <span class="hs-status-dot ${dotClass}"></span>
            <span id="hs-status-text">${statusText}</span>
          </div>
        </div>
      </div>

      ${connected ? `
      <div class="hs-toggle-list">
        <div class="hs-toggle-row">
          <div>
            <div class="hs-toggle-label">مزامنة التمارين</div>
            <div class="hs-toggle-sub">جلسات القوة، الكارديو، المشي</div>
          </div>
          ${_makeToggle('hs-t-workout', prefs.syncWorkout,
            function(v){ window.HealthSync.savePrefs({ syncWorkout: v }); })}
        </div>
        <div class="hs-toggle-row">
          <div>
            <div class="hs-toggle-label">مزامنة السعرات والتغذية</div>
            <div class="hs-toggle-sub">وجبات، بروتين، كارب، دهون</div>
          </div>
          ${_makeToggle('hs-t-nutrition', prefs.syncNutrition,
            function(v){ window.HealthSync.savePrefs({ syncNutrition: v }); })}
        </div>
        <div class="hs-toggle-row">
          <div>
            <div class="hs-toggle-label">مزامنة الوزن</div>
            <div class="hs-toggle-sub">قراءات الوزن اليومية</div>
          </div>
          ${_makeToggle('hs-t-weight', prefs.syncWeight,
            function(v){ window.HealthSync.savePrefs({ syncWeight: v }); })}
        </div>
        <div class="hs-toggle-row">
          <div>
            <div class="hs-toggle-label">مزامنة شرب الماء</div>
            <div class="hs-toggle-sub">حفظ كميات الماء في تطبيق الصحة</div>
          </div>
          ${_makeToggle('hs-t-water', prefs.syncWater,
            function(v){ window.HealthSync.savePrefs({ syncWater: v }); })}
        </div>
        <div class="hs-toggle-row">
          <div>
            <div class="hs-toggle-label">مزامنة تلقائية</div>
            <div class="hs-toggle-sub">كل 30 دقيقة في الخلفية</div>
          </div>
          ${_makeToggle('hs-t-auto', prefs.autoSync,
            function(v){ window.HealthSync.savePrefs({ autoSync: v }); })}
        </div>
      </div>

      <div class="hs-actions">
        <button class="hs-sync-now" id="hs-sync-btn" onclick="HealthSettings.onSyncNow()">
          🔄 مزامنة الآن
        </button>
        <button class="hs-disconnect-btn" onclick="HealthSettings.onDisconnect()">
          فصل الاتصال
        </button>
      </div>
      <div class="hs-last-sync" id="hs-last-sync-text">
        ${state.lastSyncAt ? 'آخر مزامنة: ' + _relTime(state.lastSyncAt) : ''}
      </div>
      ` : `
      <div class="hs-actions">
        <button class="hs-connect-btn" onclick="HealthSettings.onConnect()">
          🔑 ربط ${platform}
        </button>
      </div>
      <div style="font-size:11px;color:var(--muted);text-align:center;margin-top:8px;line-height:1.6">
        سيطلب التطبيق إذن الوصول لبياناتك الصحية.<br>
        بياناتك تبقى على جهازك فقط.
      </div>
      `}
    `;
  }

  // ─────────────────────────────────────────────────────────
  //  ACTIONS
  // ─────────────────────────────────────────────────────────
  async function onConnect() {
    var btn = document.querySelector('.hs-connect-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ جاري الاتصال...'; }
    try {
      await window.HealthSync.connect();
    } finally {
      render();
    }
  }

  function onDisconnect() {
    if (!confirm('هل تريد إيقاف مزامنة الصحة؟')) return;
    window.HealthSync.disconnect();
    render();
  }

  async function onSyncNow() {
    var btn = document.getElementById('hs-sync-btn');
    if (btn) { btn.disabled = true; btn.textContent = '🔄 جاري المزامنة...'; }
    try {
      var r = await window.HealthSync.sync('manual');
      var txt = r.error
        ? ('❌ خطأ: ' + r.error)
        : ('✅ تم: ↑' + (r.pushed || 0) + ' ↓' + (r.pulled || 0));
      if (window.showToast) window.showToast(txt);
      _updateLastSyncText();
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🔄 مزامنة الآن'; }
    }
  }

  function _updateLastSyncText() {
    var el = document.getElementById('hs-last-sync-text');
    if (!el) return;
    var state = window.HealthSync && window.HealthSync.getState();
    el.textContent = state && state.lastSyncAt
      ? 'آخر مزامنة: ' + _relTime(state.lastSyncAt)
      : '';
  }

  // ─────────────────────────────────────────────────────────
  //  HELPERS
  // ─────────────────────────────────────────────────────────
  function _relTime(isoTs) {
    var diff = Date.now() - new Date(isoTs).getTime();
    var m    = Math.floor(diff / 60000);
    if (m < 1)   return 'الآن';
    if (m < 60)  return 'منذ ' + m + ' دقيقة';
    var h = Math.floor(m / 60);
    if (h < 24)  return 'منذ ' + h + ' ساعة';
    return 'منذ ' + Math.floor(h / 24) + ' يوم';
  }

  // ─────────────────────────────────────────────────────────
  //  INJECT HTML  into profile page (after Export PDF card)
  // ─────────────────────────────────────────────────────────
  function _injectCard() {
    // Check if already injected
    if (document.getElementById('health-integration-card')) return;

    // Find the logout card to insert before it
    var profileSecondCol = document.querySelector('#page-profile .grid-2 > div:last-child');
    if (!profileSecondCol) {
      // Fallback: append to profile page
      var profilePage = document.getElementById('page-profile');
      if (!profilePage) return;
      profileSecondCol = profilePage;
    }

    // Find logout card (contains 'doLogout')
    var logoutCard = null;
    var cards = profileSecondCol.querySelectorAll('.card');
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].innerHTML.includes('doLogout') || cards[i].innerHTML.includes('تسجيل الخروج')) {
        logoutCard = cards[i];
        break;
      }
    }

    var healthCard = document.createElement('div');
    healthCard.className = 'card';
    healthCard.id        = 'health-integration-card';

    if (logoutCard) {
      profileSecondCol.insertBefore(healthCard, logoutCard);
    } else {
      profileSecondCol.appendChild(healthCard);
    }
  }

  // ─────────────────────────────────────────────────────────
  //  SYNC DOT in top bar
  // ─────────────────────────────────────────────────────────
  function _injectSyncDot() {
    if (document.getElementById('health-sync-dot')) return;
    var brandEl = document.querySelector('.tpb-brand');
    if (!brandEl) return;
    var dot = document.createElement('span');
    dot.id  = 'health-sync-dot';
    brandEl.prepend(dot);
  }

  // ─────────────────────────────────────────────────────────
  //  WORKOUT SOURCE BADGES
  //  Annotates history cards with 🍎 / 🤖 after renderFitHistory runs.
  // ─────────────────────────────────────────────────────────
  function _addSourceBadges() {
    var fd       = window.getFitData ? window.getFitData() : (window.myData && window.myData.fitness) || {};
    var workouts = (fd.workouts || []).slice().reverse();   // same order as rendered cards
    var cards    = document.querySelectorAll('#fit-history-list .card');

    workouts.forEach(function (w, i) {
      var card = cards[i];
      if (!card) return;
      if (card.querySelector('.hs-source-badge')) return;   // already annotated

      var icon  = w.source === 'healthkit' ? '🍎' : w.source === 'health_connect' ? '🤖' : '';
      var label = w.source === 'healthkit' ? 'Apple Health' : 'Google Health Connect';
      if (!icon) return;

      var nameDiv = card.querySelector('div > div');   // first child div inside card
      if (nameDiv) {
        var badge = document.createElement('span');
        badge.className = 'hs-source-badge';
        badge.title     = label;
        badge.textContent = icon;
        nameDiv.appendChild(badge);
      }
    });
  }

  // ─────────────────────────────────────────────────────────
  //  PUBLIC API  (window.HealthSettings)
  // ─────────────────────────────────────────────────────────
  var HealthSettings = {
    render:       render,
    onConnect:    onConnect,
    onDisconnect: onDisconnect,
    onSyncNow:    onSyncNow,
  };

  window.HealthSettings = HealthSettings;

  // ─────────────────────────────────────────────────────────
  //  INIT
  // ─────────────────────────────────────────────────────────
  function _init() {
    _injectCSS();
    _injectSyncDot();
    _injectCard();

    // Hook showPage
    var _origShowPage = window.showPage;
    if (typeof _origShowPage === 'function') {
      window.showPage = function (name) {
        var result = _origShowPage.apply(this, arguments);
        if (name === 'profile') {
          setTimeout(render, 50);
        }
        return result;
      };
    }

    // Hook renderFitHistory to annotate imported workouts with source badge
    var _origRFH = window.renderFitHistory;
    if (typeof _origRFH === 'function') {
      window.renderFitHistory = function () {
        var result = _origRFH.apply(this, arguments);
        setTimeout(_addSourceBadges, 0);
        return result;
      };
    }

    // Initial render if already on profile
    var profilePage = document.getElementById('page-profile');
    if (profilePage && profilePage.classList.contains('active')) render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

})(window);
