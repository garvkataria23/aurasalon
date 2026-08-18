import { NextResponse } from "next/server";
import { SOURCE_MESSAGES } from "@/i18n/source";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(SOURCE_MESSAGES, {
    headers: {
      "Content-Disposition": 'attachment; filename="tolgee-en.json"',
      "Cache-Control": "no-store",
    },
  });
}
