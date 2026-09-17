import { NextResponse } from "next/server";
import { searchSpotsForPicker } from "@/lib/data/spots";
import { requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { supabase } = await requireUser();
  const keyword = new URL(request.url).searchParams.get("q") ?? "";
  const spots = await searchSpotsForPicker(supabase, keyword.slice(0, 100));

  return NextResponse.json(
    { spots },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
