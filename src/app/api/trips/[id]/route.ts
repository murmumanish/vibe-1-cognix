import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Trip } from "@/models/Trip";
import { requireUser } from "@/lib/auth";
import { NotFoundError, ForbiddenError } from "@/lib/errors";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(req);
    await connectToDatabase();
    const { id } = await params;

    const trip = await Trip.findById(id)
      .populate("riderId", "name email")
      .populate("requestId")
      .populate("vehicleId");

    if (!trip) {
      throw new NotFoundError("Trip not found.");
    }

    // Role and object-level permission check
    if (user.role === "passenger") {
      const isPassenger = trip.manifest.some(
        (m) => m.userId && m.userId.toString() === user._id.toString()
      );
      const isFiler = (trip.requestId as any)?.filerId?.toString() === user._id.toString();

      if (!isPassenger && !isFiler) {
        throw new ForbiddenError("You are not authorized to view this trip.");
      }
    }

    return NextResponse.json({ trip });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch trip details." },
      { status: err.statusCode || 500 }
    );
  }
}
