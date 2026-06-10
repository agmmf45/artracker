// ═══════════════════════════════════════════════════════════════
//  دقيق — Premium Theme System v1.0
//  13 ثيم فاخر: خلفيات متدرجة، جزيئات متحركة، زجاجية، توهّج
//  • يحقن CSS كامل لكل ثيم (يغطي البطاقات/الأزرار/التنقل/المودالات)
//  • معاينة حية mini-mockup لكل ثيم قبل الاختيار
//  • انتقال سلس + حفظ تلقائي (عبر applyTheme الأصلية) + meta theme-color
//  • طبقة #theme-fx ثابتة (z:-1) للخلفية والجزيئات — سلسة على الجوال
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // ── تعريفات الثيمات (الألوان هنا للمعاينة فقط — التطبيق عبر CSS أدناه) ──
  const THEMES = [
    { id:'default',  name:'دقيق',          emoji:'🌃', metaBg:'#0C1322',
      c:{ grad:'linear-gradient(160deg,#0C1322 0%,#10203A 100%)', s:'#151E30', tx:'#F1F5F9', ac:'#38BDF8' } },
    { id:'classic',  name:'كلاسيك فاخر',   emoji:'🤎', metaBg:'#F7F2E9',
      c:{ grad:'linear-gradient(160deg,#FBF7EE 0%,#F1E6D0 100%)', s:'#FFFDF8', tx:'#2B2317', ac:'#B08A3E' } },
    { id:'rose',     name:'وردي',          emoji:'🌸', metaBg:'#FFF5F7',
      c:{ grad:'linear-gradient(160deg,#FFF7F9 0%,#FFE3EC 100%)', s:'#FFFFFF', tx:'#33121E', ac:'#EC4D77' } },
    { id:'ocean',    name:'المحيط',        emoji:'🌊', metaBg:'#04101E',
      c:{ grad:'linear-gradient(180deg,#04101E 0%,#0A2542 100%)', s:'#10304F', tx:'#EAF4FF', ac:'#3CC8FF' } },
    { id:'lavender', name:'سايبر',         emoji:'💜', metaBg:'#0B0618',
      c:{ grad:'linear-gradient(160deg,#0B0618 0%,#1D0F3C 100%)', s:'#161028', tx:'#F2EDFF', ac:'#A855F7' } },
    { id:'mint',     name:'نعناعي',        emoji:'💚', metaBg:'#F0FDF6',
      c:{ grad:'linear-gradient(160deg,#F2FDF7 0%,#DCF6E9 100%)', s:'#FFFFFF', tx:'#06281A', ac:'#10B981' } },
    { id:'dark',     name:'ليلة ذهبية',    emoji:'🖤', metaBg:'#0A0A0C',
      c:{ grad:'linear-gradient(160deg,#0A0A0C 0%,#171307 100%)', s:'#17150F', tx:'#F5EFE0', ac:'#D4AF37' } },
    { id:'inferno',  name:'جحيم',          emoji:'🔥', metaBg:'#0C0506',
      c:{ grad:'linear-gradient(160deg,#0C0506 0%,#2A0A0C 100%)', s:'#1A0E10', tx:'#FFEDEA', ac:'#F43F3F' } },
    { id:'electric', name:'كهربائي',       emoji:'⚡', metaBg:'#04070E',
      c:{ grad:'linear-gradient(160deg,#04070E 0%,#0A1426 100%)', s:'#0B1220', tx:'#E6FAFF', ac:'#22D3EE' } },
    { id:'galaxy',   name:'مجرة',          emoji:'🌌', metaBg:'#050314',
      c:{ grad:'linear-gradient(160deg,#050314 0%,#1A0F3A 60%,#2A0F33 100%)', s:'#171230', tx:'#EFEAFF', ac:'#818CF8' } },
    { id:'nature',   name:'طبيعة',         emoji:'🌿', metaBg:'#F4F9EE',
      c:{ grad:'linear-gradient(160deg,#F6FAF0 0%,#E2F0D4 100%)', s:'#FEFFFB', tx:'#1F2E18', ac:'#5B8C2A' } },
    { id:'ice',      name:'جليد',          emoji:'❄️', metaBg:'#F3FAFF',
      c:{ grad:'linear-gradient(160deg,#F5FBFF 0%,#DEF0FC 100%)', s:'#FFFFFF', tx:'#0E2A40', ac:'#0EA5E9' } },
    { id:'sunset',   name:'غروب',          emoji:'🌇', metaBg:'#2B1055',
      c:{ grad:'linear-gradient(165deg,#2B1055 0%,#7B2A56 55%,#C2491D 100%)', s:'#41204B', tx:'#FFF3E8', ac:'#FB923C' } },
  ];
  window.THEME_DEFS = THEMES;

  // ─────────────────────────────────────────────
  //  CSS — أساس مشترك + 13 ثيم
  // ─────────────────────────────────────────────
  const CSS = `
/* ══ THEME ENGINE BASE ══ */
#theme-fx{position:fixed;inset:0;z-index:-1;pointer-events:none;background:var(--fxbg,none);overflow:hidden;}
html.theme-anim body, html.theme-anim body *{transition:background-color .45s ease,color .45s ease,border-color .45s ease,box-shadow .45s ease,background .45s ease !important;}
.btn-p{color:var(--on-accent,#06202E);}
.bar-fill{box-shadow:0 0 10px color-mix(in srgb,var(--green) 45%,transparent);}
.c-bar{box-shadow:0 0 8px color-mix(in srgb,var(--accent) 35%,transparent);}

/* ══ THEME PICKER (live preview cards) ══ */
.theme-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(138px,1fr));gap:12px;}
.thx{position:relative;border:2px solid var(--border);border-radius:16px;overflow:hidden;cursor:pointer;background:var(--surface);transition:transform .2s cubic-bezier(.34,1.56,.64,1),border-color .2s,box-shadow .2s;}
.thx:hover{transform:translateY(-3px);border-color:var(--accent);box-shadow:0 8px 24px color-mix(in srgb,var(--accent) 25%,transparent);}
.thx.on{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 30%,transparent),0 8px 28px color-mix(in srgb,var(--accent) 30%,transparent);animation:thx-pop .4s cubic-bezier(.34,1.56,.64,1);}
@keyframes thx-pop{0%{transform:scale(.94)}60%{transform:scale(1.03)}100%{transform:scale(1)}}
.thx-prev{height:96px;padding:8px 9px;display:flex;flex-direction:column;gap:5px;}
.thx-top{height:9px;border-radius:5px;display:flex;align-items:center;padding:0 4px;}
.thx-top i{width:14px;height:4px;border-radius:3px;display:block;}
.thx-card{flex:1;border-radius:8px;padding:5px 7px;display:flex;flex-direction:column;gap:4px;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.15);}
.thx-card b{display:block;height:4px;border-radius:3px;opacity:.35;width:80%;}
.thx-card b+b{width:55%;}
.thx-prog{height:5px;border-radius:99px;background:rgba(128,128,128,.22);overflow:hidden;margin-top:1px;}
.thx-prog i{display:block;height:100%;width:62%;border-radius:99px;}
.thx-row{display:flex;gap:5px;align-items:flex-end;height:18px;}
.thx-chart{flex:1;display:flex;gap:3px;align-items:flex-end;height:100%;}
.thx-chart i{flex:1;border-radius:2px 2px 0 0;opacity:.85;}
.thx-btn{width:34px;height:14px;border-radius:7px;box-shadow:0 2px 8px rgba(0,0,0,.25);}
.thx-name{padding:8px 10px 9px;font-size:12px;font-weight:800;text-align:center;color:var(--text);background:var(--surface);}
.thx-check{position:absolute;top:7px;left:7px;width:20px;height:20px;border-radius:50%;display:none;align-items:center;justify-content:center;font-size:11px;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.35);}
.thx.on .thx-check{display:flex;animation:thx-pop .35s ease;}

/* ══ FX PARTICLES ══ */
.fx-bub{position:absolute;bottom:-30px;border-radius:50%;background:radial-gradient(circle at 32% 30%,rgba(160,220,255,.5),rgba(80,170,255,.12) 70%);animation:fx-rise linear infinite;}
@keyframes fx-rise{0%{transform:translateY(0) translateX(0);opacity:0}10%{opacity:.7}90%{opacity:.4}100%{transform:translateY(-110vh) translateX(24px);opacity:0}}
.fx-st{position:absolute;border-radius:50%;background:#fff;animation:fx-tw ease-in-out infinite alternate;}
@keyframes fx-tw{from{opacity:.15;transform:scale(.8)}to{opacity:.9;transform:scale(1.15)}}
.fx-emb{position:absolute;bottom:-16px;border-radius:50%;background:radial-gradient(circle,#FFB454,#F43F3F 65%,transparent);filter:blur(.4px);animation:fx-emb linear infinite;}
@keyframes fx-emb{0%{transform:translateY(0) translateX(0) scale(1);opacity:0}8%{opacity:.95}60%{opacity:.55}100%{transform:translateY(-105vh) translateX(-34px) scale(.45);opacity:0}}
.fx-snw{position:absolute;top:-14px;border-radius:50%;background:rgba(255,255,255,.92);box-shadow:0 0 6px rgba(180,225,255,.8);animation:fx-fall linear infinite;}
@keyframes fx-fall{0%{transform:translateY(0) translateX(0)}100%{transform:translateY(108vh) translateX(36px)}}
.fx-orb{position:absolute;border-radius:50%;filter:blur(46px);opacity:.5;animation:fx-orb ease-in-out infinite alternate;}
@keyframes fx-orb{from{transform:translate(0,0) scale(1)}to{transform:translate(36px,-44px) scale(1.12)}}
.fx-scan{position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(34,211,238,.5),transparent);animation:fx-scan 7s linear infinite;}
@keyframes fx-scan{0%{top:-2%}100%{top:102%}}
@media(prefers-reduced-motion:reduce){#theme-fx *{animation:none !important;}}

/* ════════════════ 1 · دقيق (الافتراضي) ════════════════ */
body{--fxbg:radial-gradient(1000px 540px at 85% -12%,rgba(56,189,248,.10),transparent 60%),radial-gradient(800px 500px at 0% 112%,rgba(59,130,246,.07),transparent 55%);}

/* ════════════════ 2 · كلاسيك فاخر — بيج وذهب ════════════════ */
body.theme-classic{
  --bg:#F7F2E9;--surface:#FFFDF8;--surface2:#F2EADA;--border:#E4D7BE;
  --text:#2B2317;--muted:#8A7A5E;--accent:#B08A3E;--accent-rgb:176,138,62;--accent-light:#F3E7CF;
  --green:#3E7C4F;--green-light:#E4F2E7;--blue:#3E5C9C;--blue-light:#E6ECF8;
  --red:#B4533C;--red-light:#F9E5DF;--orange:#C07A28;--orange-light:#F8EBD8;
  --shadow:0 3px 14px rgba(140,110,55,.10),0 1px 3px rgba(140,110,55,.06);
  --shadow-lg:0 16px 44px rgba(140,110,55,.18);
  --nav-bg:rgba(252,248,240,.88);--topbar-bg:rgba(250,245,235,.86);--on-accent:#FFF;
  --fxbg:radial-gradient(900px 500px at 88% -10%,rgba(200,160,80,.14),transparent 60%),radial-gradient(760px 480px at 4% 110%,rgba(176,138,62,.10),transparent 55%),linear-gradient(170deg,#FBF7EE 0%,#F3EADA 100%);
}
body.theme-classic .card,body.theme-classic .stat-card,body.theme-classic .nutri-mealcard,body.theme-classic .modal-box,body.theme-classic .awx{border:1px solid #E9DCC2;box-shadow:0 6px 22px rgba(150,118,60,.10);}
body.theme-classic .btn-p{background:linear-gradient(135deg,#C9A04E,#A87E2F);box-shadow:0 4px 18px rgba(176,138,62,.35);}
body.theme-classic .sec-title{color:#8A6F3C;}

/* ════════════════ 3 · وردي — premium social ════════════════ */
body.theme-rose{
  --bg:#FFF5F7;--surface:#FFFFFF;--surface2:#FFEFF3;--border:#F9D2DD;
  --text:#33121E;--muted:#A66B7E;--accent:#EC4D77;--accent-rgb:236,77,119;--accent-light:#FDE5EC;
  --green:#15A06A;--green-light:#DEF7EC;--blue:#5B7CFA;--blue-light:#E8EDFF;
  --red:#E11D48;--red-light:#FDE2E7;--orange:#E8853C;--orange-light:#FCEEDF;
  --shadow:0 4px 16px rgba(236,77,119,.09),0 1px 3px rgba(236,77,119,.05);
  --shadow-lg:0 18px 48px rgba(236,77,119,.16);
  --nav-bg:rgba(255,250,251,.9);--topbar-bg:rgba(255,248,250,.88);--on-accent:#FFF;
  --fxbg:radial-gradient(880px 520px at 85% -10%,rgba(244,114,160,.16),transparent 60%),radial-gradient(720px 460px at 6% 112%,rgba(236,77,119,.10),transparent 55%),linear-gradient(170deg,#FFF8FA 0%,#FFE9F0 100%);
}
body.theme-rose .card,body.theme-rose .stat-card,body.theme-rose .nutri-mealcard,body.theme-rose .modal-box,body.theme-rose .awx{border:1px solid #FAD9E2;box-shadow:0 8px 26px rgba(236,77,119,.10);}
body.theme-rose .btn-p{background:linear-gradient(135deg,#F472A0,#E1336B);box-shadow:0 6px 20px rgba(236,77,119,.35);}

/* ════════════════ 4 · المحيط — زجاجي عميق ════════════════ */
body.theme-ocean{
  --bg:#04101E;--surface:#0E2B4A;--surface2:#143355;--border:#1E4470;
  --text:#EAF4FF;--muted:#9CC0E0;--accent:#3CC8FF;--accent-rgb:60,200,255;--accent-light:#0A3A57;
  --green:#34D399;--green-light:#0B3B2D;--blue:#60A5FA;--blue-light:#102A4D;
  --red:#FB7185;--red-light:#3A1528;--orange:#FBBF24;--orange-light:#3A2A10;
  --shadow:0 4px 18px rgba(1,10,22,.5);--shadow-lg:0 20px 52px rgba(1,10,22,.65);
  --nav-bg:rgba(4,16,30,.8);--topbar-bg:rgba(4,16,30,.76);--on-accent:#03212F;
  --fxbg:radial-gradient(900px 520px at 82% -12%,rgba(56,160,255,.20),transparent 60%),radial-gradient(760px 500px at 8% 112%,rgba(14,116,201,.24),transparent 60%),linear-gradient(180deg,#04101E 0%,#071D36 55%,#0A2542 100%);
}
body.theme-ocean .card,body.theme-ocean .stat-card,body.theme-ocean .nutri-mealcard,body.theme-ocean .modal-box,body.theme-ocean .awx{background:rgba(15,43,76,.55);border:1px solid rgba(110,190,255,.16);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);}
body.theme-ocean .top-tabs,body.theme-ocean .top-profile-bar,body.theme-ocean .subtabs{backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);}
body.theme-ocean .btn-p{background:linear-gradient(135deg,#0EA5E9,#3CC8FF);box-shadow:0 6px 26px rgba(56,189,248,.4);}

/* ════════════════ 5 · سايبر — نيون بنفسجي ════════════════ */
body.theme-lavender{
  --bg:#0B0618;--surface:#161028;--surface2:#1F1838;--border:#3A2A66;
  --text:#F2EDFF;--muted:#A793D6;--accent:#A855F7;--accent-rgb:168,85,247;--accent-light:#2A1745;
  --green:#34D399;--green-light:#0E3328;--blue:#22D3EE;--blue-light:#0C2E38;
  --red:#FB7185;--red-light:#3A1528;--orange:#FBBF24;--orange-light:#382A0E;
  --shadow:0 4px 20px rgba(5,2,16,.55);--shadow-lg:0 20px 56px rgba(5,2,16,.7);
  --nav-bg:rgba(11,6,24,.84);--topbar-bg:rgba(11,6,24,.8);--on-accent:#FFF;
  --fxbg:radial-gradient(860px 520px at 84% -12%,rgba(168,85,247,.22),transparent 62%),radial-gradient(700px 480px at 4% 112%,rgba(34,211,238,.10),transparent 55%),linear-gradient(165deg,#0B0618 0%,#170B30 60%,#1D0F3C 100%);
}
body.theme-lavender .card,body.theme-lavender .stat-card,body.theme-lavender .nutri-mealcard,body.theme-lavender .modal-box,body.theme-lavender .awx{border:1px solid rgba(168,85,247,.22);box-shadow:0 8px 28px rgba(5,2,16,.5),0 0 18px rgba(168,85,247,.06) inset;}
body.theme-lavender .btn-p{background:linear-gradient(135deg,#8B5CF6,#D946EF);box-shadow:0 6px 26px rgba(168,85,247,.45),0 0 40px rgba(217,70,239,.18);}
body.theme-lavender .subtab.active,body.theme-lavender .top-tab.active .tab-icon{filter:drop-shadow(0 0 9px rgba(168,85,247,.6));}

/* ════════════════ 6 · نعناعي — منعش رياضي ════════════════ */
body.theme-mint{
  --bg:#F0FDF6;--surface:#FFFFFF;--surface2:#E7F8EF;--border:#BFEBD2;
  --text:#06281A;--muted:#5E8F78;--accent:#10B981;--accent-rgb:16,185,129;--accent-light:#D9F6E9;
  --green:#0E9F6E;--green-light:#D7F5E7;--blue:#0EA5E9;--blue-light:#E0F4FD;
  --red:#E0564B;--red-light:#FBE4E2;--orange:#DD8A2E;--orange-light:#FBEEDC;
  --shadow:0 4px 16px rgba(16,150,105,.09);--shadow-lg:0 18px 46px rgba(16,150,105,.15);
  --nav-bg:rgba(250,255,252,.9);--topbar-bg:rgba(248,254,251,.88);--on-accent:#FFF;
  --fxbg:radial-gradient(880px 520px at 86% -10%,rgba(52,211,153,.16),transparent 60%),radial-gradient(740px 480px at 4% 112%,rgba(16,185,129,.10),transparent 55%),linear-gradient(170deg,#F4FDF8 0%,#DEF6EA 100%);
}
body.theme-mint .card,body.theme-mint .stat-card,body.theme-mint .nutri-mealcard,body.theme-mint .modal-box,body.theme-mint .awx{border:1px solid #CDEFDC;box-shadow:0 8px 24px rgba(16,150,105,.09);}
body.theme-mint .btn-p{background:linear-gradient(135deg,#22C68A,#0E9F6E);box-shadow:0 6px 20px rgba(16,185,129,.32);}

/* ════════════════ 7 · ليلة ذهبية — VIP أسود/ذهب ════════════════ */
body.theme-dark{
  --bg:#0A0A0C;--surface:#17150F;--surface2:#221E14;--border:#3A3220;
  --text:#F5EFE0;--muted:#A89A78;--accent:#D4AF37;--accent-rgb:212,175,55;--accent-light:#2A2410;
  --green:#7BAF6B;--green-light:#1C2A16;--blue:#7B97C8;--blue-light:#16203A;
  --red:#D9645C;--red-light:#33150F;--orange:#E0913A;--orange-light:#33230E;
  --shadow:0 4px 18px rgba(0,0,0,.6);--shadow-lg:0 22px 56px rgba(0,0,0,.75);
  --nav-bg:rgba(10,10,12,.86);--topbar-bg:rgba(10,10,12,.82);--on-accent:#1A1405;
  --fxbg:radial-gradient(880px 500px at 85% -12%,rgba(212,175,55,.12),transparent 60%),radial-gradient(680px 460px at 6% 112%,rgba(150,118,40,.08),transparent 55%),linear-gradient(168deg,#0A0A0C 0%,#12100A 60%,#171307 100%);
}
body.theme-dark .card,body.theme-dark .stat-card,body.theme-dark .nutri-mealcard,body.theme-dark .modal-box,body.theme-dark .awx{border:1px solid rgba(212,175,55,.18);box-shadow:0 10px 30px rgba(0,0,0,.55);}
body.theme-dark .btn-p{background:linear-gradient(135deg,#E5C158 0%,#B4912C 55%,#D4AF37 100%);box-shadow:0 6px 24px rgba(212,175,55,.35),inset 0 1px 0 rgba(255,235,170,.5);}
body.theme-dark .bph,body.theme-dark .ph2{text-shadow:0 0 24px rgba(212,175,55,.14);}

/* ════════════════ 8 · جحيم — أسود/أحمر ════════════════ */
body.theme-inferno{
  --bg:#0C0506;--surface:#1A0E10;--surface2:#251316;--border:#4A1F24;
  --text:#FFEDEA;--muted:#C49090;--accent:#F43F3F;--accent-rgb:244,63,63;--accent-light:#3A1013;
  --green:#4ADE80;--green-light:#10301C;--blue:#FB923C;--blue-light:#33200E;
  --red:#FF5C5C;--red-light:#3F1418;--orange:#FB923C;--orange-light:#33200E;
  --shadow:0 4px 20px rgba(8,1,2,.6);--shadow-lg:0 22px 56px rgba(8,1,2,.75);
  --nav-bg:rgba(12,5,6,.86);--topbar-bg:rgba(12,5,6,.82);--on-accent:#FFF;
  --fxbg:radial-gradient(820px 520px at 50% 118%,rgba(244,63,63,.20),transparent 60%),radial-gradient(700px 420px at 88% -10%,rgba(180,30,30,.12),transparent 55%),linear-gradient(170deg,#0C0506 0%,#1B0709 60%,#2A0A0C 100%);
}
body.theme-inferno .card,body.theme-inferno .stat-card,body.theme-inferno .nutri-mealcard,body.theme-inferno .modal-box,body.theme-inferno .awx{border:1px solid rgba(244,63,63,.20);box-shadow:0 10px 30px rgba(8,1,2,.55);}
body.theme-inferno .btn-p{background:linear-gradient(135deg,#EF4444,#B91C1C);box-shadow:0 6px 26px rgba(244,63,63,.42),0 0 40px rgba(244,63,63,.15);}

/* ════════════════ 9 · كهربائي — سايبربانك أزرق/أصفر ════════════════ */
body.theme-electric{
  --bg:#04070E;--surface:#0B1220;--surface2:#111B30;--border:#1E3A5F;
  --text:#E6FAFF;--muted:#8FB8D0;--accent:#22D3EE;--accent-rgb:34,211,238;--accent-light:#0A2A36;
  --green:#4ADE80;--green-light:#0E3320;--blue:#38BDF8;--blue-light:#0C2A40;
  --red:#FB7185;--red-light:#38121E;--orange:#FDE047;--orange-light:#33300C;
  --shadow:0 4px 20px rgba(1,5,14,.6);--shadow-lg:0 22px 56px rgba(1,5,14,.75);
  --nav-bg:rgba(4,7,14,.86);--topbar-bg:rgba(4,7,14,.82);--on-accent:#062530;
  --fxbg:repeating-linear-gradient(0deg,transparent 0 39px,rgba(34,211,238,.045) 39px 40px),repeating-linear-gradient(90deg,transparent 0 39px,rgba(34,211,238,.045) 39px 40px),radial-gradient(820px 500px at 85% -12%,rgba(34,211,238,.14),transparent 60%),radial-gradient(640px 440px at 8% 112%,rgba(253,224,71,.07),transparent 55%),linear-gradient(170deg,#04070E 0%,#081224 100%);
}
body.theme-electric .card,body.theme-electric .stat-card,body.theme-electric .nutri-mealcard,body.theme-electric .modal-box,body.theme-electric .awx{border:1px solid rgba(34,211,238,.22);box-shadow:0 10px 30px rgba(1,5,14,.55),0 0 16px rgba(34,211,238,.05) inset;}
body.theme-electric .btn-p{background:linear-gradient(135deg,#22D3EE,#0EA5E9);box-shadow:0 6px 26px rgba(34,211,238,.4),0 0 40px rgba(253,224,71,.10);}
body.theme-electric .hr-streak,body.theme-electric .c-val{color:#FDE047;}

/* ════════════════ 10 · مجرة — فضاء وسديم ════════════════ */
body.theme-galaxy{
  --bg:#050314;--surface:#171230;--surface2:#221B40;--border:#3B2D6E;
  --text:#EFEAFF;--muted:#A29BC8;--accent:#818CF8;--accent-rgb:129,140,248;--accent-light:#1E1A45;
  --green:#5EEAD4;--green-light:#0E332D;--blue:#93C5FD;--blue-light:#14264A;
  --red:#F472B6;--red-light:#3A1430;--orange:#FCA5A5;--orange-light:#361A1A;
  --shadow:0 4px 20px rgba(2,1,12,.6);--shadow-lg:0 22px 56px rgba(2,1,12,.75);
  --nav-bg:rgba(5,3,20,.84);--topbar-bg:rgba(5,3,20,.8);--on-accent:#0B0830;
  --fxbg:radial-gradient(760px 480px at 80% -8%,rgba(124,58,237,.26),transparent 60%),radial-gradient(620px 420px at 6% 30%,rgba(219,39,119,.13),transparent 55%),radial-gradient(700px 480px at 60% 115%,rgba(59,130,246,.16),transparent 60%),linear-gradient(170deg,#050314 0%,#0E0826 60%,#140A2E 100%);
}
body.theme-galaxy .card,body.theme-galaxy .stat-card,body.theme-galaxy .nutri-mealcard,body.theme-galaxy .modal-box,body.theme-galaxy .awx{background:rgba(25,18,52,.62);border:1px solid rgba(129,140,248,.18);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);}
body.theme-galaxy .btn-p{background:linear-gradient(135deg,#818CF8,#C084FC);box-shadow:0 6px 26px rgba(129,140,248,.4);}

/* ════════════════ 11 · طبيعة — أخضر غابات هادئ ════════════════ */
body.theme-nature{
  --bg:#F4F9EE;--surface:#FEFFFB;--surface2:#ECF5E3;--border:#CFE3BC;
  --text:#1F2E18;--muted:#6E835C;--accent:#5B8C2A;--accent-rgb:91,140,42;--accent-light:#E4F1D4;
  --green:#3E7C2F;--green-light:#E0F1D8;--blue:#3C7C8C;--blue-light:#E0F0F4;
  --red:#B65C3C;--red-light:#F8E6DE;--orange:#C28B2E;--orange-light:#F7EDD8;
  --shadow:0 4px 16px rgba(70,110,40,.09);--shadow-lg:0 18px 46px rgba(70,110,40,.15);
  --nav-bg:rgba(250,253,246,.9);--topbar-bg:rgba(248,252,243,.88);--on-accent:#FFF;--r:22px;
  --fxbg:radial-gradient(860px 520px at 86% -10%,rgba(140,190,90,.16),transparent 60%),radial-gradient(720px 460px at 4% 112%,rgba(91,140,42,.10),transparent 55%),linear-gradient(170deg,#F7FBF1 0%,#E4F1D6 100%);
}
body.theme-nature .card,body.theme-nature .stat-card,body.theme-nature .nutri-mealcard,body.theme-nature .modal-box,body.theme-nature .awx{border:1px solid #D8E9C6;box-shadow:0 8px 24px rgba(70,110,40,.09);}
body.theme-nature .btn-p{background:linear-gradient(135deg,#74A83C,#4E7A22);box-shadow:0 6px 20px rgba(91,140,42,.30);}

/* ════════════════ 12 · جليد — صقيع زجاجي ════════════════ */
body.theme-ice{
  --bg:#F3FAFF;--surface:#FFFFFF;--surface2:#EAF4FC;--border:#C9E2F5;
  --text:#0E2A40;--muted:#5E84A3;--accent:#0EA5E9;--accent-rgb:14,165,233;--accent-light:#DDF1FC;
  --green:#15A06A;--green-light:#DEF5EC;--blue:#3B82F6;--blue-light:#E2ECFE;
  --red:#E0564B;--red-light:#FBE4E2;--orange:#DD8A2E;--orange-light:#FBEEDC;
  --shadow:0 4px 18px rgba(40,110,170,.10);--shadow-lg:0 18px 48px rgba(40,110,170,.16);
  --nav-bg:rgba(248,253,255,.85);--topbar-bg:rgba(246,252,255,.82);--on-accent:#FFF;
  --fxbg:radial-gradient(880px 520px at 84% -10%,rgba(125,200,255,.22),transparent 60%),radial-gradient(740px 480px at 4% 112%,rgba(14,165,233,.10),transparent 55%),linear-gradient(170deg,#F6FBFF 0%,#DFF0FB 100%);
}
body.theme-ice .card,body.theme-ice .stat-card,body.theme-ice .nutri-mealcard,body.theme-ice .modal-box,body.theme-ice .awx{background:rgba(255,255,255,.72);border:1px solid rgba(165,210,245,.6);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 8px 26px rgba(40,110,170,.10);}
body.theme-ice .top-tabs,body.theme-ice .top-profile-bar,body.theme-ice .subtabs{backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);}
body.theme-ice .btn-p{background:linear-gradient(135deg,#38BDF8,#0284C7);box-shadow:0 6px 20px rgba(14,165,233,.32);}

/* ════════════════ 13 · غروب — برتقالي/وردي/بنفسجي ════════════════ */
body.theme-sunset{
  --bg:#2B1055;--surface:#41204B;--surface2:#522A52;--border:#6B3A60;
  --text:#FFF3E8;--muted:#E5B39A;--accent:#FB923C;--accent-rgb:251,146,60;--accent-light:#5A2E3A;
  --green:#6EE7B7;--green-light:#1B4034;--blue:#C4B5FD;--blue-light:#3A2A66;
  --red:#FB7185;--red-light:#55203A;--orange:#FDBA74;--orange-light:#5A3520;
  --shadow:0 4px 20px rgba(20,5,40,.5);--shadow-lg:0 22px 56px rgba(20,5,40,.65);
  --nav-bg:rgba(35,12,60,.82);--topbar-bg:rgba(35,12,60,.78);--on-accent:#3A1207;
  --fxbg:radial-gradient(900px 560px at 50% 116%,rgba(250,140,60,.30),transparent 62%),radial-gradient(700px 460px at 88% -10%,rgba(167,89,216,.22),transparent 58%),linear-gradient(168deg,#2B1055 0%,#5C2160 45%,#933A47 75%,#C2491D 100%);
}
body.theme-sunset .card,body.theme-sunset .stat-card,body.theme-sunset .nutri-mealcard,body.theme-sunset .modal-box,body.theme-sunset .awx{background:rgba(62,28,72,.6);border:1px solid rgba(255,160,110,.18);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);}
body.theme-sunset .btn-p{background:linear-gradient(135deg,#FB923C,#E1486B);box-shadow:0 6px 26px rgba(251,146,60,.4);}
`;

  // ─────────────────────────────────────────────
  //  جزيئات الخلفية لكل ثيم
  // ─────────────────────────────────────────────
  function rnd(a, b) { return a + Math.random() * (b - a); }

  function bubbles() { // المحيط
    let h = '';
    for (let i = 0; i < 12; i++) {
      const s = rnd(5, 16);
      h += `<i class="fx-bub" style="left:${rnd(2,96)}%;width:${s}px;height:${s}px;animation-duration:${rnd(9,20)}s;animation-delay:-${rnd(0,18)}s"></i>`;
    }
    return h;
  }
  function stars() { // مجرة
    let h = '';
    for (let i = 0; i < 60; i++) {
      const s = rnd(1, 2.6);
      h += `<i class="fx-st" style="left:${rnd(0,100)}%;top:${rnd(0,100)}%;width:${s}px;height:${s}px;animation-duration:${rnd(1.6,4.2)}s;animation-delay:-${rnd(0,4)}s;opacity:${rnd(.2,.9)}"></i>`;
    }
    return h;
  }
  function embers() { // جحيم
    let h = '';
    for (let i = 0; i < 11; i++) {
      const s = rnd(3, 7);
      h += `<i class="fx-emb" style="left:${rnd(4,94)}%;width:${s}px;height:${s}px;animation-duration:${rnd(6,13)}s;animation-delay:-${rnd(0,12)}s"></i>`;
    }
    return h;
  }
  function snow() { // جليد
    let h = '';
    for (let i = 0; i < 13; i++) {
      const s = rnd(2.5, 6);
      h += `<i class="fx-snw" style="left:${rnd(0,98)}%;width:${s}px;height:${s}px;animation-duration:${rnd(9,20)}s;animation-delay:-${rnd(0,18)}s;opacity:${rnd(.4,.95)}"></i>`;
    }
    return h;
  }
  function orbs(colors) { // غروب / سايبر — كرات ضوء ضبابية
    return colors.map((c, i) =>
      `<i class="fx-orb" style="background:${c};width:${rnd(180,280)}px;height:${rnd(180,280)}px;${i % 2 ? 'right' : 'left'}:${rnd(-6,18)}%;${i % 2 ? 'bottom' : 'top'}:${rnd(-8,20)}%;animation-duration:${rnd(9,15)}s"></i>`
    ).join('');
  }
  function scan() { return '<i class="fx-scan"></i>'; } // كهربائي

  const FX = {
    ocean:    bubbles,
    galaxy:   () => stars() + orbs(['rgba(124,58,237,.5)']),
    inferno:  embers,
    ice:      snow,
    electric: scan,
    sunset:   () => orbs(['rgba(251,146,60,.55)', 'rgba(217,70,140,.45)']),
    lavender: () => orbs(['rgba(168,85,247,.4)', 'rgba(34,211,238,.22)']),
  };

  // ─────────────────────────────────────────────
  //  محرك التطبيق
  // ─────────────────────────────────────────────
  let _fxEl = null, _curFx = null;

  function ensureFxLayer() {
    if (_fxEl && document.body.contains(_fxEl)) return _fxEl;
    _fxEl = document.createElement('div');
    _fxEl.id = 'theme-fx';
    document.body.prepend(_fxEl);
    return _fxEl;
  }

  function curTheme() {
    const m = (document.body.className || '').match(/theme-([a-z]+)/);
    return m ? m[1] : 'default';
  }

  function setThemeFX(id) {
    if (id === _curFx) return;
    _curFx = id;
    const el = ensureFxLayer();
    const builder = FX[id];
    el.innerHTML = builder ? builder() : '';
  }

  function updateMetaColor(id) {
    const def = THEMES.find(t => t.id === id);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && def) meta.content = def.metaBg;
  }

  // ── معاينة حية لكل ثيم (mini mockup) ──
  window.renderThemeGrid = function () {
    const el = document.getElementById('theme-grid');
    if (!el) return;
    const cur = curTheme();
    el.innerHTML = THEMES.map(t => {
      const c = t.c;
      const bars = [55, 80, 40, 95].map(p =>
        `<i style="height:${p}%;background:${c.ac}"></i>`).join('');
      return `<div class="thx ${t.id === cur ? 'on' : ''}" onclick="applyTheme('${t.id}')" role="button" aria-label="ثيم ${t.name}">
        <div class="thx-prev" style="background:${c.grad}">
          <div class="thx-top" style="background:${c.s}"><i style="background:${c.ac}"></i></div>
          <div class="thx-card" style="background:${c.s}">
            <b style="background:${c.tx}"></b><b style="background:${c.tx}"></b>
            <div class="thx-prog"><i style="background:${c.ac};box-shadow:0 0 7px ${c.ac}"></i></div>
          </div>
          <div class="thx-row">
            <div class="thx-chart">${bars}</div>
            <div class="thx-btn" style="background:${c.ac}"></div>
          </div>
        </div>
        <div class="thx-name">${t.emoji} ${t.name}</div>
        <div class="thx-check" style="background:${c.ac}">✓</div>
      </div>`;
    }).join('');
  };

  // ── انتقال سلس عند التبديل (يغلّف applyTheme الأصلية — الحفظ يبقى فيها) ──
  const origApply = window.applyTheme;
  if (typeof origApply === 'function') {
    window.applyTheme = function (id) {
      document.documentElement.classList.add('theme-anim');
      origApply(id);
      setTimeout(() => document.documentElement.classList.remove('theme-anim'), 600);
    };
  }

  // ── مراقبة تغيّر كلاس body (يغطي startApp + applyTheme معاً) ──
  function syncTheme() {
    const id = curTheme();
    setThemeFX(id);
    updateMetaColor(id);
  }

  function boot() {
    const style = document.createElement('style');
    style.id = 'premium-themes';
    style.textContent = CSS;
    document.head.appendChild(style);
    ensureFxLayer();
    syncTheme();
    new MutationObserver(syncTheme)
      .observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
