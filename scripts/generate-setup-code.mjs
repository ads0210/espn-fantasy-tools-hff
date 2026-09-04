#!/usr/bin/env node
/**
 * Build-time setup-code generator.
 *
 * Generates a one-time code used to unlock the very first configuration of a
 * fresh deployment, prints it in plain text to the build log — visible only to
 * the account owner under Deployments -> build output — and writes only its
 * SHA-256 hash into the bundle. The plaintext never reaches a browser and is
 * never stored anywhere the running Worker can read it.
 */
import { createHash, randomInt } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Ambiguous characters removed so the code can be read off a screen reliably.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateSetupCode() {
  const groups = [];
  for (let g = 0; g < 3; g++) {
    let out = '';
    for (let i = 0; i < 4; i++) out += ALPHABET[randomInt(ALPHABET.length)];
    groups.push(out);
  }
  const code = groups.join('-');
  const hash = createHash('sha256').update(code, 'utf8').digest('base64url');
  const target = 'src/generated/setup-code.js';

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(
    target,
    '// GENERATED AT BUILD TIME - do not edit, do not commit a real value.\n' +
      `export const SETUP_CODE_HASH = ${JSON.stringify(hash)};\n` +
      `export const SETUP_CODE_GENERATED_AT = ${JSON.stringify(new Date().toISOString())};\n`
  );

  const line = '='.repeat(58);
  console.log(`\n${line}`);
  console.log('  ESPN FANTASY TOOLS - FIRST-TIME SETUP CODE');
  console.log(line);
  console.log(`\n      ${code}\n`);
  console.log('  Enter this on the site to begin configuration.');
  console.log('  It is shown only here, only to you, and stops working');
  console.log('  once setup completes.');
  console.log(`${line}\n`);
  return code;
}

if (import.meta.url === `file://${process.argv[1]}`) generateSetupCode();
