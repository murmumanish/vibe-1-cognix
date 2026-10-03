import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { RideRequest } from "@/models/RideRequest";
import { Trip } from "@/models/Trip";
import { requireUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    await connectToDatabase();

    // 1. My Requests: Everything this account filed
    const myRequests = await RideRequest.find({ filerId: user._id })
      .populate("assignedRiderId", "name email")
      .sort({ createdAt: -1 });

    // 2. Named Trips: Trips whose manifest explicitly references this user
    const namedTrips = await Trip.find({ "manifest.userId": user._id })
      .populate("riderId", "name email")
      .populate("requestId")
      .sort({ createdAt: -1 });

    // 3. Travel History: Completed trips where this account actually Boarded and was Dropped
    const travelHistory = namedTrips.filter((t) => {
      if (t.status !== "completed") return false;
      const member = t.manifest.find(
        (m) => m.userId && m.userId.toString() === user._id.toString()
      );
      return member?.boardingStatus === "boarded" && member?.dropoffStatus === "dropped";
    });

    return NextResponse.json({
      myRequests,
      namedTrips,
      travelHistory,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch passenger history." },
      { status: err.statusCode || 500 }
    );
  }
}
