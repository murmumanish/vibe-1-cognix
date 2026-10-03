import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Trip } from "@/models/Trip";
import { requireUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const riderId = searchParams.get("riderId");

    const query: any = {};

    if (user.role === "passenger") {
      // Passengers only see trips where they are on the manifest
      query["manifest.userId"] = user._id;
    } else if (riderId) {
      query.riderId = riderId;
    }

    if (status) {
      query.status = status;
    }

    const trips = await Trip.find(query)
      .populate("riderId", "name email")
      .populate("requestId")
      .populate("vehicleId", "code seatCapacity operationalState")
      .sort({ createdAt: -1 })
      .limit(100);

    return NextResponse.json({ trips });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch trips." },
      { status: err.statusCode || 500 }
    );
  }
}
