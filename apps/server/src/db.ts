import { Database } from 'bun:sqlite';
import type { HookEvent, FilterOptions, Theme, ThemeSearchQuery } from './types';

let db: Database;

export function initDatabase(): void {
  db = new Database('events.db');
  
  // Enable WAL mode for better concurrent performance
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  
  // Create events table
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_app TEXT NOT NULL,
      session_id TEXT NOT NULL,
      hook_event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      chat TEXT,
      summary TEXT,
      timestamp INTEGER NOT NULL
    )
  `);
  
  // Check if chat column exists, add it if not (for migration)
  try {
    const columns = db.prepare("PRAGMA table_info(events)").all() as any[];
    const hasChatColumn = columns.some((col: any) => col.name === 'chat');
    if (!hasChatColumn) {
      db.exec('ALTER TABLE events ADD COLUMN chat TEXT');
    }

    // Check if summary column exists, add it if not (for migration)
    const hasSummaryColumn = columns.some((col: any) => col.name === 'summary');
    if (!hasSummaryColumn) {
      db.exec('ALTER TABLE events ADD COLUMN summary TEXT');
    }

    // Check if humanInTheLoop column exists, add it if not (for migration)
    const hasHumanInTheLoopColumn = columns.some((col: any) => col.name === 'humanInTheLoop');
    if (!hasHumanInTheLoopColumn) {
      db.exec('ALTER TABLE events ADD COLUMN humanInTheLoop TEXT');
    }

    // Check if humanInTheLoopStatus column exists, add it if not (for migration)
    const hasHumanInTheLoopStatusColumn = columns.some((col: any) => col.name === 'humanInTheLoopStatus');
    if (!hasHumanInTheLoopStatusColumn) {
      db.exec('ALTER TABLE events ADD COLUMN humanInTheLoopStatus TEXT');
    }

    // Check if model_name column exists, add it if not (for migration)
    const hasModelNameColumn = columns.some((col: any) => col.name === 'model_name');
    if (!hasModelNameColumn) {
      db.exec('ALTER TABLE events ADD COLUMN model_name TEXT');
    }

    // Check if input_tokens column exists, add it if not (for cost tracking)
    const hasInputTokensColumn = columns.some((col: any) => col.name === 'input_tokens');
    if (!hasInputTokensColumn) {
      db.exec('ALTER TABLE events ADD COLUMN input_tokens INTEGER');
    }

    // Check if output_tokens column exists, add it if not (for cost tracking)
    const hasOutputTokensColumn = columns.some((col: any) => col.name === 'output_tokens');
    if (!hasOutputTokensColumn) {
      db.exec('ALTER TABLE events ADD COLUMN output_tokens INTEGER');
    }

    // Check if cost_usd column exists, add it if not (for cost tracking)
    const hasCostUsdColumn = columns.some((col: any) => col.name === 'cost_usd');
    if (!hasCostUsdColumn) {
      db.exec('ALTER TABLE events ADD COLUMN cost_usd REAL');
    }

    // Check if git column exists, add it if not (for Tier 0 metadata)
    const hasGitColumn = columns.some((col: any) => col.name === 'git');
    if (!hasGitColumn) {
      db.exec('ALTER TABLE events ADD COLUMN git TEXT');
    }

    // Check if session column exists, add it if not (for Tier 0 metadata)
    const hasSessionColumn = columns.some((col: any) => col.name === 'session');
    if (!hasSessionColumn) {
      db.exec('ALTER TABLE events ADD COLUMN session TEXT');
    }

    // Check if environment column exists, add it if not (for Tier 0 metadata)
    const hasEnvironmentColumn = columns.some((col: any) => col.name === 'environment');
    if (!hasEnvironmentColumn) {
      db.exec('ALTER TABLE events ADD COLUMN environment TEXT');
    }

    // Check if toolMetadata column exists, add it if not (for Tier 1 metadata)
    const hasToolMetadataColumn = columns.some((col: any) => col.name === 'toolMetadata');
    if (!hasToolMetadataColumn) {
      db.exec('ALTER TABLE events ADD COLUMN toolMetadata TEXT');
    }

    // Check if sessionStats column exists, add it if not (for Tier 1 metadata)
    const hasSessionStatsColumn = columns.some((col: any) => col.name === 'sessionStats');
    if (!hasSessionStatsColumn) {
      db.exec('ALTER TABLE events ADD COLUMN sessionStats TEXT');
    }

    // Check if workflow column exists, add it if not (for Tier 2 metadata)
    const hasWorkflowColumn = columns.some((col: any) => col.name === 'workflow');
    if (!hasWorkflowColumn) {
      db.exec('ALTER TABLE events ADD COLUMN workflow TEXT');
    }

    // Check if agent_type column exists, add it if not (for multi-agent support)
    const hasAgentTypeColumn = columns.some((col: any) => col.name === 'agent_type');
    if (!hasAgentTypeColumn) {
      db.exec('ALTER TABLE events ADD COLUMN agent_type TEXT DEFAULT "claude"');
    }

    // Check if agent_version column exists, add it if not (for multi-agent support)
    const hasAgentVersionColumn = columns.some((col: any) => col.name === 'agent_version');
    if (!hasAgentVersionColumn) {
      db.exec('ALTER TABLE events ADD COLUMN agent_version TEXT');
    }

    // Check if parent_session_id column exists, add it if not (for parent-child tracking)
    const hasParentSessionIdColumn = columns.some((col: any) => col.name === 'parent_session_id');
    if (!hasParentSessionIdColumn) {
      db.exec('ALTER TABLE events ADD COLUMN parent_session_id TEXT');
    }

    // Check if git_stats column exists, add it if not (for Codex git metadata)
    const hasGitStatsColumn = columns.some((col: any) => col.name === 'git_stats');
    if (!hasGitStatsColumn) {
      db.exec('ALTER TABLE events ADD COLUMN git_stats TEXT');
    }
  } catch (error) {
    // If the table doesn't exist yet, the CREATE TABLE above will handle it
  }

  // Create indexes for common queries
  db.exec('CREATE INDEX IF NOT EXISTS idx_source_app ON events(source_app)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_session_id ON events(session_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_hook_event_type ON events(hook_event_type)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_timestamp ON events(timestamp)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_agent_type ON events(agent_type)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_parent_session_id ON events(parent_session_id)');
  
  // Create themes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS themes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      displayName TEXT NOT NULL,
      description TEXT,
      colors TEXT NOT NULL,
      isPublic INTEGER NOT NULL DEFAULT 0,
      authorId TEXT,
      authorName TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      tags TEXT,
      downloadCount INTEGER DEFAULT 0,
      rating REAL DEFAULT 0,
      ratingCount INTEGER DEFAULT 0
    )
  `);
  
  // Create theme shares table
  db.exec(`
    CREATE TABLE IF NOT EXISTS theme_shares (
      id TEXT PRIMARY KEY,
      themeId TEXT NOT NULL,
      shareToken TEXT NOT NULL UNIQUE,
      expiresAt INTEGER,
      isPublic INTEGER NOT NULL DEFAULT 0,
      allowedUsers TEXT,
      createdAt INTEGER NOT NULL,
      accessCount INTEGER DEFAULT 0,
      FOREIGN KEY (themeId) REFERENCES themes (id) ON DELETE CASCADE
    )
  `);
  
  // Create theme ratings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS theme_ratings (
      id TEXT PRIMARY KEY,
      themeId TEXT NOT NULL,
      userId TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT,
      createdAt INTEGER NOT NULL,
      UNIQUE(themeId, userId),
      FOREIGN KEY (themeId) REFERENCES themes (id) ON DELETE CASCADE
    )
  `);
  
  // Create indexes for theme tables
  db.exec('CREATE INDEX IF NOT EXISTS idx_themes_name ON themes(name)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_themes_isPublic ON themes(isPublic)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_themes_createdAt ON themes(createdAt)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_theme_shares_token ON theme_shares(shareToken)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_theme_ratings_theme ON theme_ratings(themeId)');

  // Create session_summaries table for Historical Analysis
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_summaries (
      session_id TEXT PRIMARY KEY,
      source_app TEXT NOT NULL,
      agent_type TEXT NOT NULL,
      repo_name TEXT,
      project_name TEXT,
      script_name TEXT,
      branch_name TEXT,
      commit_hash TEXT,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      duration_ms INTEGER,
      status TEXT NOT NULL DEFAULT 'ongoing',
      has_errors INTEGER NOT NULL DEFAULT 0,
      has_hitl INTEGER NOT NULL DEFAULT 0,
      event_count INTEGER NOT NULL DEFAULT 0,
      critical_event_count INTEGER NOT NULL DEFAULT 0,
      total_cost_usd REAL NOT NULL DEFAULT 0,
      model_name TEXT,
      critical_events_summary TEXT,
      last_updated INTEGER NOT NULL
    )
  `);

  // Create indexes for session_summaries
  db.exec('CREATE INDEX IF NOT EXISTS idx_session_summaries_source_app ON session_summaries(source_app)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_session_summaries_agent_type ON session_summaries(agent_type)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_session_summaries_repo_name ON session_summaries(repo_name)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_session_summaries_status ON session_summaries(status)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_session_summaries_start_time ON session_summaries(start_time)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_session_summaries_has_errors ON session_summaries(has_errors)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_session_summaries_has_hitl ON session_summaries(has_hitl)');

  // Create FTS5 virtual table for full-text search
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS events_fts USING fts5(
        payload,
        summary,
        chat,
        content='events',
        content_rowid='id'
      )
    `);

    // Populate FTS table with existing data
    db.exec(`
      INSERT OR IGNORE INTO events_fts(rowid, payload, summary, chat)
      SELECT id, payload, COALESCE(summary, ''), COALESCE(chat, '') FROM events
    `);

    // Create triggers to keep FTS in sync
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS events_fts_insert AFTER INSERT ON events BEGIN
        INSERT INTO events_fts(rowid, payload, summary, chat)
        VALUES (new.id, new.payload, COALESCE(new.summary, ''), COALESCE(new.chat, ''));
      END
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS events_fts_update AFTER UPDATE ON events BEGIN
        UPDATE events_fts SET
          payload = new.payload,
          summary = COALESCE(new.summary, ''),
          chat = COALESCE(new.chat, '')
        WHERE rowid = old.id;
      END
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS events_fts_delete AFTER DELETE ON events BEGIN
        DELETE FROM events_fts WHERE rowid = old.id;
      END
    `);
  } catch (error) {
    console.log('FTS5 table setup:', error instanceof Error ? error.message : 'Unknown error');
    // FTS5 may already exist or SQLite version may not support it
  }
}

