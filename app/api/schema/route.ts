import { NextResponse } from "next/server";
import { loadSchema } from "@/lib/introspect";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const schema = await loadSchema();
    return NextResponse.json(schema);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al leer el schema";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
