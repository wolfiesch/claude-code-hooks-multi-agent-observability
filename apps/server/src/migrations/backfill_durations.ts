import { getDatabase } from '../db';

/**
 * Backfill duration_ms for existing sessions that don't have it calculated
 * This migration ensures all sessions show accurate durations based on their last event
 */
export function backfillSessionDurations(): void {
  const db = getDatabase();

  try {
    console.log('Backfilling session durations...');

    // Update all sessions that have NULL duration_ms but have last_updated
    const result = db.prepare(`
      UPDATE session_summaries
      SET duration_ms = last_updated - start_time
      WHERE duration_ms IS NULL AND last_updated IS NOT NULL
    `).run();

    console.log(`Backfilled duration for ${result.changes} sessions`);

    // Also fix sessions where duration is 0 but they have multiple events
    const result2 = db.prepare(`
      UPDATE session_summaries
      SET duration_ms = last_updated - start_time
      WHERE duration_ms = 0 AND event_count > 1 AND last_updated > start_time
    `).run();

    console.log(`Fixed duration for ${result2.changes} sessions with 0 duration but multiple events`);
  } catch (error) {
    console.error('Error backfilling session durations:', error);
  }
}
