#!/usr/bin/env node
/**
 * index.ts
 *
 * Godspeed Migration CLI wrapper.
 * Executes the jscodeshift codemod automatically over specified directories.
 */
import { Command } from 'commander';
import { run } from 'jscodeshift/src/Runner.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name('godspeed')
  .description('Godspeed Ecosystem CLI')
  .version('1.0.2');

program
  .command('migrate')
  .description('Automated AST Migration Engine for migrating Axios codebases to GodspeedClient.')
  .argument('<path...>', 'File paths or directories to migrate')
  .option('-d, --dry', 'Dry run (no changes are made to files)')
  .option('-p, --print', 'Print transformed files to stdout')
  .action(async (paths, options) => {
    console.log('⚡ Initializing Godspeed AST Migration Engine...');
    
    // In built version, transform.js is in the same dist folder
    const transformPath = path.resolve(__dirname, './transform.js');

    try {
      const reportPath = path.resolve(process.cwd(), 'godspeed-migration-report.md');
      fs.writeFileSync(reportPath, "# Godspeed Migration Report\n\nAutomated AST migration results:\n\nSummary of files explicitly requiring manual review due to behavioral differences in Godspeed's Compat Layer:\n\n");

      const res = await run(transformPath, paths, {
        dry: options.dry,
        print: options.print,
        verbose: 1,
        runInBand: true,
        parser: 'tsx',
        extensions: 'ts,tsx,js,jsx',
        ignorePattern: '**/node_modules/**'
      });
      console.log(`✅ Godspeed Engine Migration Complete.`);
      console.log(`📄 Check godspeed-migration-report.md for manual review items.`);
    } catch (err) {
      console.error('❌ Godspeed Engine Migration Failed:', err);
      process.exit(1);
    }
  });

program.parse(process.argv);
