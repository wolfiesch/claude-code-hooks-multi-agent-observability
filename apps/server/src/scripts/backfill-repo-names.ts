#!/usr/bin/env bun
/**
 * Backfill repository names in session_summaries from session data in events
 */

import { Database } from 'bun:sqlite';

const db = new Database('events.db');

interface SessionMetadata {
  session_id: string;
  repo_name?: string;
  project_name?: string;
  branch_name?: string;
  commit_hash?: string;
}

function extractMetadataFromEvent(event: any): SessionMetadata {
  const env = event.environment ? JSON.parse(event.environment) : null;
  const git = event.git ? JSON.parse(event.git) : null;
  const session = event.session ? JSON.parse(event.session) : null;

  // Try to get working directory from session first, then fall back to environment
  const workingDirectory = session?.workingDirectory || env?.working_directory;
  const workingDirectoryName = session?.workingDirectoryName;

  return {
    session_id: event.session_id,
    repo_name: env?.repo_name || env?.repository || workingDirectoryName,
    project_name: env?.project_name || workingDirectoryName || workingDirectory?.split('/').pop(),
    branch_name: git?.branch || env?.branch,
    commit_hash: git?.commitHash || git?.commit || git?.commit_hash
  };
}

console.log('Starting backfill of repository names...');

// Get all unique session_ids that need updating (where repo_name and project_name are NULL)
const sessionsToUpdate = db.prepare(`
  SELECT session_id
  FROM session_summaries
  WHERE (repo_name IS NULL OR repo_name = '')
    AND (project_name IS NULL OR project_name = '')
`).all() as { session_id: string }[];

console.log(`Found ${sessionsToUpdate.length} sessions to update`);

let updated = 0;
let skipped = 0;

for (const { session_id } of sessionsToUpdate) {
  // Get the first event for this session that has session data
  const event = db.prepare(`
    SELECT session_id, environment, git, session
    FROM events
    WHERE session_id = ? AND session IS NOT NULL
    LIMIT 1
  `).get(session_id) as any;

  if (!event) {
    skipped++;
    continue;
  }

  const metadata = extractMetadataFromEvent(event);

  if (metadata.repo_name || metadata.project_name) {
    // Update the session summary
    db.prepare(`
      UPDATE session_summaries
      SET repo_name = ?,
          project_name = ?,
          branch_name = COALESCE(branch_name, ?),
          commit_hash = COALESCE(commit_hash, ?)
      WHERE session_id = ?
    `).run(
      metadata.repo_name || null,
      metadata.project_name || null,
      metadata.branch_name || null,
      metadata.commit_hash || null,
      session_id
    );

    updated++;
    if (updated % 100 === 0) {
      console.log(`Updated ${updated} sessions...`);
    }
  } else {
    skipped++;
  }
}

console.log(`\nBackfill complete!`);
console.log(`  Updated: ${updated} sessions`);
console.log(`  Skipped: ${skipped} sessions (no session data found)`);

db.close();
