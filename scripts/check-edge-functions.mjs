#!/usr/bin/env node
/**
 * Predeploy checklist for Supabase Edge Functions.
 *
 * For each supabase/functions/<name>/index.ts we run TWO passes:
 *   1. PARSE  — `deno check --no-lock --no-check` (syntax only)
 *               If this fails, Supabase bundling will ALWAYS fail. Fix first.
 *   2. TYPES  — `deno check --no-lock` (full type-check)
 *               If this fails the function may still bundle, but is unsafe.
 *
 * The script:
 *   - Prints a colored checklist to stdout
 *   - Writes a machine-readable JSON report to predeploy-report.json
 *   - Exits 1 if ANY parse error (deploy will fail)
 *   - Exits 2 if only type errors  (deploy may succeed but is risky)
 *   - Exits 0 if everything passes
 *
 * Usage:
 *   node scripts/check-edge-functions.mjs               # check all
 *   node scripts/check-edge-functions.mjs public-api    # check subset
 *   node scripts/check-edge-functions.mjs --json        # JSON only, no log
 */
import { readdirSync, statSync, existsSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve, relative } from "node:path";

const ROOT = resolve(process.cwd(), "supabase/functions");
const REPORT_PATH = resolve(process.cwd(), "predeploy-report.json");
const SHARED_PREFIX = "_";

const args = process.argv.slice(2);
const jsonOnly = args.includes("--json");
const onlyArgs = args.filter(a => !a.startsWith("-"));

// ── ANSI helpers (skip when not a TTY or JSON mode) ────────────────────────
const useColor = !jsonOnly && process.stdout.isTTY;
const c = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = s => c("31", s);
const yellow = s => c("33", s);
const green = s => c("32", s);
const dim = s => c("2", s);
const bold = s => c("1", s);

if (!existsSync(ROOT)) {
  console.error(red(`✗ ${ROOT} not found — run from repo root.`));
  process.exit(1);
}

const fnDirs = readdirSync(ROOT)
  .filter(name => !name.startsWith(SHARED_PREFIX))
  .filter(name => statSync(join(ROOT, name)).isDirectory())
  .filter(name => existsSync(join(ROOT, name, "index.ts")))
  .filter(name => onlyArgs.length === 0 || onlyArgs.includes(name))
  .sort();

if (fnDirs.length === 0) {
  console.log("No edge functions found to check.");
  writeFileSync(REPORT_PATH, JSON.stringify({ generated_at: new Date().toISOString(), checks: [] }, null, 2));
  process.exit(0);
}

if (!jsonOnly) {
  console.log(bold(`▸ Predeploy checklist — ${fnDirs.length} edge function(s)\n`));
  console.log(dim("  Pass 1: parse (must succeed for bundling)"));
  console.log(dim("  Pass 2: type-check (recommended for safe deploy)\n"));
}

// Extract `file:line:col` from deno's stderr.
function extractLocation(output) {
  const m = output.match(/at\s+(file:\/\/[^\s)]+):(\d+):(\d+)/)
        ?? output.match(/(supabase\/functions\/[^\s:)]+):(\d+):(\d+)/)
        ?? output.match(/([\w./-]+\.ts):(\d+):(\d+)/);
  if (!m) return null;
  return {
    file: m[1].replace(/^file:\/\//, ""),
    line: Number(m[2]),
    column: Number(m[3]),
  };
}

function runDeno(args) {
  const r = spawnSync("deno", args, { encoding: "utf8" });
  if (r.error) return { missing: true };
  return {
    code: r.status ?? 1,
    output: ((r.stderr || "") + (r.stdout || "")).trim(),
  };
}

const checks = [];
let denoMissing = false;

