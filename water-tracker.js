/**
 * water-tracker.js — تتبع شرب الماء
 * ميزة مستقلة لا تحتاج Health Sync.
 * تُحقن في صفحة السعرات (#page-nutrition) بعد nutri-macros.
 *
 * Data model:
 *   myData.nutrition.water    = { 'YYYY-MM-DD': totalMl }
 *   myData.nutrition.waterLog = { 'YYYY-MM-DD': [{time, ml}] }
 *   myData.nutrition.waterGoal = number (ml)
 */
(function (window) {
  'use strict';

  var DEFAULT_GOAL_ML = 2000;
  var QUICK_AMOUNTS   = [150, 200, 250, 330, 500];
  var WIDGET_ID       = 'water-tracker-widget';
  var GOAL_PRESETS    = [500, 1000, 1500, 2000, 2500, 3000];

  // ─── CSS ───────────────────────────────────────────────
  var CSS = `
#water-tracker-widget { margin-bottom: 18px; }

.wt-card {
  background: var(--surface); border-radius: var(--r);
  border: 1px solid var(--border); padding: 16px 18px;
  box-shadow: var(--shadow);
}
.wt-header {
  display: flex; align-items: center;
  justify-content: space-between; margin-bottom: 14px;
}
.wt-title { font-size: 15px; font-weight: 900; display: flex; align-items: center; gap: 8px; }
.wt-goal-edit {
  font-size: 11px; color: var(--muted); cursor: pointer;
  background: none; border: 1px solid var(--border);
  font-family: inherit; padding: 4px 10px; border-radius: 99px;
}
.wt-goal-edit:hover { border-color: var(--accent); color: var(--accent); }

/* Progress */
.wt-progress-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.wt-count { font-size: 26px; font-weight: 900; line-height: 1; flex-shrink: 0; }
.wt-count span { font-size: 12px; color: var(--muted); font-weight: 600; }
.wt-bar-wrap { flex: 1; }
.wt-bar { height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
.wt-bar-fill {
  height: 100%; border-radius: 4px;
  background: linear-gradient(90deg, #38BDF8, #06B6D4);
  transition: width 0.4s ease;
}
.wt-pct { font-size: 11px; color: var(--muted); margin-top: 4px; font-weight: 700; }
.wt-goal-reached { color: var(--green); }

/* Glasses */
.wt-glasses { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 14px; }
.wt-glass { font-size: 20px; transition: filter 0.2s; cursor: default; line-height: 1; }
.wt-glass.empty   { filter: grayscale(1) opacity(0.3); }
.wt-glass.filled  { filter: none; }
.wt-glass.partial { filter: saturate(0.5) opacity(0.65); }

/* Quick-add */
.wt-quick-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
.wt-quick-btn {
  flex: 1; min-width: 52px; padding: 9px 4px;
  border: 1.5px solid var(--border); border-radius: var(--r-sm);
  background: var(--surface2); color: var(--text);
  font-weight: 800; font-size: 12px; cursor: pointer;
  font-family: inherit; text-align: center; transition: all 0.15s;
}
.wt-quick-btn:hover { border-color: #38BDF8; background: rgba(56,189,248,.12); color: #38BDF8; }
.wt-custom-btn {
  background: var(--accent); border-color: var(--accent); color: #fff; font-size: 16px; padding: 8px;
}
.wt-custom-btn:hover { opacity: 0.85; color: #fff; }

/* Custom input */
.wt-custom-row { display: none; gap: 8px; align-items: center; margin-top: 6px; }
.wt-custom-row.open { display: flex; }
.wt-inp {
  flex: 1; padding: 9px 12px; border-radius: var(--r-sm);
  border: 1.5px solid var(--border); background: var(--surface2); color: var(--text);
  font-size: 14px; font-family: inherit; font-weight: 700; outline: none;
}
.wt-inp:focus { border-color: #38BDF8; }
.wt-add-btn {
  padding: 9px 18px; border-radius: var(--r-sm);
  background: #38BDF8; border: none; color: #fff;
  font-weight: 800; font-size: 13px; cursor: pointer;
  font-family: inherit; white-space: nowrap;
}
.wt-add-btn:hover { opacity: 0.85; }

/* 7-Day History */
.wt-week {
  border-top: 1px solid var(--border); margin-top: 14px; padding-top: 12px;
}
.wt-week-title { font-size: 11px; font-weight: 800; color: var(--muted); margin-bottom: 8px; }
.wt-week-bars  {
  display: flex; align-items: flex-end; gap: 4px;
  height: 48px; margin-bottom: 4px;
}
.wt-week-col   { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; }
.wt-week-bar   {
  width: 100%; border-radius: 3px 3px 0 0; min-height: 3px;
  background: rgba(56,189,248,.3); transition: height 0.3s;
  cursor: default;
}
.wt-week-bar.today { background: #38BDF8; }
.wt-week-bar.goal  { background: var(--green); }
.wt-week-label { font-size: 9px; color: var(--muted); font-weight: 700; }
.wt-week-val   { font-size: 9px; color: var(--muted); }

/* Today's entry log */
.wt-log {
  display: flex; gap: 5px; flex-wrap: wrap;
  border-top: 1px solid var(--border); margin-top: 12px; padding-top: 10px;
}
.wt-log-entry {
  font-size: 11px; color: var(--muted); background: var(--surface2);
  border-radius: 99px; padding: 3px 10px;
  display: flex; align-items: center; gap: 5px;
}
.wt-del {
  cursor: pointer; color: var(--muted); font-size: 10px;
  background: none; border: none; padding: 0; font-family: inherit; line-height: 1;
}
.wt-del:hover { color: var(--red); }

/* Goal Modal */
.wt-goal-modal {
  display: none; position: fixed; inset: 0; z-index: 9000;
  background: rgba(0,0,0,.55); align-items: center; justify-content: center;
}
.wt-goal-modal.open { display: flex; }
.wt-goal-box {
  background: var(--surface); border-radius: var(--r);
  padding: 24px; width: min(320px, 92vw); box-shadow: var(--shadow-lg);
}
.wt-goal-box h3 { font-size: 16px; font-weight: 900; margin-bottom: 14px; }
.wt-goal-presets { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
.wt-preset-btn {
  flex: 1; min-width: 44px; padding: 8px 4px;
  border: 1.5px solid var(--border); border-radius: var(--r-sm);
  background: var(--surface2); color: var(--muted);
  font-weight: 800; font-size: 12px; cursor: pointer;
  font-family: inherit; text-align: center; transition: all 0.15s;
}
.wt-preset-btn.active { border-color: #38BDF8; color: #38BDF8; background: rgba(56,189,248,.1); }
.wt-preset-btn:hover  { border-color: #38BDF8; color: #38BDF8; }
.wt-cancel-btn {
  width: 100%; margin-top: 10px; padding: 9px;
  border: 1px solid var(--border); border-radius: var(--r-sm);
  background: none; color: var(--muted); font-family: inherit; cursor: pointer;
}
`;

  // ─── Helpers ──────────────────────────────────────────
  function _today() { return new Date().toISOString().split('T')[0]; }

  function _dayKey(offsetDays) {
    return new Date(Date.now() - offsetDays * 86400000).toISOString().split('T')[0];
  }

  function _shortDayAr(isoDate) {
    var days = ['أح', 'إث', 'ثل', 'أر', 'خم', 'جم', 'سب'];
    return days[new Date(isoDate + 'T12:00:00').getDay()];
  }

  function _getData() {
    // myData is declared as `let` in index.html — not on window.
    // getNutri() IS a function declaration → available as window.getNutri.
    if (typeof window.getNutri !== 'function') return null;
    var n = window.getNutri();
    if (!n.water)    n.water    = {};
    if (!n.waterLog) n.waterLog = {};
    return n;
  }

  function _goal() {
    var n = _getData();
    return n ? (n.waterGoal || DEFAULT_GOAL_ML) : DEFAULT_GOAL_ML;
  }

  function _save() {
    if (typeof window.saveMyData === 'function') window.saveMyData();
    render();
  }

  // ─── Core logic ────────────────────────────────────────
  function addWater(ml) {
    ml = parseInt(ml, 10);
    if (!ml || ml <= 0 || ml > 5000) return;
    var n   = _getData(); if (!n) return;
    var day = _today();
    n.water[day] = (n.water[day] || 0) + ml;
    if (!n.waterLog[day]) n.waterLog[day] = [];
    n.waterLog[day].push({
      time: new Date().toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' }),
      ml:   ml
    });
    _save();
    if (window.HealthSync && window.HealthSync.isAvailable()) {
      setTimeout(function () { window.HealthSync.sync('water_add'); }, 1500);
    }
  }

  function removeEntry(day, idx) {
    var n = _getData(); if (!n) return;
    var entries = n.waterLog && n.waterLog[day];
    if (!entries || !entries[idx]) return;
    var ml = entries[idx].ml;
    entries.splice(idx, 1);
    n.water[day] = Math.max(0, (n.water[day] || 0) - ml);
    _save();
  }

  function setGoal(ml) {
    ml = parseInt(ml, 10);
    if (!ml || ml < 100 || ml > 10000) return;
    var n = _getData(); if (!n) return;
    n.waterGoal = ml;
    _save();
    var modal = document.getElementById('wt-goal-modal');
    if (modal) modal.classList.remove('open');
  }

  // ─── Build HTML helpers ────────────────────────────────
  function _buildPresetBtns(goal) {
    return GOAL_PRESETS.map(function (v) {
      var cls = v === goal ? ' active' : '';
      return '<button class="wt-preset-btn' + cls + '" onclick="WaterTracker.quickGoal(' + v + ')">' + v + '</button>';
    }).join('');
  }

  function _buildWeekChart(n, goal) {
    var days    = [6, 5, 4, 3, 2, 1, 0].map(_dayKey);  // oldest → today
    var vals    = days.map(function (d) { return n.water[d] || 0; });
    var maxVal  = Math.max.apply(null, vals.concat([goal]));
    var today   = _today();

    var bars = days.map(function (d, i) {
      var v      = vals[i];
      var height = maxVal > 0 ? Math.max(3, Math.round((v / maxVal) * 42)) : 3;
      var cls    = d === today ? 'today' : (v >= goal ? 'goal' : '');
      var title  = v + 'ml';
      return '<div class="wt-week-col">' +
        '<div class="wt-week-bar ' + cls + '" style="height:' + height + 'px" title="' + title + '"></div>' +
        '<div class="wt-week-label">' + _shortDayAr(d) + '</div>' +
      '</div>';
    }).join('');

    return '<div class="wt-week">' +
      '<div class="wt-week-title">📅 آخر 7 أيام</div>' +
      '<div class="wt-week-bars">' + bars + '</div>' +
    '</div>';
  }

  // ─── Main render ───────────────────────────────────────
  function render() {
    var widget = document.getElementById(WIDGET_ID);
    if (!widget) return;

    var n = _getData();
    if (!n) { widget.innerHTML = ''; return; }

    var day     = _today();
    var total   = n.water[day]    || 0;
    var goal    = n.waterGoal     || DEFAULT_GOAL_ML;
    var log     = n.waterLog[day] || [];
    var pct     = Math.min(100, Math.round((total / goal) * 100));

    // Glasses
    var glassCount = Math.min(Math.ceil(goal / 250), 12);
    var filled     = Math.floor(total / 250);
    var partial    = (total % 250) > 0 && filled < glassCount;
    var glasses    = '';
    for (var i = 0; i < glassCount; i++) {
      var cls = i < filled ? 'filled' : (i === filled && partial ? 'partial' : 'empty');
      glasses += '<span class="wt-glass ' + cls + '" title="' + ((i + 1) * 250) + 'ml">🥤</span>';
    }

    // Today's log entries (last 8, newest first for display)
    var logHTML = log.slice(-8).map(function (e, i) {
      var realIdx = log.length > 8 ? (log.length - 8 + i) : i;
      return '<span class="wt-log-entry">' +
        e.ml + 'ml <span style="opacity:.6">' + e.time + '</span>' +
        '<button class="wt-del" onclick="WaterTracker.removeEntry(\'' + day + '\',' + realIdx + ')" title="حذف">✕</button>' +
      '</span>';
    }).join('');

    var reachedCls = total >= goal ? 'wt-goal-reached' : '';
    var statusTxt  = total >= goal
      ? '✅ أكملت هدفك اليومي!'
      : pct + '% · متبقي ' + (goal - total) + 'ml';

    widget.innerHTML =
      '<div class="wt-card">' +
        // Header
        '<div class="wt-header">' +
          '<div class="wt-title">💧 شرب الماء</div>' +
          '<button class="wt-goal-edit" onclick="WaterTracker.openGoal()">🎯 الهدف ' + goal + 'ml</button>' +
        '</div>' +

        // Progress
        '<div class="wt-progress-row">' +
          '<div class="wt-count">' + total + '<span>ml</span></div>' +
          '<div class="wt-bar-wrap">' +
            '<div class="wt-bar"><div class="wt-bar-fill" style="width:' + pct + '%"></div></div>' +
            '<div class="wt-pct ' + reachedCls + '">' + statusTxt + '</div>' +
          '</div>' +
        '</div>' +

        // Glasses
        '<div class="wt-glasses">' + glasses + '</div>' +

        // Quick-add buttons
        '<div class="wt-quick-row">' +
          QUICK_AMOUNTS.map(function (ml) {
            return '<button class="wt-quick-btn" onclick="WaterTracker.add(' + ml + ')">+' + ml + '</button>';
          }).join('') +
          '<button class="wt-quick-btn wt-custom-btn" onclick="WaterTracker.toggleCustom()">＋</button>' +
        '</div>' +

        // Custom input (hidden by default)
        '<div class="wt-custom-row" id="wt-custom-row">' +
          '<input class="wt-inp" id="wt-custom-inp" type="number" placeholder="كمية (ml)" min="1" max="5000"' +
          ' onkeydown="if(event.key===\'Enter\')WaterTracker.addCustom()">' +
          '<button class="wt-add-btn" onclick="WaterTracker.addCustom()">إضافة</button>' +
        '</div>' +

        // Today's entry log
        (logHTML ? '<div class="wt-log">' + logHTML + '</div>' : '') +

        // 7-day history sparkline
        _buildWeekChart(n, goal) +

      '</div>' +

      // Goal Modal (outside the card, inside the widget)
      '<div class="wt-goal-modal" id="wt-goal-modal" onclick="if(event.target===this)this.classList.remove(\'open\')">' +
        '<div class="wt-goal-box">' +
          '<h3>🎯 هدف الماء اليومي</h3>' +
          '<div class="wt-goal-presets">' + _buildPresetBtns(goal) + '</div>' +
          '<div style="display:flex;gap:8px">' +
            '<input class="wt-inp" id="wt-goal-inp" type="number" placeholder="مثال: 2500" value="' + goal + '"' +
            ' onkeydown="if(event.key===\'Enter\')WaterTracker.saveGoal()">' +
            '<button class="wt-add-btn" onclick="WaterTracker.saveGoal()">حفظ</button>' +
          '</div>' +
          '<button class="wt-cancel-btn" onclick="document.getElementById(\'wt-goal-modal\').classList.remove(\'open\')">إلغاء</button>' +
        '</div>' +
      '</div>';
  }

  // ─── Injection ────────────────────────────────────────
  function _inject() {
    if (document.getElementById(WIDGET_ID)) return;
    var anchor = document.getElementById('nutri-macros');
    if (!anchor) return;
    var div = document.createElement('div');
    div.id  = WIDGET_ID;
    anchor.parentNode.insertBefore(div, anchor.nextSibling);
    render();
  }

  function _injectCSS() {
    if (document.getElementById('water-tracker-css')) return;
    var style = document.createElement('style');
    style.id  = 'water-tracker-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  // ─── Public API ──────────────────────────────────────
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
      // Highlight selected preset
      document.querySelectorAll('.wt-preset-btn').forEach(function (b) {
        b.classList.toggle('active', parseInt(b.textContent, 10) === ml);
      });
      var inp = document.getElementById('wt-goal-inp');
      if (inp) inp.value = ml;
    },

    saveGoal: function () {
      var inp = document.getElementById('wt-goal-inp');
      if (inp) setGoal(inp.value);
    },

    // Expose for tests
    _getData:    _getData,
    _goal:       _goal,
    _dayKey:     _dayKey,
  };

  window.WaterTracker = WaterTracker;

  // ─── Init ────────────────────────────────────────────
  function _init() {
    _injectCSS();
    _inject();

    // Keep widget alive after renderNutrition re-renders nutri-macros container
    var _origNutri = window.renderNutrition;
    if (typeof _origNutri === 'function') {
      window.renderNutrition = function () {
        var r = _origNutri.apply(this, arguments);
        if (!document.getElementById(WIDGET_ID)) _inject(); else render();
        return r;
      };
    }

    // Re-render when nutrition page becomes active
    var _origShow = window.showPage;
    if (typeof _origShow === 'function') {
      window.showPage = function (name) {
        var r = _origShow.apply(this, arguments);
        if (name === 'nutrition') {
          setTimeout(function () {
            if (!document.getElementById(WIDGET_ID)) _inject(); else render();
          }, 60);
        }
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
