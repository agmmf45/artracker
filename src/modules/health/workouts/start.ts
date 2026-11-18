import { setMeta } from '@/core/db';
import { newId } from '@/core/ids';
import { exercisesFromLast, type ActiveWorkout, type WExercise, type WorkoutData } from './model';

/**
 * Starts the live session (kept in IndexedDB meta, so a refresh never loses it). With no exercise
 * list, a name used before (e.g. "Legs") picks up that session's exercises as the starting plan.
 */
export async function startWorkout(name: string, program_id: string | null = null, exercises?: WExercise[], history: WorkoutData[] = []): Promise<void> {
  const list = exercises ?? exercisesFromLast(history, name, () => newId('ex'));
  await setMeta('workout_active', { name, program_id, started_at: new Date().toISOString(), exercises: list, rest_until: null, rest_ex: null } satisfies ActiveWorkout);
}
