import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import crypto from "crypto";
import { connectToDatabase } from "@/lib/db";
import { RideRequest } from "@/models/RideRequest";
import { Location } from "@/models/Location";
import { User } from "@/models/User";
import { Vehicle } from "@/models/Vehicle";
import { requireUser } from "@/lib/auth";
import { createRideRequestSchema } from "@/lib/validation";
import { parseLocalInputToUtc } from "@/lib/date-utils";
import { IManifestMember } from "@/types";

const MAX_SEAT_CAPACITY = parseInt(process.env.VEHICLE_SEAT_CAPACITY || "4", 10);
const PICKUP_TOLERANCE_MINUTES = parseInt(process.env.PICKUP_TOLERANCE_MINUTES || "0", 10);

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const query: any = {};
    if (user.role === "passenger") {
      // Passengers only see their own filed requests
      query.filerId = user._id;
    }

    if (status) {
      query.status = status;
    }

    const requests = await RideRequest.find(query)
      .populate("filerId", "name email")
      .populate("assignedRiderId", "name email")
      .populate("tripId", "status completionReason")
      .sort({ createdAt: -1 })
      .limit(100);

    return NextResponse.json({ requests });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch ride requests." },
      { status: err.statusCode || 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    await connectToDatabase();

    const body = await req.json();
    const parsed = createRideRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { originId, destinationId, pickupDatetime, manifest, notes } = parsed.data;

    // Check seat capacity
    const vehicle = await Vehicle.findOne();
    const seatLimit = vehicle?.seatCapacity || MAX_SEAT_CAPACITY;

    if (manifest.length > seatLimit) {
      return NextResponse.json(
        {
          error: `Group size (${manifest.length}) exceeds the vehicle seat capacity (${seatLimit}).`,
        },
        { status: 400 }
      );
    }

    // Verify locations exist and are active
    const origin = await Location.findById(originId);
    const destination = await Location.findById(destinationId);

    if (!origin || !origin.active || !destination || !destination.active) {
      return NextResponse.json(
        { error: "Selected origin or destination location is invalid or inactive." },
        { status: 400 }
      );
    }

    // Parse and validate pickup time
    const pickupInstant = parseLocalInputToUtc(pickupDatetime);
    const now = new Date();
    // Allow 2 minute clock skew margin
    if (pickupInstant.getTime() < now.getTime() - 2 * 60 * 1000) {
      return NextResponse.json(
        { error: "Pickup date and time cannot be in the past." },
        { status: 400 }
      );
    }

    const latestPickupInstant = new Date(
      pickupInstant.getTime() + PICKUP_TOLERANCE_MINUTES * 60 * 1000
    );

    // Resolve manifest members and registered user accounts
    const resolvedManifest: IManifestMember[] = [];
    const seenUserIds = new Set<string>();

    for (const member of manifest) {
      const memberId = crypto.randomUUID();
      let linkedUser: any = null;

      if (member.email) {
        linkedUser = await User.findOne({ email: member.email.toLowerCase().trim() });
      }

      // Check if filer is claiming themselves
      if (member.isFiler) {
        linkedUser = await User.findById(user._id);
      }

      if (linkedUser) {
        const uid = linkedUser._id.toString();
        if (seenUserIds.has(uid)) {
          return NextResponse.json(
            {
              error: `Duplicate passenger detected: User '${linkedUser.name}' (${linkedUser.email}) cannot be added more than once.`,
            },
            { status: 400 }
          );
        }
        seenUserIds.add(uid);

        resolvedManifest.push({
          memberId,
          userId: linkedUser._id,
          name: member.name || linkedUser.name,
          email: linkedUser.email,
          isFiler: !!member.isFiler,
          boardingStatus: "unmarked",
          dropoffStatus: "not_applicable",
        });
      } else {
        // Unregistered guest passenger
        resolvedManifest.push({
          memberId,
          userId: null,
          name: member.name,
          email: member.email || undefined,
          isFiler: !!member.isFiler,
          boardingStatus: "unmarked",
          dropoffStatus: "not_applicable",
        });
      }
    }

    const newRequest = await RideRequest.create({
      filerId: user._id,
      originId: origin._id,
      destinationId: destination._id,
      originSnapshot: {
        code: origin.code,
        name: origin.name,
        coordinates: origin.coordinates,
        coordinateMode: origin.coordinateMode,
      },
      destinationSnapshot: {
        code: destination.code,
        name: destination.name,
        coordinates: destination.coordinates,
        coordinateMode: destination.coordinateMode,
      },
      pickupInstant,
      latestPickupInstant,
      passengerCount: resolvedManifest.length,
      manifest: resolvedManifest,
      notes,
      status: "pending",
      clashHistory: [],
      assignedRiderId: null,
      tripId: null,
      version: 1,
    });

    return NextResponse.json(
      { success: true, request: newRequest },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("Create request error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create ride request." },
      { status: err.statusCode || 500 }
    );
  }
}
