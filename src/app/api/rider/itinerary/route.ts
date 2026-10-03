import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDailyItinerary } from "@/services/itinerary.service";

export async function GET(req: NextRequest) {
  try {
    await requireUser(req, ["rider"]);
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || undefined;

    const itinerary = await getDailyItinerary(date);
    return NextResponse.json({ itinerary });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to calculate daily itinerary." },
      { status: err.statusCode || 500 }
    );
  }
}
