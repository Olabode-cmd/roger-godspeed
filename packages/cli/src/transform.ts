/**
 * transform.ts
 *
 * jscodeshift codemod to migrate Axios -> roger-godspeed/GodspeedClient.
 * 
 * Safely manipulates the AST to:
 * 1. Swap 'axios' imports to 'roger-godspeed' natively.
 * 2. Replace 'axios.create(...)' invocations with 'new GodspeedClient(...)'.
 * 
 * This fulfills Phase 9 dictates for automated enterprise refactoring.
 */
import type { FileInfo, API, Options } from 'jscodeshift';
import fs from 'fs';
import path from 'path';

export default function transformer(fileInfo: FileInfo, api: API, options: Options) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  let isDirty = false;

  root.find(j.ImportDeclaration, { source: { value: 'axios' } }).forEach((path) => {
    isDirty = true;
    path.node.source.value = 'roger-godspeed';

    // Map `import axios from 'axios'` -> `import { GodspeedClient as axios } from 'roger-godspeed'`
    // to preserve variable scope on `axios.get()` downstream, but transforming `axios.create()` explicitly natively.
    const defaultSpecifier = path.node.specifiers?.find(s => s.type === 'ImportDefaultSpecifier');
    
    if (defaultSpecifier) {
      const localAxiosName = defaultSpecifier.local?.name || 'axios';
      
      path.node.specifiers = [
        j.importSpecifier(
          j.identifier('GodspeedClient'),
          j.identifier(localAxiosName) // Alias to avoid breaking local scope `axios.get` calls immediately if they expect it
        )
      ];

      // Safely transform `axios.create({ ... })` into `new GodspeedClient({ ... })`
      root.find(j.CallExpression, {
        callee: {
          type: 'MemberExpression',
          object: { name: localAxiosName },
          property: { name: 'create' }
        }
      }).replaceWith(callPath => {
        return j.newExpression(
          j.identifier(localAxiosName), 
          callPath.node.arguments
        );
      });

      // Flag interceptors for manual review
      root.find(j.MemberExpression, {
        property: { name: 'interceptors' }
      }).forEach(astPath => {
        // We only care if the object is our local axios instance (e.g. `axios.interceptors`)
        if (astPath.node.object.type === 'Identifier' && astPath.node.object.name === localAxiosName) {
          const reportPath = path.resolve(process.cwd(), 'godspeed-migration-report.md');
          const line = astPath.node.loc?.start.line ?? 'unknown';
          const msg = `- ⚠️ **Interceptor Pattern Flagged:** \`${fileInfo.path}\` (line ${line}). Review error throwing and promise chaining against the Compat Layer differences.\n`;
          try {
            fs.appendFileSync(reportPath, msg);
          } catch (e) {
            // best effort logging
          }
        }
      });
    }
  });

  return isDirty ? root.toSource({ quote: 'single' }) : fileInfo.source;
}
