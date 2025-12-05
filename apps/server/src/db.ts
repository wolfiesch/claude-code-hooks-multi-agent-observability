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

  return {
    ...event,
    id: result.lastInsertRowid as number,
    timestamp,
    humanInTheLoopStatus
  };
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

export { db };