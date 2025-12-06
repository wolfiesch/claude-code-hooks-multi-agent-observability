/**
 * Standalone migration script to backfill session durations
 * Run this when the server is NOT running to avoid database locks
 */

import { Database } from 'bun:sqlite';

const db = new Database('events.db');

try {
  console.log('Backfilling session durations...');

  // Update all sessions that have NULL duration_ms but have last_updated
  const result1 = db.prepare(`
    UPDATE session_summaries
    SET duration_ms = last_updated - start_time
    WHERE duration_ms IS NULL AND last_updated IS NOT NULL
  `).run();

  console.log(`✓ Backfilled duration for ${result1.changes} sessions with NULL duration`);

  // Also fix sessions where duration is 0 but they have multiple events
  const result2 = db.prepare(`
    UPDATE session_summaries
    SET duration_ms = last_updated - start_time
    WHERE duration_ms = 0 AND event_count > 1 AND last_updated > start_time
  `).run();

  console.log(`✓ Fixed duration for ${result2.changes} sessions with 0 duration but multiple events`);

  // Verify the results
  const totalFixed = result1.changes + result2.changes;
  if (totalFixed > 0) {
    console.log(`\n✅ Successfully updated ${totalFixed} sessions`);
  } else {
    console.log('\n✅ No sessions needed updating - all durations are correct');
  }
} catch (error) {
  console.error('❌ Error backfilling session durations:', error);
  process.exit(1);
} finally {
  db.close();
}
