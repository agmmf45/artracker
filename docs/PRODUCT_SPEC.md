# Product spec — دقيق v5

**Promise:** "Your life, beautifully organized." Calm, fast, Arabic-first, rewarding without pressure.

## Navigation
Exactly four sections — **Life** (default; first page Overview), **Study**, **Health**, **Settings**. Every secondary page can be hidden in Settings › Modules (data is never deleted). Presets: Minimal, Student, Productivity, Health, Complete. Desktop: sidebar. Phone: section bar + bottom navigation + floating quick-add; swipe between pages of a section.

## Overview metrics (documented calculations)
- **Today's progress** = (tasks completed today + habits completed today) ÷ (tasks planned through today + habits scheduled today, excluding rest days).
- **Habit consistency (7 d)** = completed scheduled habit-days ÷ scheduled habit-days (rest/paused days excluded).
- **Study minutes** = Σ `study_session.duration_min` in range (overlaps clipped at save time).
- **Water / calories / protein** = Σ of today's logs. **Sleep** = latest night's logged hours.
- **Life balance** = completed tasks + completed habit-days linked to each life area in the last 30 days (+ open goals count). No scores are invented.
- **Activity heatmap** = count of positive XP events per day.

## Behavioural rules
No penalties for missed days; rest days and vacation mode never count as misses; achievements are never lost; no public leaderboard; XP daily caps prevent farming; rest, meals and self-care are never "rewards to be earned"; no restrictive calorie advice (calorie goal floor 1200 kcal); health is for organization, not diagnosis; no patient-identifying data in the clinical logbook; no fabricated citations.

## Kept from v4
Habits (+sub-steps, notes), tasks, wallets & savings goals with linked transfers, AI expense parsing and iOS-Shortcut bank-SMS hand-off (`/?sms=…&auto=1`), Hijri calendar & Islamic days, trophies (same ids), friends, 13 themes, workouts (programs, live session, PRs, muscle map, ExerciseDB explorer, tutorial videos, recovery tips), AI meal-photo analysis with portion rescaling, water, reminders, daily-note templates, printable reports, account reset, PWA install.
