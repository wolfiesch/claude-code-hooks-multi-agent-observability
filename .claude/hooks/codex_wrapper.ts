#!/usr/bin/env bun

/**
 * Codex CLI Wrapper with Observability
 *
 * Wraps Codex CLI commands to emit tracking events to the observability dashboard.
 * This wrapper intercepts Codex CLI invocations and sends:
 * - TaskStart: Before Codex executes
 * - TaskComplete: After successful execution
 * - TaskError: On non-zero exit code
 *
 * Usage:
 *   codex-tracked exec -m gpt-5.1-codex-max "your task"
 *   (Just replace 'codex' with 'codex-tracked')
 */

import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as os from 'os';

// Configuration
const SEND_EVENT_SCRIPT = path.join(__dirname, 'send_event.py');
const SERVER_URL = process.env.CODEX_OBSERVABILITY_SERVER || 'http://localhost:4000/events';
const CODEX_VERSION = '0.64.0'; // Could be dynamically retrieved

interface EventPayload {
  command: string[];
  model?: string;
  working_dir: string;
  start_time?: string;
  end_time?: string;
  exit_code?: number;
  duration_ms?: number;
  error_message?: string;
}

/**
 * Send event to observability server via send_event.py
 */
async function sendEvent(
  sessionId: string,
  eventType: string,
  payload: EventPayload
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      SEND_EVENT_SCRIPT,
      '--source-app', 'codex-cli',
      '--event-type', eventType,
      '--server-url', SERVER_URL,
      '--agent-type', 'codex',
      '--agent-version', CODEX_VERSION
    ];

    const eventData = {
      session_id: sessionId,
      ...payload
    };

    const proc = spawn('python3', args, {
      stdio: ['pipe', 'inherit', 'inherit']
    });

    proc.stdin.write(JSON.stringify(eventData));
    proc.stdin.end();

    proc.on('close', (code) => {
      // Don't fail the main process if event sending fails
      if (code !== 0) {
        console.error(`[codex-tracked] Warning: Failed to send ${eventType} event`);
      }
      resolve();
    });

    proc.on('error', (err) => {
      console.error(`[codex-tracked] Warning: Error sending event:`, err.message);
      resolve(); // Continue anyway
    });
  });
}

/**
 * Extract model from command arguments
 */
function extractModel(args: string[]): string | undefined {
  const modelIndex = args.findIndex(arg => arg === '-m' || arg === '--model');
  if (modelIndex !== -1 && modelIndex + 1 < args.length) {
    return args[modelIndex + 1];
  }
  return undefined;
}

/**
 * Main wrapper function
 */
async function main() {
  // Generate unique session ID for this Codex invocation
  const sessionId = randomUUID();

  // Get original Codex command arguments
  const codexArgs = process.argv.slice(2);
  const fullCommand = ['codex', ...codexArgs];
  const model = extractModel(codexArgs);
  const workingDir = process.cwd();

  console.log(`[codex-tracked] Session ID: ${sessionId}`);
  console.log(`[codex-tracked] Command: ${fullCommand.join(' ')}`);

  // Emit TaskStart event
  const startTime = new Date().toISOString();
  const startPayload: EventPayload = {
    command: fullCommand,
    model,
    working_dir: workingDir,
    start_time: startTime
  };

  await sendEvent(sessionId, 'TaskStart', startPayload);

  // Execute actual Codex command
  const startTimestamp = Date.now();

  const codexProc = spawn('codex', codexArgs, {
    stdio: 'inherit', // Pass through stdin/stdout/stderr
    env: process.env
  });

  // Wait for Codex to complete
  const exitCode = await new Promise<number>((resolve) => {
    codexProc.on('close', (code) => {
      resolve(code || 0);
    });

    codexProc.on('error', (err) => {
      console.error(`[codex-tracked] Error executing Codex:`, err);
      resolve(1);
    });
  });

  // Calculate duration
  const endTimestamp = Date.now();
  const durationMs = endTimestamp - startTimestamp;
  const endTime = new Date().toISOString();

  // Emit TaskComplete or TaskError based on exit code
  if (exitCode === 0) {
    const completePayload: EventPayload = {
      command: fullCommand,
      model,
      working_dir: workingDir,
      start_time: startTime,
      end_time: endTime,
      exit_code: exitCode,
      duration_ms: durationMs
    };

    await sendEvent(sessionId, 'TaskComplete', completePayload);
    console.log(`[codex-tracked] Task completed successfully (${durationMs}ms)`);
  } else {
    const errorPayload: EventPayload = {
      command: fullCommand,
      model,
      working_dir: workingDir,
      start_time: startTime,
      end_time: endTime,
      exit_code: exitCode,
      duration_ms: durationMs,
      error_message: `Codex exited with code ${exitCode}`
    };

    await sendEvent(sessionId, 'TaskError', errorPayload);
    console.error(`[codex-tracked] Task failed with exit code ${exitCode}`);
  }

  // Exit with same code as Codex to preserve behavior
  process.exit(exitCode);
}

// Run the wrapper
main().catch((err) => {
  console.error('[codex-tracked] Fatal error:', err);
  process.exit(1);
});
