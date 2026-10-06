import { NextResponse } from "next/server";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

export async function POST() {
  const dataDir = join(process.cwd(), "data");
  const seedPath = join(dataDir, "seed-state.json");
  const livePath = join(dataDir, "state.json");

  try {
    const seed = readFileSync(seedPath, "utf-8");
    writeFileSync(livePath, seed, "utf-8");
    return NextResponse.json({ ok: true, message: "Demo reset to seed state." });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: "Reset failed: " + String(err) },
      { status: 500 }
    );
  }
}