for (let i = 0; i < fnDirs.length; i++) {
  const name = fnDirs[i];
  const entry = join(ROOT, name, "index.ts");
  const rel = relative(process.cwd(), entry);

  if (!jsonOnly) process.stdout.write(`  [${i + 1}/${fnDirs.length}] ${name.padEnd(36)} `);

  const parse = runDeno(["check", "--no-lock", "--no-check", "--allow-import", entry]);
  if (parse.missing) {
    denoMissing = true;
    if (!jsonOnly) console.log(yellow("SKIP (deno not installed)"));
    checks.push({ name, entry: rel, parse: "skipped", types: "skipped" });
    continue;
  }

  if (parse.code !== 0) {
    const loc = extractLocation(parse.output);
    checks.push({
      name, entry: rel,
      parse: "fail", parse_location: loc, parse_error: parse.output,
      types: "blocked",
    });
    if (!jsonOnly) {
      console.log(red("PARSE ✗"));
      if (loc) console.log(red(`        └─ ${loc.file}:${loc.line}:${loc.column}`));
    }
    continue;
  }

  const types = runDeno(["check", "--no-lock", "--allow-import", entry]);
  if (types.code !== 0) {
    const loc = extractLocation(types.output);
    checks.push({
      name, entry: rel,
      parse: "ok",
      types: "fail", types_location: loc, types_error: types.output,
    });
    if (!jsonOnly) {
      console.log(yellow("TYPES ✗"));
      if (loc) console.log(yellow(`        └─ ${loc.file}:${loc.line}:${loc.column}`));
    }
    continue;
  }

  checks.push({ name, entry: rel, parse: "ok", types: "ok" });
  if (!jsonOnly) console.log(green("ok"));
}

const parseFails = checks.filter(c => c.parse === "fail");
const typeFails = checks.filter(c => c.types === "fail");
const passed = checks.filter(c => c.parse === "ok" && c.types === "ok");

const report = {
  generated_at: new Date().toISOString(),
  totals: {
    total: checks.length,
    passed: passed.length,
    parse_failures: parseFails.length,
    type_failures: typeFails.length,
    skipped: checks.filter(c => c.parse === "skipped").length,
  },
  checks,
};
writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

if (jsonOnly) {
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  process.exit(parseFails.length ? 1 : typeFails.length ? 2 : 0);
}

console.log("\n" + bold("─── Summary ────────────────────────────────────────"));
console.log(`  ${green(`✓ ${passed.length} passing`)}`);
if (parseFails.length) console.log(`  ${red(`✗ ${parseFails.length} parse failure(s) — block bundling, fix FIRST`)}`);
if (typeFails.length)  console.log(`  ${yellow(`⚠ ${typeFails.length} type failure(s) — bundling may succeed, fix BEFORE prod`)}`);
if (denoMissing)       console.log(`  ${dim("· deno not installed — install via https://deno.land or denoland/setup-deno@v1")}`);
console.log(dim(`\n  Report written to: ${relative(process.cwd(), REPORT_PATH)}`));

if (parseFails.length) {
  console.log("\n" + bold(red("Fix these PARSE errors first (blocking bundling):")));
  for (const f of parseFails) {
    console.log(red(`\n  ▸ ${f.name}`));
    if (f.parse_location) console.log(red(`    ${f.parse_location.file}:${f.parse_location.line}:${f.parse_location.column}`));
    console.log(dim(f.parse_error.split("\n").slice(0, 6).map(l => "      " + l).join("\n")));
  }
  process.exit(1);
}
if (typeFails.length) {
  console.log("\n" + bold(yellow("Then fix these TYPE errors (bundle may pass but is unsafe):")));
  for (const f of typeFails) {
    console.log(yellow(`\n  ▸ ${f.name}`));
    if (f.types_location) console.log(yellow(`    ${f.types_location.file}:${f.types_location.line}:${f.types_location.column}`));
    console.log(dim(f.types_error.split("\n").slice(0, 6).map(l => "      " + l).join("\n")));
  }
  process.exit(2);
}
console.log("\n" + green("✓ Safe to deploy."));
process.exit(0);
