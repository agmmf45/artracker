import { useEffect, useRef } from 'react';
import { useI18n } from '@/core/i18n';
import { useSettings } from '@/core/hooks';
import { toast } from '@/core/toast';
import { checkAchievements } from '@/modules/life/achievements/engine';

/** Tasteful confetti (v4 dqConfetti), skipped for reduced-motion users or when animations are off. */
export function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#A69BCB', '#799FCB', '#83B89C', '#D5B178', '#E08571'];
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:90;overflow:hidden';
  for (let i = 0; i < 70; i++) {
    const p = document.createElement('i');
    const x = Math.random() * 100;
    p.style.cssText = `position:absolute;top:-12px;left:${x}%;width:7px;height:11px;border-radius:2px;background:${colors[i % colors.length]};opacity:.9;transform:rotate(${Math.random() * 360}deg)`;
    p.animate([{ transform: `translate(0,0) rotate(0deg)` }, { transform: `translate(${(Math.random() - 0.5) * 240}px, ${window.innerHeight + 40}px) rotate(${Math.random() * 720}deg)` }], { duration: 1600 + Math.random() * 1200, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' });
    host.appendChild(p);
  }
  document.body.appendChild(host);
  setTimeout(() => host.remove(), 3200);
}

export function AchievementWatcher() {
  const { L } = useI18n();
  const settings = useSettings();
  const ref = useRef({ L, settings });
  ref.current = { L, settings };
  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!alive || !ref.current.settings.gamification.enabled) return;
      try {
        const fresh = await checkAchievements();
        for (const a of fresh) {
          toast(`${a.icon} ${ref.current.L('إنجاز جديد:', 'New achievement:')} ${ref.current.L(a.ar, a.en)}`, { tone: 'reward', ttl: 5000 });
        }
        if (fresh.length && ref.current.settings.gamification.animations) confetti();
      } catch { /* db closed during sign-out */ }
    };
    const first = setTimeout(run, 4000);
    const iv = setInterval(run, 90_000);
    return () => { alive = false; clearTimeout(first); clearInterval(iv); };
  }, []);
  return null;
}
