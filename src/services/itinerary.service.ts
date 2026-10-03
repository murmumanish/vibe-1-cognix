import { connectToDatabase } from "@/lib/db";
import { Trip } from "@/models/Trip";
import { Reservation } from "@/models/Reservation";
import { Vehicle } from "@/models/Vehicle";
import { Location } from "@/models/Location";
import { calculateRoute } from "./routing.service";
import { ItineraryItem, DayItinerarySummary } from "@/types";

export type { ItineraryItem, DayItinerarySummary };


export async function getDailyItinerary(dateStr?: string): Promise<DayItinerarySummary> {
  await connectToDatabase();

  const targetDate = dateStr ? new Date(dateStr) : new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const vehicle = await Vehicle.findOne();
  const vehicleState = vehicle?.operationalState || "available";

  // Find all active or accepted trips for the date
  const reservations = await Reservation.find({
    reservedStart: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ["active", "completed"] },
  }).sort({ reservedStart: 1 });

  const tripIds = reservations.map((r) => r.tripId);
  const trips = await Trip.find({ _id: { $in: tripIds } })
    .populate("riderId", "name email")
    .populate("requestId");

  const items: ItineraryItem[] = [];
  let totalPassengerDistance = 0;
  let totalRepositionDistance = 0;
  let totalMinutes = 0;

  let previousDestinationId: any = vehicle?.currentLocationId;
  const now = new Date();

  for (let i = 0; i < reservations.length; i++) {
    const res = reservations[i];
    const trip = trips.find((t) => t._id.toString() === res.tripId.toString());
    if (!trip) continue;

    const request: any = trip.requestId;
    const originLoc = await Location.findById(request?.originId);
    const destLoc = await Location.findById(request?.destinationId);

    let repositionDist = 0;
    let repositionDur = 0;

    if (previousDestinationId && originLoc && previousDestinationId.toString() !== originLoc._id.toString()) {
      const prevLoc = await Location.findById(previousDestinationId);
      if (prevLoc) {
        try {
          const { route } = await calculateRoute(prevLoc, originLoc);
          repositionDist = route.distance;
          repositionDur = route.duration;
        } catch {}
      }
    }

    const passengerDist = trip.routeSnapshot?.distance || 0;
    const passengerDur = trip.routeSnapshot?.duration || 0;

    totalPassengerDistance += passengerDist;
    totalRepositionDistance += repositionDist;
    totalMinutes += passengerDur + repositionDur;

    // Check At Risk status: if previous trip is still in progress past its estimated end time
    let atRisk = false;
    let feasibilityNote = "Feasible and on schedule";

    if (i > 0) {
      const prevRes = reservations[i - 1];
      const prevTrip = trips.find((t) => t._id.toString() === prevRes.tripId.toString());
      if (prevTrip && (prevTrip.status === "in_progress" || prevTrip.status === "picking_up")) {
        if (now > prevRes.reservedEnd) {
          atRisk = true;
          feasibilityNote = `At Risk: Prior trip (${prevTrip._id}) is delayed past reserved end time.`;
        }
      }
    }

    items.push({
      tripId: trip._id.toString(),
      requestId: request?._id?.toString() || "",
      status: trip.status,
      pickupTime: res.reservedStart,
      originName: originLoc?.name || "Unknown",
      destinationName: destLoc?.name || "Unknown",
      passengers: trip.manifest.length,
      riderName: (trip.riderId as any)?.name || "Assigned Rider",
      distance: passengerDist,
      duration: passengerDur,
      repositionDistance: repositionDist,
      repositionDuration: repositionDur,
      atRisk,
      feasibilityNote,
    });

    if (destLoc) {
      previousDestinationId = destLoc._id;
    }
  }

  return {
    date: startOfDay.toISOString().split("T")[0],
    totalTrips: items.length,
    totalPassengerDistance: Math.round(totalPassengerDistance * 10) / 10,
    totalRepositionDistance: Math.round(totalRepositionDistance * 10) / 10,
    totalEstimatedMinutes: totalMinutes,
    activeVehicleState: vehicleState,
    items,
    optimizationNote:
      "Feasible chronology enforced by fixed pickup promises and repositioning buffers.",
  };
}
