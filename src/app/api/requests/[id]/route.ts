import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { RideRequest } from "@/models/RideRequest";
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

    const request = await RideRequest.findById(id)
      .populate("filerId", "name email")
      .populate("assignedRiderId", "name email")
      .populate("tripId");

    if (!request) {
      throw new NotFoundError("Ride request not found.");
    }

    // Authorization check
    if (user.role === "passenger") {
      const isFiler = request.filerId._id.toString() === user._id.toString();
      const isPassenger = request.manifest.some(
        (m) => m.userId && m.userId.toString() === user._id.toString()
      );
      if (!isFiler && !isPassenger) {
        throw new ForbiddenError("You are not authorized to view this request.");
      }
    }

    return NextResponse.json({ request });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch request." },
      { status: err.statusCode || 500 }
    );
  }
}
