/**
 * water-tracker.js — تتبع شرب الماء
 * ميزة مستقلة لا تحتاج Health Sync.
 * تُحقن في صفحة السعرات (#page-nutrition) بعد nutri-macros.
 *
 * Data model: myData.nutrition.water = { 'YYYY-MM-DD': totalMl, ... }
 *
 * أضف في index.html قبل </body>:
 *   <script src="water-tracker.js"></script>
 */
(function (window) {
  'use strict';

  // ─── إعدادات ───────────────────────────────────────────
  var DEFAULT_GOAL_ML = 2000;
  var QUICK_AMOUNTS   = [150, 200, 250, 330, 500];  // ml
  var WIDGET_ID       = 'water-tracker-widget';

  // ─── CSS ───────────────────────────────────────────────
  var CSS = `
/* ── Water Tracker ── */
#${WIDGET_ID} { margin-bottom: 18px; }

.wt-card {
  background: var(--surface);
  border-radius: var(--r);
  border: 1px solid var(--border);
  padding: 16px 18px;
  box-shadow: var(--shadow);
}

.wt-header {
  display: flex; align-items: center;
  justify-content: space-between; margin-bottom: 14px;
}
.wt-title {
  display: flex; align-items: center; gap: 8px;
  font-size: 15px; font-weight: 900;
}
.wt-goal-edit {
  font-size: 11px; color: var(--muted); cursor: pointer;
  background: none; border: none; font-family: inherit;
  padding: 4px 8px; border-radius: 99px;
  border: 1px solid var(--border);
}
.wt-goal-edit:hover { border-color: var(--accent); color: var(--accent); }

/* Progress */
.wt-progress-row {
  display: flex; align-items: center; gap: 12px; margin-bottom: 14px;
}
.wt-count {
  font-size: 26px; font-weight: 900; line-height: 1; flex-shrink: 0;
}
.wt-count span { font-size: 12px; color: var(--muted); font-weight: 600; }
.wt-bar-wrap { flex: 1; }
.wt-bar {
  height: 8px; background: var(--border); border-radius: 4px; overflow: hidden;
}
.wt-bar-fill {
  height: 100%; border-radius: 4px;
  background: linear-gradient(90deg, #38BDF8, #06B6D4);
  transition: width 0.4s ease;
}
.wt-pct {
  font-size: 11px; color: var(--muted); margin-top: 4px;
  font-weight: 700;
}
.wt-goal-reached { color: var(--green); }

/* Glasses visual */
.wt-glasses {
  display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 14px;
}
.wt-glass {
  font-size: 20px; transition: filter 0.2s, transform 0.15s;
  cursor: default; line-height: 1;
}
.wt-glass.empty { filter: grayscale(1) opacity(0.3); }
.wt-glass.filled { filter: none; }
.wt-glass.partial { filter: saturate(0.5) opacity(0.7); }

/* Quick-add buttons */
.wt-quick-row {
  display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px;
}
.wt-quick-btn {
  flex: 1; min-width: 52px;
  padding: 9px 4px;
  border: 1.5px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--surface2);
  color: var(--text); font-weight: 800;
  font-size: 12px; cursor: pointer;
  font-family: inherit; text-align: center;
  transition: all 0.15s;
}
.wt-quick-btn:hover, .wt-quick-btn:active {
  border-color: #38BDF8; background: rgba(56,189,248,.12); color: #38BDF8;
}
.wt-quick-btn.custom-btn {
  background: var(--accent); border-color: var(--accent); color: #fff;
  font-size: 16px; padding: 8px;
}
.wt-quick-btn.custom-btn:hover { opacity: 0.85; }

/* Custom input row */
.wt-custom-row {
  display: none; gap: 8px; align-items: center; margin-top: 6px;
}
.wt-custom-row.open { display: flex; }
.wt-custom-inp {
  flex: 1; padding: 9px 12px; border-radius: var(--r-sm);
  border: 1.5px solid var(--border);
  background: var(--surface2); color: var(--text);
  font-size: 14px; font-family: inherit; font-weight: 700;
  outline: none;
}
.wt-custom-inp:focus { border-color: #38BDF8; }
.wt-add-btn {
  padding: 9px 18px; border-radius: var(--r-sm);
  background: #38BDF8; border: none; color: #fff;
  font-weight: 800; font-size: 13px;
  cursor: pointer; font-family: inherit; white-space: nowrap;
}
.wt-add-btn:hover { opacity: 0.85; }

/* History row */
.wt-history-row {
  display: flex; gap: 6px; align-items: center;
  border-top: 1px solid var(--border); margin-top: 12px; padding-top: 10px;
  flex-wrap: wrap;
}
.wt-history-entry {
  font-size: 11px; color: var(--muted);
  background: var(--surface2); border-radius: 99px;
  padding: 3px 10px; display: flex; align-items: center; gap: 5px;
}
.wt-history-del {
  cursor: pointer; color: var(--muted); font-size: 10px;
  background: none; border: none; padding: 0; font-family: inherit;
  line-height: 1;
}
.wt-history-del:hover { color: var(--red); }

/* Goal edit modal */
.wt-goal-modal {
  display: none; position: fixed; inset: 0; z-index: 9000;
  background: rgba(0,0,0,.55); align-items: center; justify-content: center;
}
.wt-goal-modal.open { display: flex; }
.wt-goal-box {
  background: var(--surface); border-radius: var(--r);
  padding: 24px; width: min(320px, 92vw);
  box-shadow: var(--shadow-lg);
}
.wt-goal-box h3 { font-size: 16px; font-weight: 900; margin-bottom: 14px; }
`;

  // ─── Data helpers ──────────────────────────────────────
  function _today() {
    return new Date().toISOString().split('T')[0];
  }

  function _getWaterData() {
    if (!window.myData) return null;
    if (!window.myData.nutrition) window.myData.nutrition = { goal: 2000, log: {} };
    if (!window.myData.nutrition.water) window.myData.nutrition.water = {};
    return window.myData.nutrition;
  }

  function _getTodayMl() {
    var n = _getWaterData();
    return n ? (n.water[_today()] || 0) : 0;
  }

  function _getGoal() {
    var n = _getWaterData();
    return n ? (n.waterGoal || DEFAULT_GOAL_ML) : DEFAULT_GOAL_ML;
  }

  function _getLog() {
    var n = _getWaterData();
    return n ? (n.waterLog || []) : [];  // [{ time, ml }] today's entries
  }

  function _save() {
    if (typeof window.saveMyData === 'function') {
      window.saveMyData();
    }
    render();
  }

  // ─── Add / remove water ────────────────────────────────
  function addWater(ml) {
    ml = parseInt(ml, 10);
    if (!ml || ml <= 0 || ml > 5000) return;

    var n   = _getWaterData();
    var day = _today();
    n.water[day]    = (n.water[day] || 0) + ml;
    if (!n.waterLog) n.waterLog = {};
    if (!n.waterLog[day]) n.waterLog[day] = [];
    n.waterLog[day].push({ time: new Date().toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' }), ml: ml });

    _save();

    // Sync to health platform if available
    if (window.HealthSync && window.HealthSync.isAvailable()) {
      setTimeout(function () { window.HealthSync.sync('water_add'); }, 1000);
    }
  }

  function removeEntry(day, idx) {
    var n = _getWaterData();
    if (!n || !n.waterLog || !n.waterLog[day]) return;
    var entry = n.waterLog[day][idx];
    if (!entry) return;
    n.waterLog[day].splice(idx, 1);
    n.water[day] = Math.max(0, (n.water[day] || 0) - entry.ml);
    _save();
  }

  function setGoal(ml) {
    ml = parseInt(ml, 10);
    if (!ml || ml < 100 || ml > 10000) return;
    var n = _getWaterData();
    n.waterGoal = ml;
    _save();
    document.getElementById('wt-goal-modal').classList.remove('open');
  }

  // ─── Render ────────────────────────────────────────────
  function render() {
    var widget = document.getElementById(WIDGET_ID);
    if (!widget) return;

    var n        = _getWaterData();
    if (!n) { widget.innerHTML = ''; return; }

    var day      = _today();
    var totalMl  = n.water[day]    || 0;
    var goal     = n.waterGoal     || DEFAULT_GOAL_ML;
    var log      = (n.waterLog && n.waterLog[day]) || [];
    var pct      = Math.min(100, Math.round((totalMl / goal) * 100));
    var glasses  = Math.ceil(goal / 250);   // number of glass icons = goal / 250ml
    var filled   = Math.floor(totalMl / 250);
    var partial  = (totalMl % 250) > 0 && filled < glasses;

    // Glass icons
    var glassHTML = '';
    for (var i = 0; i < glasses; i++) {
      var cls = i < filled ? 'filled' : (i === filled && partial ? 'partial' : 'empty');
      glassHTML += '<span class="wt-glass ' + cls + '" title="' + ((i + 1) * 250) + 'ml">🥤</span>';
    }

    // History entries (last 8)
    var histHTML = log.slice(-8).map(function (e, i) {
      var realIdx = log.length > 8 ? (log.length - 8 + i) : i;
      return '<span class="wt-history-entry">' +
        e.ml + 'ml ' + e.time +
        '<button class="wt-history-del" onclick="WaterTracker.removeEntry(\'' + day + '\',' + realIdx + ')" title="حذف">✕</button>' +
        '</span>';
    }).join('');

    var reachedClass = totalMl >= goal ? 'wt-goal-reached' : '';

    widget.innerHTML =
      '<div class="wt-card">' +
        '<div class="wt-header">' +
          '<div class="wt-title">💧 شرب الماء</div>' +
          '<button class="wt-goal-edit" onclick="WaterTracker.openGoal()">🎯 الهدف ' + goal + 'ml</button>' +
        '</div>' +

        '<div class="wt-progress-row">' +
          '<div class="wt-count">' + totalMl + '<span>ml</span></div>' +
          '<div class="wt-bar-wrap">' +
            '<div class="wt-bar"><div class="wt-bar-fill" style="width:' + pct + '%"></div></div>' +
            '<div class="wt-pct ' + reachedClass + '">' +
              (totalMl >= goal ? '✅ أكملت هدفك!' : (pct + '% · متبقي ' + (goal - totalMl) + 'ml')) +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="wt-glasses">' + glassHTML + '</div>' +

        '<div class="wt-quick-row">' +
          QUICK_AMOUNTS.map(function (ml) {
            return '<button class="wt-quick-btn" onclick="WaterTracker.add(' + ml + ')">+' + ml + '</button>';
          }).join('') +
          '<button class="wt-quick-btn custom-btn" onclick="WaterTracker.toggleCustom()">＋</button>' +
        '</div>' +

        '<div class="wt-custom-row" id="wt-custom-row">' +
          '<input class="wt-custom-inp" id="wt-custom-inp" type="number" placeholder="كمية (ml)" min="1" max="5000"' +
          ' onkeydown="if(event.key===\'Enter\')WaterTracker.addCustom()">' +
          '<button class="wt-add-btn" onclick="WaterTracker.addCustom()">إضافة</button>' +
        '</div>' +

        (histHTML ? '<div class="wt-history-row">' + histHTML + '</div>' : '') +

      '</div>' +

      // Goal edit modal
      '<div class="wt-goal-modal" id="wt-goal-modal" onclick="if(event.target===this)this.classList.remove(\'open\')">' +
        '<div class="wt-goal-box">' +
          '<h3>🎯 هدف الماء اليومي</h3>' +
          '<div style="display:flex;gap:8px;margin-bottom:14px">' +
            '[500,1000,1500,2000,2500,3000].map not in template — rendered below' +
          '</div>' +
          '<div style="display:flex;gap:8px">' +
            '<input class="wt-custom-inp" id="wt-goal-inp" type="number" placeholder="مثال: 2500" value="' + goal + '"' +
            ' onkeydown="if(event.key===\'Enter\')WaterTracker.saveGoal()">' +
            '<button class="wt-add-btn" onclick="WaterTracker.saveGoal()">حفظ</button>' +
          '</div>' +
          '<button onclick="document.getElementById(\'wt-goal-modal\').classList.remove(\'open\')" ' +
            'style="width:100%;margin-top:10px;padding:9px;border:1px solid var(--border);border-radius:var(--r-sm);background:none;color:var(--muted);font-family:inherit;cursor:pointer">إلغاء</button>' +
        '</div>' +
      '</div>';

    // Render goal preset buttons separately (avoids template nesting issues)
    var presetRow = widget.querySelector('.wt-goal-box div');
    if (presetRow) {
      presetRow.innerHTML = [500, 1000, 1500, 2000, 2500, 3000].map(function (v) {
        var active = v === goal ? 'border-color:var(--accent);color:var(--accent)' : '';
        return '<button class="wt-quick-btn" style="' + active + '" onclick="WaterTracker.quickGoal(' + v + ')">' + v + '</button>';
      }).join('');
    }
  }

  // ─── Injection ─────────────────────────────────────────
  function _inject() {
    if (document.getElementById(WIDGET_ID)) return;

    // Insert after #nutri-macros
    var anchor = document.getElementById('nutri-macros');
    if (!anchor) return;

    var div  = document.createElement('div');
    div.id   = WIDGET_ID;
    anchor.parentNode.insertBefore(div, anchor.nextSibling);
    render();
  }

  // ─── CSS injection ─────────────────────────────────────
  function _injectCSS() {
    if (document.getElementById('water-tracker-css')) return;
    var style = document.createElement('style');
    style.id  = 'water-tracker-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  // ─── Public API ─────────────────────────────────────────
  var WaterTracker = {
    add: addWater,

    addCustom: function () {
      var inp = document.getElementById('wt-custom-inp');
      if (inp && inp.value) { addWater(inp.value); inp.value = ''; }
      var row = document.getElementById('wt-custom-row');
      if (row) row.classList.remove('open');
    },

    toggleCustom: function () {
      var row = document.getElementById('wt-custom-row');
      if (!row) return;
      row.classList.toggle('open');
      if (row.classList.contains('open')) {
        setTimeout(function () {
          var inp = document.getElementById('wt-custom-inp');
          if (inp) inp.focus();
        }, 50);
      }
    },

    removeEntry: removeEntry,
    render:      render,

    openGoal: function () {
      var m = document.getElementById('wt-goal-modal');
      if (m) m.classList.add('open');
    },

    quickGoal: function (ml) {
      var inp = document.getElementById('wt-goal-inp');
      if (inp) inp.value = ml;
    },

    saveGoal: function () {
      var inp = document.getElementById('wt-goal-inp');
      if (inp) setGoal(inp.value);
    },
  };

  window.WaterTracker = WaterTracker;

  // ─── Init ───────────────────────────────────────────────
  function _init() {
    _injectCSS();
    _inject();

    // Hook renderNutrition to keep water widget in sync
    var _orig = window.renderNutrition;
    if (typeof _orig === 'function') {
      window.renderNutrition = function () {
        var r = _orig.apply(this, arguments);
        // Re-inject if widget was wiped (nutrition re-renders its container)
        if (!document.getElementById(WIDGET_ID)) _inject(); else render();
        return r;
      };
    }

    // Hook showPage
    var _origShow = window.showPage;
    if (typeof _origShow === 'function') {
      window.showPage = function (name) {
        var r = _origShow.apply(this, arguments);
        if (name === 'nutrition') setTimeout(function () {
          if (!document.getElementById(WIDGET_ID)) _inject(); else render();
        }, 60);
        return r;
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

})(window);