export function getDatabase(): Database {
  return db;
}

export function insertEvent(event: HookEvent): HookEvent {
  const stmt = db.prepare(`
    INSERT INTO events (source_app, session_id, hook_event_type, payload, chat, summary, timestamp, humanInTheLoop, humanInTheLoopStatus, model_name, input_tokens, output_tokens, cost_usd, git, session, environment, toolMetadata, sessionStats, workflow, agent_type, agent_version, parent_session_id, git_stats)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const timestamp = event.timestamp || Date.now();

  // Initialize humanInTheLoopStatus to pending if humanInTheLoop exists
  let humanInTheLoopStatus = event.humanInTheLoopStatus;
  if (event.humanInTheLoop && !humanInTheLoopStatus) {
    humanInTheLoopStatus = { status: 'pending' };
  }

  const result = stmt.run(
    event.source_app,
    event.session_id,
    event.hook_event_type,
    JSON.stringify(event.payload),
    event.chat ? JSON.stringify(event.chat) : null,
    event.summary || null,
    timestamp,
    event.humanInTheLoop ? JSON.stringify(event.humanInTheLoop) : null,
    humanInTheLoopStatus ? JSON.stringify(humanInTheLoopStatus) : null,
    event.model_name || null,
    event.input_tokens || null,
    event.output_tokens || null,
    event.cost_usd || null,
    (event as any).git ? JSON.stringify((event as any).git) : null,
    (event as any).session ? JSON.stringify((event as any).session) : null,
    (event as any).environment ? JSON.stringify((event as any).environment) : null,
    (event as any).toolMetadata ? JSON.stringify((event as any).toolMetadata) : null,
    (event as any).sessionStats ? JSON.stringify((event as any).sessionStats) : null,
    (event as any).workflow ? JSON.stringify((event as any).workflow) : null,
    event.agent_type || 'claude',
    event.agent_version || null,
    event.parent_session_id || null,
    (event as any).git_stats ? JSON.stringify((event as any).git_stats) : null
  );

  const savedEvent = {
    ...event,
    id: result.lastInsertRowid as number,
    timestamp,
    humanInTheLoopStatus
  };

  // Update session summary
  upsertSessionSummary(savedEvent);

  return savedEvent;
}

export function getFilterOptions(): FilterOptions {
  const sourceApps = db.prepare('SELECT DISTINCT source_app FROM events ORDER BY source_app').all() as { source_app: string }[];
  const sessionIds = db.prepare('SELECT DISTINCT session_id FROM events ORDER BY session_id DESC LIMIT 300').all() as { session_id: string }[];
  const hookEventTypes = db.prepare('SELECT DISTINCT hook_event_type FROM events ORDER BY hook_event_type').all() as { hook_event_type: string }[];
  const agentTypes = db.prepare('SELECT DISTINCT agent_type FROM events WHERE agent_type IS NOT NULL ORDER BY agent_type').all() as { agent_type: string }[];

  return {
    source_apps: sourceApps.map(row => row.source_app),
    session_ids: sessionIds.map(row => row.session_id),
    hook_event_types: hookEventTypes.map(row => row.hook_event_type),
    agent_types: agentTypes.map(row => row.agent_type)
  };
}

export function getRecentEvents(limit: number = 300): HookEvent[] {
  const stmt = db.prepare(`
    SELECT id, source_app, session_id, hook_event_type, payload, chat, summary, timestamp, humanInTheLoop, humanInTheLoopStatus, model_name, input_tokens, output_tokens, cost_usd, git, session, environment, toolMetadata, sessionStats, workflow, agent_type, agent_version, parent_session_id, git_stats
    FROM events
    ORDER BY timestamp DESC
    LIMIT ?
  `);

  const rows = stmt.all(limit) as any[];

  return rows.map(row => ({
    id: row.id,
    source_app: row.source_app,
    session_id: row.session_id,
    hook_event_type: row.hook_event_type,
    payload: JSON.parse(row.payload),
    chat: row.chat ? JSON.parse(row.chat) : undefined,
    summary: row.summary || undefined,
    timestamp: row.timestamp,
    humanInTheLoop: row.humanInTheLoop ? JSON.parse(row.humanInTheLoop) : undefined,
    humanInTheLoopStatus: row.humanInTheLoopStatus ? JSON.parse(row.humanInTheLoopStatus) : undefined,
    model_name: row.model_name || undefined,
    input_tokens: row.input_tokens || undefined,
    output_tokens: row.output_tokens || undefined,
    cost_usd: row.cost_usd || undefined,
    git: row.git ? JSON.parse(row.git) : undefined,
    session: row.session ? JSON.parse(row.session) : undefined,
    environment: row.environment ? JSON.parse(row.environment) : undefined,
    toolMetadata: row.toolMetadata ? JSON.parse(row.toolMetadata) : undefined,
    sessionStats: row.sessionStats ? JSON.parse(row.sessionStats) : undefined,
    workflow: row.workflow ? JSON.parse(row.workflow) : undefined,
    agent_type: row.agent_type || 'claude',
    agent_version: row.agent_version || undefined,
    parent_session_id: row.parent_session_id || undefined,
    git_stats: row.git_stats ? JSON.parse(row.git_stats) : undefined
  })).reverse();
}

// Theme database functions
export function insertTheme(theme: Theme): Theme {
  const stmt = db.prepare(`
    INSERT INTO themes (id, name, displayName, description, colors, isPublic, authorId, authorName, createdAt, updatedAt, tags, downloadCount, rating, ratingCount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    theme.id,
    theme.name,
    theme.displayName,
    theme.description || null,
    JSON.stringify(theme.colors),
    theme.isPublic ? 1 : 0,
    theme.authorId || null,
    theme.authorName || null,
    theme.createdAt,
    theme.updatedAt,
    JSON.stringify(theme.tags),
    theme.downloadCount || 0,
    theme.rating || 0,
    theme.ratingCount || 0
  );
  
  return theme;
}

export function updateTheme(id: string, updates: Partial<Theme>): boolean {
  const allowedFields = ['displayName', 'description', 'colors', 'isPublic', 'updatedAt', 'tags'];
  const setClause = Object.keys(updates)
    .filter(key => allowedFields.includes(key))
    .map(key => `${key} = ?`)
    .join(', ');
  
  if (!setClause) return false;
  
  const values = Object.keys(updates)
    .filter(key => allowedFields.includes(key))
    .map(key => {
      if (key === 'colors' || key === 'tags') {
        return JSON.stringify(updates[key as keyof Theme]);
      }
      if (key === 'isPublic') {
        return updates[key as keyof Theme] ? 1 : 0;
      }
      return updates[key as keyof Theme];
    });
  
  const stmt = db.prepare(`UPDATE themes SET ${setClause} WHERE id = ?`);
  const result = stmt.run(...values, id);
  
  return result.changes > 0;
}

export function getTheme(id: string): Theme | null {
  const stmt = db.prepare('SELECT * FROM themes WHERE id = ?');
  const row = stmt.get(id) as any;
  
  if (!row) return null;
  
  return {
    id: row.id,
    name: row.name,
    displayName: row.displayName,
    description: row.description,
    colors: JSON.parse(row.colors),
    isPublic: Boolean(row.isPublic),
    authorId: row.authorId,
    authorName: row.authorName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    tags: JSON.parse(row.tags || '[]'),
    downloadCount: row.downloadCount,
    rating: row.rating,
    ratingCount: row.ratingCount
  };
}

export function getThemes(query: ThemeSearchQuery = {}): Theme[] {
  let sql = 'SELECT * FROM themes WHERE 1=1';
  const params: any[] = [];
  
  if (query.isPublic !== undefined) {
    sql += ' AND isPublic = ?';
    params.push(query.isPublic ? 1 : 0);
  }
  
  if (query.authorId) {
    sql += ' AND authorId = ?';
    params.push(query.authorId);
  }
  
  if (query.query) {
    sql += ' AND (name LIKE ? OR displayName LIKE ? OR description LIKE ?)';
    const searchTerm = `%${query.query}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }
  
  // Add sorting
  const sortBy = query.sortBy || 'created';
  const sortOrder = query.sortOrder || 'desc';
  const sortColumn = {
    name: 'name',
    created: 'createdAt',
    updated: 'updatedAt',
    downloads: 'downloadCount',
    rating: 'rating'
  }[sortBy] || 'createdAt';
  
  sql += ` ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}`;
  
  // Add pagination
  if (query.limit) {
    sql += ' LIMIT ?';
    params.push(query.limit);
    
    if (query.offset) {
      sql += ' OFFSET ?';
      params.push(query.offset);
    }
  }
  
  const stmt = db.prepare(sql);
  const rows = stmt.all(...params) as any[];
  
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    displayName: row.displayName,
    description: row.description,
    colors: JSON.parse(row.colors),
    isPublic: Boolean(row.isPublic),
    authorId: row.authorId,
    authorName: row.authorName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    tags: JSON.parse(row.tags || '[]'),
    downloadCount: row.downloadCount,
    rating: row.rating,
    ratingCount: row.ratingCount
  }));
}

export function deleteTheme(id: string): boolean {
  const stmt = db.prepare('DELETE FROM themes WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function incrementThemeDownloadCount(id: string): boolean {
  const stmt = db.prepare('UPDATE themes SET downloadCount = downloadCount + 1 WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// HITL helper functions
export function updateEventHITLResponse(id: number, response: any): HookEvent | null {
  const status = {
    status: 'responded',
    respondedAt: response.respondedAt,
    response
  };

  const stmt = db.prepare('UPDATE events SET humanInTheLoopStatus = ? WHERE id = ?');
  stmt.run(JSON.stringify(status), id);

  const selectStmt = db.prepare(`
    SELECT id, source_app, session_id, hook_event_type, payload, chat, summary, timestamp, humanInTheLoop, humanInTheLoopStatus, model_name, input_tokens, output_tokens, cost_usd, git, session, environment, toolMetadata, sessionStats, workflow, agent_type, agent_version, parent_session_id, git_stats
    FROM events
    WHERE id = ?
  `);
  const row = selectStmt.get(id) as any;

  if (!row) return null;

  return {
    id: row.id,
    source_app: row.source_app,
    session_id: row.session_id,
    hook_event_type: row.hook_event_type,
    payload: JSON.parse(row.payload),
    chat: row.chat ? JSON.parse(row.chat) : undefined,
    summary: row.summary || undefined,
    timestamp: row.timestamp,
    humanInTheLoop: row.humanInTheLoop ? JSON.parse(row.humanInTheLoop) : undefined,
    humanInTheLoopStatus: row.humanInTheLoopStatus ? JSON.parse(row.humanInTheLoopStatus) : undefined,
    model_name: row.model_name || undefined,
    input_tokens: row.input_tokens || undefined,
    output_tokens: row.output_tokens || undefined,
    cost_usd: row.cost_usd || undefined,
    git: row.git ? JSON.parse(row.git) : undefined,
    session: row.session ? JSON.parse(row.session) : undefined,
    environment: row.environment ? JSON.parse(row.environment) : undefined,
    toolMetadata: row.toolMetadata ? JSON.parse(row.toolMetadata) : undefined,
    sessionStats: row.sessionStats ? JSON.parse(row.sessionStats) : undefined,
    workflow: row.workflow ? JSON.parse(row.workflow) : undefined,
    agent_type: row.agent_type || 'claude',
    agent_version: row.agent_version || undefined,
    parent_session_id: row.parent_session_id || undefined,
    git_stats: row.git_stats ? JSON.parse(row.git_stats) : undefined
  };
}

// Search parameters interface
export interface SearchParams {
  q?: string;           // Search query
  from?: number;        // Start timestamp (ms)
  to?: number;          // End timestamp (ms)
  agent_type?: string;  // Filter by agent
  event_type?: string;  // Filter by event type
  session_id?: string;  // Filter by session
  limit?: number;       // Max results (default 500)
}

// Full-text search function
export function searchEvents(params: SearchParams): HookEvent[] {
  let sql: string;
  const values: any[] = [];
  const conditions: string[] = [];

  // Full-text search using FTS5
  if (params.q) {
    // Use FTS5 MATCH for full-text search
    sql = `
      SELECT e.id, e.source_app, e.session_id, e.hook_event_type, e.payload, e.chat, e.summary, e.timestamp, e.humanInTheLoop, e.humanInTheLoopStatus, e.model_name, e.input_tokens, e.output_tokens, e.cost_usd, e.git, e.session, e.environment, e.toolMetadata, e.sessionStats, e.workflow, e.agent_type, e.agent_version, e.parent_session_id, e.git_stats
      FROM events e
      JOIN events_fts ON e.id = events_fts.rowid
      WHERE events_fts MATCH ?
    `;
    // FTS5 query - escape special characters and wrap in quotes for literal search
    const escapedQuery = params.q.replace(/"/g, '""');
    values.push(`"${escapedQuery}"`);
  } else {
    sql = `
      SELECT e.id, e.source_app, e.session_id, e.hook_event_type, e.payload, e.chat, e.summary, e.timestamp, e.humanInTheLoop, e.humanInTheLoopStatus, e.model_name, e.input_tokens, e.output_tokens, e.cost_usd, e.git, e.session, e.environment, e.toolMetadata, e.sessionStats, e.workflow, e.agent_type, e.agent_version, e.parent_session_id, e.git_stats
      FROM events e
      WHERE 1=1
    `;
  }

  // Time range filters
  if (params.from) {
    conditions.push('e.timestamp >= ?');
    values.push(params.from);
  }
  if (params.to) {
    conditions.push('e.timestamp <= ?');
    values.push(params.to);
  }

  // Agent type filter
  if (params.agent_type) {
    conditions.push('e.agent_type = ?');
    values.push(params.agent_type);
  }

  // Event type filter
  if (params.event_type) {
    conditions.push('e.hook_event_type = ?');
    values.push(params.event_type);
  }

  // Session filter
  if (params.session_id) {
    conditions.push('e.session_id = ?');
    values.push(params.session_id);
  }

  // Combine conditions
  if (conditions.length > 0) {
    sql += ' AND ' + conditions.join(' AND ');
  }

  // Sort by timestamp descending, limit results
  const limit = params.limit || 500;
  sql += ' ORDER BY e.timestamp DESC LIMIT ?';
  values.push(limit);

  try {
    const rows = db.prepare(sql).all(...values) as any[];

    return rows.map(row => ({
      id: row.id,
      source_app: row.source_app,
      session_id: row.session_id,
      hook_event_type: row.hook_event_type,
      payload: JSON.parse(row.payload),
      chat: row.chat ? JSON.parse(row.chat) : undefined,
      summary: row.summary || undefined,
      timestamp: row.timestamp,
      humanInTheLoop: row.humanInTheLoop ? JSON.parse(row.humanInTheLoop) : undefined,
      humanInTheLoopStatus: row.humanInTheLoopStatus ? JSON.parse(row.humanInTheLoopStatus) : undefined,
      model_name: row.model_name || undefined,
      input_tokens: row.input_tokens || undefined,
      output_tokens: row.output_tokens || undefined,
      cost_usd: row.cost_usd || undefined,
      git: row.git ? JSON.parse(row.git) : undefined,
      session: row.session ? JSON.parse(row.session) : undefined,
      environment: row.environment ? JSON.parse(row.environment) : undefined,
      toolMetadata: row.toolMetadata ? JSON.parse(row.toolMetadata) : undefined,
      sessionStats: row.sessionStats ? JSON.parse(row.sessionStats) : undefined,
      workflow: row.workflow ? JSON.parse(row.workflow) : undefined,
      agent_type: row.agent_type || 'claude',
      agent_version: row.agent_version || undefined,
      parent_session_id: row.parent_session_id || undefined,
      git_stats: row.git_stats ? JSON.parse(row.git_stats) : undefined
    }));
  } catch (error) {
    console.error('Search error:', error);
    // Fallback to simple LIKE search if FTS5 fails
    return searchEventsSimple(params);
  }
}

// Fallback simple search using LIKE
function searchEventsSimple(params: SearchParams): HookEvent[] {
  let sql = `
    SELECT id, source_app, session_id, hook_event_type, payload, chat, summary, timestamp, humanInTheLoop, humanInTheLoopStatus, model_name, input_tokens, output_tokens, cost_usd, git, session, environment, toolMetadata, sessionStats, workflow, agent_type, agent_version, parent_session_id, git_stats
    FROM events
    WHERE 1=1
  `;
  const values: any[] = [];

  if (params.q) {
    sql += ' AND (payload LIKE ? OR summary LIKE ? OR chat LIKE ?)';
    const searchTerm = `%${params.q}%`;
    values.push(searchTerm, searchTerm, searchTerm);
  }

  if (params.from) {
    sql += ' AND timestamp >= ?';
    values.push(params.from);
  }
  if (params.to) {
    sql += ' AND timestamp <= ?';
    values.push(params.to);
  }
  if (params.agent_type) {
    sql += ' AND agent_type = ?';
    values.push(params.agent_type);
  }
  if (params.event_type) {
    sql += ' AND hook_event_type = ?';
    values.push(params.event_type);
  }
  if (params.session_id) {
    sql += ' AND session_id = ?';
    values.push(params.session_id);
  }

  const limit = params.limit || 500;
  sql += ' ORDER BY timestamp DESC LIMIT ?';
  values.push(limit);

  const rows = db.prepare(sql).all(...values) as any[];

  return rows.map(row => ({
    id: row.id,
    source_app: row.source_app,
    session_id: row.session_id,
    hook_event_type: row.hook_event_type,
    payload: JSON.parse(row.payload),
    chat: row.chat ? JSON.parse(row.chat) : undefined,
    summary: row.summary || undefined,
    timestamp: row.timestamp,
    humanInTheLoop: row.humanInTheLoop ? JSON.parse(row.humanInTheLoop) : undefined,
    humanInTheLoopStatus: row.humanInTheLoopStatus ? JSON.parse(row.humanInTheLoopStatus) : undefined,
    model_name: row.model_name || undefined,
    input_tokens: row.input_tokens || undefined,
    output_tokens: row.output_tokens || undefined,
    cost_usd: row.cost_usd || undefined,
    git: row.git ? JSON.parse(row.git) : undefined,
    session: row.session ? JSON.parse(row.session) : undefined,
    environment: row.environment ? JSON.parse(row.environment) : undefined,
    toolMetadata: row.toolMetadata ? JSON.parse(row.toolMetadata) : undefined,
    sessionStats: row.sessionStats ? JSON.parse(row.sessionStats) : undefined,
    workflow: row.workflow ? JSON.parse(row.workflow) : undefined,
    agent_type: row.agent_type || 'claude',
    agent_version: row.agent_version || undefined,
    parent_session_id: row.parent_session_id || undefined,
    git_stats: row.git_stats ? JSON.parse(row.git_stats) : undefined
  }));
}

// Get all events for a specific session (for replay)
export function getSessionEvents(sessionId: string): HookEvent[] {
  const sql = `
    SELECT id, source_app, session_id, hook_event_type, payload, chat, summary, timestamp, humanInTheLoop, humanInTheLoopStatus, model_name, input_tokens, output_tokens, cost_usd, git, session, environment, toolMetadata, sessionStats, workflow, agent_type, agent_version, parent_session_id, git_stats
    FROM events
    WHERE session_id = ?
    ORDER BY timestamp ASC
  `;

  const rows = db.prepare(sql).all(sessionId) as any[];

  return rows.map(row => ({
    id: row.id,
    source_app: row.source_app,
    session_id: row.session_id,
    hook_event_type: row.hook_event_type,
    payload: JSON.parse(row.payload),
    chat: row.chat ? JSON.parse(row.chat) : undefined,
    summary: row.summary || undefined,
    timestamp: row.timestamp,
    humanInTheLoop: row.humanInTheLoop ? JSON.parse(row.humanInTheLoop) : undefined,
    humanInTheLoopStatus: row.humanInTheLoopStatus ? JSON.parse(row.humanInTheLoopStatus) : undefined,
    model_name: row.model_name || undefined,
    input_tokens: row.input_tokens || undefined,
    output_tokens: row.output_tokens || undefined,
    cost_usd: row.cost_usd || undefined,
    git: row.git ? JSON.parse(row.git) : undefined,
    session: row.session ? JSON.parse(row.session) : undefined,
    environment: row.environment ? JSON.parse(row.environment) : undefined,
    toolMetadata: row.toolMetadata ? JSON.parse(row.toolMetadata) : undefined,
    sessionStats: row.sessionStats ? JSON.parse(row.sessionStats) : undefined,
    workflow: row.workflow ? JSON.parse(row.workflow) : undefined,
    agent_type: row.agent_type || 'claude',
    agent_version: row.agent_version || undefined,
    parent_session_id: row.parent_session_id || undefined,
    git_stats: row.git_stats ? JSON.parse(row.git_stats) : undefined
  }));
}

// Session Summary Functions for Historical Analysis

import type { SessionSummary, SessionListParams, CriticalEventSummary, SessionStatus } from './types';

// Helper to detect critical events
function isCriticalEvent(event: HookEvent): { is_critical: boolean; type?: string } {
  // Error events
  if (event.hook_event_type === 'Error' || event.hook_event_type.includes('Error')) {
    return { is_critical: true, type: 'error' };
  }

  // HITL events
  if (event.humanInTheLoop) {
    return { is_critical: true, type: 'hitl' };
  }

  // High cost events (>$0.10 per event)
  if (event.cost_usd && event.cost_usd > 0.10) {
    return { is_critical: true, type: 'high_cost' };
  }

  // Long tool calls (we'll infer from timing between events in the future)
  // For now, we don't have duration data per event, so skip this

  return { is_critical: false };
}

// Extract repo/project metadata from environment
function extractMetadata(event: HookEvent): {
  repo_name?: string;
  project_name?: string;
  branch_name?: string;
  commit_hash?: string;
} {
  const env = (event as any).environment;
  const git = (event as any).git;

  if (!env) return {};

  return {
    repo_name: env.repo_name || env.repository,
    project_name: env.project_name || env.working_directory?.split('/').pop(),
    branch_name: git?.branch || env.branch,
    commit_hash: git?.commit || git?.commit_hash
  };
}

// Update or create session summary when an event is inserted
export function upsertSessionSummary(event: HookEvent): void {
  const metadata = extractMetadata(event);
  const critical = isCriticalEvent(event);
  const timestamp = event.timestamp || Date.now();

  // Check if session summary exists
  const existingStmt = db.prepare('SELECT * FROM session_summaries WHERE session_id = ?');
  const existing = existingStmt.get(event.session_id) as any;

  if (existing) {
    // Update existing summary
    const criticalSummary: CriticalEventSummary[] = existing.critical_events_summary
      ? JSON.parse(existing.critical_events_summary)
      : [];

    // Update critical events summary if this is a critical event
    if (critical.is_critical && critical.type) {
      const existingCritical = criticalSummary.find(c => c.type === critical.type);
      if (existingCritical) {
        existingCritical.count++;
      } else {
        criticalSummary.push({
          type: critical.type as any,
          count: 1,
          first_at: timestamp
        });
      }
    }

    // Determine status
    let status: SessionStatus = existing.status;
    if (event.hook_event_type === 'SessionEnd') {
      status = existing.has_errors || (critical.is_critical && critical.type === 'error') ? 'error' : 'success';
    } else if (critical.is_critical && critical.type === 'error') {
      status = 'partial'; // Has errors but not ended yet
    }

    const updateStmt = db.prepare(`
      UPDATE session_summaries SET
        end_time = COALESCE(?, end_time),
        duration_ms = COALESCE(? - start_time, duration_ms),
        status = ?,
        has_errors = ?,
        has_hitl = ?,
        event_count = event_count + 1,
        critical_event_count = ?,
        total_cost_usd = total_cost_usd + ?,
        model_name = COALESCE(?, model_name),
        critical_events_summary = ?,
        last_updated = ?
      WHERE session_id = ?
    `);

    updateStmt.run(
      event.hook_event_type === 'SessionEnd' ? timestamp : null,
      event.hook_event_type === 'SessionEnd' ? timestamp : null,
      status,
      existing.has_errors || (critical.is_critical && critical.type === 'error') ? 1 : 0,
      existing.has_hitl || (critical.is_critical && critical.type === 'hitl') ? 1 : 0,
      existing.critical_event_count + (critical.is_critical ? 1 : 0),
      event.cost_usd || 0,
      event.model_name,
      JSON.stringify(criticalSummary),
      timestamp,
      event.session_id
    );
  } else {
    // Create new summary
    const criticalSummary: CriticalEventSummary[] = [];
    if (critical.is_critical && critical.type) {
      criticalSummary.push({
        type: critical.type as any,
        count: 1,
        first_at: timestamp
      });
    }

    const insertStmt = db.prepare(`
      INSERT INTO session_summaries (
        session_id, source_app, agent_type, repo_name, project_name,
        script_name, branch_name, commit_hash, start_time, end_time,
        duration_ms, status, has_errors, has_hitl, event_count,
        critical_event_count, total_cost_usd, model_name, critical_events_summary, last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(
      event.session_id,
      event.source_app,
      event.agent_type || 'claude',
      metadata.repo_name || null,
      metadata.project_name || null,
      null, // script_name - will add in future
      metadata.branch_name || null,
      metadata.commit_hash || null,
      timestamp,
      event.hook_event_type === 'SessionEnd' ? timestamp : null,
      event.hook_event_type === 'SessionEnd' ? 0 : null,
      'ongoing',
      critical.is_critical && critical.type === 'error' ? 1 : 0,
      critical.is_critical && critical.type === 'hitl' ? 1 : 0,
      1,
      critical.is_critical ? 1 : 0,
      event.cost_usd || 0,
      event.model_name || null,
      JSON.stringify(criticalSummary),
      timestamp
    );
  }
}

// Get list of sessions with filters
export function getSessionsList(params: SessionListParams = {}): SessionSummary[] {
  const {
    start_time,
    end_time,
    source_app,
    repo_name,
    status,
    has_critical_events,
    limit = 100,
    offset = 0,
    sort_by = 'recency'
  } = params;

  let sql = 'SELECT * FROM session_summaries WHERE 1=1';
  const sqlParams: any[] = [];

  if (start_time) {
    sql += ' AND start_time >= ?';
    sqlParams.push(start_time);
  }

  if (end_time) {
    sql += ' AND start_time <= ?';
    sqlParams.push(end_time);
  }

  if (source_app) {
    sql += ' AND source_app = ?';
    sqlParams.push(source_app);
  }

  if (repo_name) {
    sql += ' AND repo_name = ?';
    sqlParams.push(repo_name);
  }

  if (status) {
    sql += ' AND status = ?';
    sqlParams.push(status);
  }

  if (has_critical_events !== undefined) {
    if (has_critical_events) {
      sql += ' AND critical_event_count > 0';
    } else {
      sql += ' AND critical_event_count = 0';
    }
  }

  // Add sorting
  switch (sort_by) {
    case 'recency':
      sql += ' ORDER BY start_time DESC';
      break;
    case 'severity':
      sql += ' ORDER BY critical_event_count DESC, has_errors DESC';
      break;
    case 'duration':
      sql += ' ORDER BY duration_ms DESC NULLS LAST';
      break;
    case 'cost':
      sql += ' ORDER BY total_cost_usd DESC';
      break;
  }

  sql += ' LIMIT ? OFFSET ?';
  sqlParams.push(limit, offset);

  const rows = db.prepare(sql).all(...sqlParams) as any[];

  return rows.map(row => ({
    session_id: row.session_id,
    source_app: row.source_app,
    agent_type: row.agent_type,
    repo_name: row.repo_name || undefined,
    project_name: row.project_name || undefined,
    script_name: row.script_name || undefined,
    branch_name: row.branch_name || undefined,
    commit_hash: row.commit_hash || undefined,
    start_time: row.start_time,
    end_time: row.end_time || undefined,
    duration_ms: row.duration_ms || undefined,
    status: row.status as SessionStatus,
    has_errors: Boolean(row.has_errors),
    has_hitl: Boolean(row.has_hitl),
    event_count: row.event_count,
    critical_event_count: row.critical_event_count,
    total_cost_usd: row.total_cost_usd,
    model_name: row.model_name || undefined,
    critical_events_summary: row.critical_events_summary ? JSON.parse(row.critical_events_summary) : []
  }));
}

// Get unique filter options for sessions
export function getSessionsFilterOptions(): {
  repos: string[];
  source_apps: string[];
  statuses: SessionStatus[];
} {
  const repos = db.prepare('SELECT DISTINCT repo_name FROM session_summaries WHERE repo_name IS NOT NULL ORDER BY repo_name').all() as any[];
  const sourceApps = db.prepare('SELECT DISTINCT source_app FROM session_summaries ORDER BY source_app').all() as any[];
  const statuses = db.prepare('SELECT DISTINCT status FROM session_summaries ORDER BY status').all() as any[];

  return {
    repos: repos.map(r => r.repo_name),
    source_apps: sourceApps.map(s => s.source_app),
    statuses: statuses.map(s => s.status)
  };
}

export { db };