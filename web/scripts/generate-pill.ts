/**
 * One-off command: generates web/pills/ts-cc/v1.0.yaml from pill-source.ts.
 * Run: npx tsx scripts/generate-pill.ts
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { buildPillYaml } from "./pill-source";

const yamlStr = buildPillYaml();
const outDir = join(process.cwd(), "pills", "ts-cc");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "v1.0.yaml");
writeFileSync(outPath, yamlStr, "utf-8");
console.log(`Wrote ${outPath} (${yamlStr.length} bytes)`);
