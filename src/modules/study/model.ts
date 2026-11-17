import type { Rec } from '@shared/records';
import { shiftKey, todayKey } from '@/core/dates';

export interface Session { day: number; start: string; end: string; kind?: 'lecture' | 'lab' | 'clinical'; room?: string }
export interface GradeComponent { id: string; name: string; weight: number; score: number | null; max: number }

export interface SemesterData { name: string; year: string; start: string | null; end: string | null; active: boolean }
export interface CourseData {
  name: string; code: string; credits: number; instructor: string; room: string; color: string | null;
  semester_id: string | null; schedule: Session[]; components: GradeComponent[]; target: number | null;
  final_points: number | null; final_letter: string | null; attendance: Record<string, 'present' | 'absent' | 'late' | 'excused'>;
  resources: Array<{ title: string; url: string }>; archived?: boolean; start?: string | null; end?: string | null;
}
export type LectureState = 'not_started' | 'in_progress' | 'studied' | 'revision' | 'mastered';
export interface LectureData {
  title: string; course_id: string | null; chapter: string; number: number | null; objectives: string; summary: string;
  topics: string[]; resources: Array<{ title: string; url: string; kind?: string }>; understanding: number | null;
  revisions: string[]; next_review: string | null; note_id?: string | null;
}
export interface ExamData {
  title: string; course_id: string | null; kind: 'quiz' | 'midterm' | 'final' | 'practical' | 'osce' | 'other'; time: string | null;
  duration_min: number | null; location: string | null; weight: number | null; target: number | null; score: number | null; max: number;
  lecture_ids: string[]; notes: string;
}
export interface AssignmentData { title: string; course_id: string | null; due_time: string | null; weight: number | null; score: number | null; max: number; notes: string; link: string | null }
export interface StudySessionData { course_id: string | null; lecture_id: string | null; mode: 'pomodoro' | 'custom' | 'stopwatch'; started_at: string; ended_at: string; duration_min: number; notes: string }

export type Course = Rec<CourseData>;
export type Lecture = Rec<LectureData>;
export type Exam = Rec<ExamData>;

export const LECTURE_STATES: Array<[LectureState, string, string, string]> = [
  ['not_started', 'لم تبدأ', 'Not started', 'var(--text-3)'],
  ['in_progress', 'قيد الدراسة', 'In progress', 'var(--warning)'],
  ['studied', 'درستها', 'Studied', 'var(--study)'],
  ['revision', 'تحتاج مراجعة', 'Needs revision', 'var(--danger)'],
  ['mastered', 'متقنة', 'Mastered', 'var(--success)'],
];

/** Revision spacing for lectures (days after each successive revision). */
const REVIEW_GAPS = [1, 3, 7, 14, 30, 60];
export function nextLectureReview(revisions: string[], from = todayKey()): string {
  return shiftKey(from, REVIEW_GAPS[Math.min(revisions.length, REVIEW_GAPS.length - 1)]);
}

export function blankCourse(p: Partial<CourseData> = {}): CourseData {
  return { name: '', code: '', credits: 3, instructor: '', room: '', color: null, semester_id: null, schedule: [], components: [], target: null, final_points: null, final_letter: null, attendance: {}, resources: [], ...p };
}
export function blankLecture(p: Partial<LectureData> = {}): LectureData {
  return { title: '', course_id: null, chapter: '', number: null, objectives: '', summary: '', topics: [], resources: [], understanding: null, revisions: [], next_review: null, ...p };
}
export function blankExam(p: Partial<ExamData> = {}): ExamData {
  return { title: '', course_id: null, kind: 'midterm', time: null, duration_min: 120, location: null, weight: null, target: null, score: null, max: 100, lecture_ids: [], notes: '', ...p };
}

/**
 * Course grade from weighted components. Only graded components count; the result is the
 * percentage earned so far *out of the weight already graded* plus the projection when
 * remaining components are assumed to match the current average. Assumptions are returned.
 */
export function courseGrade(c: CourseData): { current: number | null; graded: number; earned: number; projected: number | null } {
  const graded = c.components.filter((x) => x.score !== null && x.max > 0);
  const gw = graded.reduce((s, x) => s + x.weight, 0);
  const earned = graded.reduce((s, x) => s + (x.score! / x.max) * x.weight, 0);
  const totalW = c.components.reduce((s, x) => s + x.weight, 0);
  if (!gw) return { current: null, graded: 0, earned: 0, projected: null };
  const current = (earned / gw) * 100;
  return { current, graded: gw, earned, projected: totalW ? earned + (current / 100) * (totalW - gw) : current };
}

export function pointsFor(percent: number, scale: Array<{ min: number; letter: string; points: number }>): { letter: string; points: number } {
  const row = [...scale].sort((a, b) => b.min - a.min).find((r) => percent >= r.min) ?? scale[scale.length - 1];
  return { letter: row.letter, points: row.points };
}

/** Credit-weighted GPA. */
export function gpa(rows: Array<{ credits: number; points: number }>): number | null {
  const cr = rows.reduce((s, r) => s + r.credits, 0);
  return cr ? rows.reduce((s, r) => s + r.credits * r.points, 0) / cr : null;
}

/** Average points needed across `remainingCredits` to reach `target` cumulative GPA. */
export function requiredForTarget(currentGpa: number | null, doneCredits: number, remainingCredits: number, target: number): number | null {
  if (!remainingCredits) return null;
  return (target * (doneCredits + remainingCredits) - (currentGpa ?? 0) * doneCredits) / remainingCredits;
}

/**
 * Study plan generator: spreads remaining lectures over the days before an exam.
 * Harder (lower understanding) lectures get more time; the day before the exam is left for review;
 * blocks are 50 min with 10 min breaks and never exceed the daily budget.
 */
export interface PlanBlock { date: string; lecture_id: string | null; title: string; minutes: number; review?: boolean }
export function generatePlan(opts: { lectures: Lecture[]; examDate: string; startDate: string; dailyMinutes: number; skipDays?: number[]; examTitle: string }): PlanBlock[] {
  const { lectures, examDate, startDate, dailyMinutes, skipDays = [] } = opts;
  const days: string[] = [];
  for (let d = startDate; d < shiftKey(examDate, -1); d = shiftKey(d, 1)) if (!skipDays.includes(new Date(`${d}T00:00:00`).getDay())) days.push(d);
  const todo = lectures.filter((l) => l.status !== 'mastered');
  const weight = (l: Lecture) => (l.status === 'not_started' ? 3 : l.status === 'in_progress' ? 2.5 : l.status === 'revision' ? 2 : 1) * (6 - (l.data.understanding ?? 3)) / 3;
  const need = todo.map((l) => ({ l, min: Math.round(Math.max(25, Math.min(150, 50 * weight(l))) / 25) * 25 }));
  const out: PlanBlock[] = [];
  let di = 0;
  let used = 0;
  for (const { l, min } of need) {
    let left = min;
    while (left > 0 && di < days.length) {
      const room = dailyMinutes - used;
      if (room < 25) { di++; used = 0; continue; }
      const chunk = Math.min(left, 50, room);
      out.push({ date: days[di], lecture_id: l.id, title: l.data.title, minutes: chunk });
      left -= chunk;
      used += chunk + 10; // 10-min break after each block
    }
  }
  const reviewDay = shiftKey(examDate, -1);
  if (reviewDay >= startDate) out.push({ date: reviewDay, lecture_id: null, title: `مراجعة عامة · ${opts.examTitle}`, minutes: Math.min(dailyMinutes, 120), review: true });
  return out;
}
