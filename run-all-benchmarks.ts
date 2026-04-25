#!/usr/bin/env bun

/**
 * run-all-benchmarks.ts
 *
 * Master benchmark runner for all Godspeed plugins.
 *
 * Executes benchmarks for WebSocket and SSE plugins sequentially
 * and displays a summary of results.
 */

import { spawn } from 'bun';

async function runCommand(command: string, cwd: string): Promise<void> {
  const proc = spawn(command.split(' '), {
    cwd,
    stdout: 'inherit',
    stderr: 'inherit',
  });

  await proc.exited;
}

async function main() {
  console.log('\n🚀 Running Godspeed Plugin Benchmarks\n');
  console.log('This will measure the performance overhead of each plugin');
  console.log('when handling non-matching requests (zero-cost abstraction test).\n');

  const baseDir = import.meta.dir;

  console.log('━'.repeat(50));
  console.log('1/2: WebSocket Plugin');
  console.log('━'.repeat(50));
  await runCommand(
    'bun tests/websocket.bench.ts',
    `${baseDir}/packages/godspeed-websocket`
  );

  console.log('\n' + '━'.repeat(50));
  console.log('2/2: SSE Plugin');
  console.log('━'.repeat(50));
  await runCommand(
    'bun tests/sse.bench.ts',
    `${baseDir}/packages/godspeed-sse`
  );

  console.log('\n' + '═'.repeat(50));
  console.log('✅ All benchmarks complete!');
  console.log('═'.repeat(50));
  console.log('\nBoth plugins should show <1% overhead for non-matching requests.');
  console.log('This validates the zero-cost abstraction principle.\n');
}

main().catch(console.error);
