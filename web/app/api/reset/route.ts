import { NextResponse } from "next/server";
import { resetDemo } from "../../../lib/actions";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = resetDemo();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: "Reset failed: " + String(err) },
      { status: 500 }
    );
  }
}
