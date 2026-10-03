import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Trip } from "@/models/Trip";
import { RideRequest } from "@/models/RideRequest";
import { requireUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    await requireUser(req, ["rider"]);
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const riderId = searchParams.get("riderId");
    const dateStr = searchParams.get("date");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const tripQuery: any = {};
    if (status) tripQuery.status = status;
    if (riderId) tripQuery.riderId = riderId;
    if (dateStr) {
      const d = new Date(dateStr);
      const start = new Date(d.setHours(0, 0, 0, 0));
      const end = new Date(d.setHours(23, 59, 59, 999));
      tripQuery.createdAt = { $gte: start, $lte: end };
    }

    const skip = (page - 1) * limit;

    const [trips, totalTrips] = await Promise.all([
      Trip.find(tripQuery)
        .populate("riderId", "name email")
        .populate("requestId")
        .populate("vehicleId", "code")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Trip.countDocuments(tripQuery),
    ]);

    // Also fetch clash logs and pending requests
    const clashRequests = await RideRequest.find({
      "clashHistory.0": { $exists: true },
    })
      .populate("filerId", "name email")
      .populate("clashHistory.riderId", "name email")
      .sort({ updatedAt: -1 })
      .limit(50);

    return NextResponse.json({
      trips,
      pagination: {
        total: totalTrips,
        page,
        limit,
        totalPages: Math.ceil(totalTrips / limit),
      },
      clashRequests,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch rider history." },
      { status: err.statusCode || 500 }
    );
  }
}
