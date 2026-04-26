#!/usr/bin/env node
/**
 * Predeploy check for Supabase Edge Functions.
 *
 * Walks supabase/functions/<name>/index.ts and runs Deno's `check` command
 * (parse + type-check) against each one. Reports the EXACT file:line:col of
 * the first failure per function so bundling errors surface in CI before
 * `supabase functions deploy` runs.
 *
 * Exit code: 0 = all clean; 1 = at least one function failed.
 *
 * Requires `deno` on PATH. Locally: `brew install deno` or see deno.land.
 * In CI: use `denoland/setup-deno@v1` before invoking this script.
 */
import { readdirSync, statSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd(), "supabase/functions");
const SHARED_PREFIX = "_";

if (!existsSync(ROOT)) {
  console.error(`✗ ${ROOT} not found — run from repo root.`);
  process.exit(1);
}

// Optional: only check a subset passed on CLI (e.g. `node script.mjs public-api mcp-server`)
const onlyArgs = process.argv.slice(2).filter(a => !a.startsWith("-"));

const fnDirs = readdirSync(ROOT)
  .filter(name => !name.startsWith(SHARED_PREFIX))
  .filter(name => statSync(join(ROOT, name)).isDirectory())
  .filter(name => existsSync(join(ROOT, name, "index.ts")))
  .filter(name => onlyArgs.length === 0 || onlyArgs.includes(name))
  .sort();

if (fnDirs.length === 0) {
  console.log("No edge functions found to check.");
  process.exit(0);
}

console.log(`▸ Checking ${fnDirs.length} edge function(s) with deno check…\n`);

const failures = [];
let i = 0;
for (const name of fnDirs) {
  i++;
  const entry = join(ROOT, name, "index.ts");
  process.stdout.write(`  [${i}/${fnDirs.length}] ${name} … `);

  // `deno check` does parse + type-check without executing or bundling.
  // --no-lock avoids requiring a deno.lock file at repo root.
  const result = spawnSync(
    "deno",
    ["check", "--no-lock", "--allow-import", entry],
    { encoding: "utf8" },
  );

  if (result.error) {
    console.log("SKIP (deno not installed)");
    console.error(`\n✗ deno binary not found: ${result.error.message}`);
    console.error("  Install via https://deno.land or use denoland/setup-deno@v1 in CI.");
    process.exit(2);
  }

  if (result.status === 0) {
    console.log("ok");
    continue;
  }

  console.log("FAIL");
  const stderr = (result.stderr || "") + (result.stdout || "");
  failures.push({ name, entry, output: stderr.trim() });
}

if (failures.length === 0) {
  console.log(`\n✓ All ${fnDirs.length} edge function(s) parse and type-check cleanly.`);
  process.exit(0);
}

console.error(`\n✗ ${failures.length} edge function(s) failed predeploy check:\n`);
for (const f of failures) {
  console.error(`─── ${f.name} ───────────────────────────────────────────`);
  // Highlight the first file:line:col occurrence so it's easy to spot in CI logs.
  const firstLoc = f.output.match(/at\s+(file:\/\/[^\s)]+):(\d+):(\d+)/)
                 ?? f.output.match(/(supabase\/functions\/[^\s:)]+):(\d+):(\d+)/);
  if (firstLoc) {
    console.error(`  ► First failure: ${firstLoc[1].replace(/^file:\/\//, "")}:${firstLoc[2]}:${firstLoc[3]}`);
  } else {
    console.error(`  ► Entry: ${f.entry}`);
  }
  // Indent the deno output for readability.
  console.error(f.output.split("\n").map(l => "    " + l).join("\n"));
  console.error("");
}
console.error(`Fix the above before running \`supabase functions deploy\`.`);
process.exit(1);
