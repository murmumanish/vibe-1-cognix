"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ITrip, ILocation, IUser } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { SchematicMap } from "@/components/SchematicMap";
import { ManifestTable } from "@/components/ManifestTable";
import { formatCompanyTime } from "@/lib/date-utils";

export default function TripOperationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [trip, setTrip] = useState<ITrip | null>(null);
  const [currentUser, setCurrentUser] = useState<IUser | null>(null);
  const [locations, setLocations] = useState<ILocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadTripData() {
    try {
      const [tripRes, userRes, locRes] = await Promise.all([
        fetch(`/api/trips/${id}`),
        fetch("/api/auth/me"),
        fetch("/api/locations"),
      ]);

      const tripData = await tripRes.json();
      const userData = await userRes.json();
      const locData = await locRes.json();

      if (!tripRes.ok) throw new Error(tripData.error || "Failed to load trip.");
      setTrip(tripData.trip);
      setCurrentUser(userData.user);
      setLocations(locData.locations || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTripData();
  }, [id]);

  const isAssignedRider =
    !!currentUser &&
    !!trip &&
    currentUser._id.toString() === (trip.riderId as any)._id?.toString();

  async function handleStartPickup() {
    setError(null);
    setActionLoading(true);
    try {
      const res = await fetch(`/api/trips/${id}/start-pickup`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start pickup.");
      loadTripData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDepart() {
    setError(null);
    setActionLoading(true);
    try {
      const res = await fetch(`/api/trips/${id}/depart`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to depart trip.");
      loadTripData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleComplete() {
    setError(null);
    setActionLoading(true);
    try {
      const res = await fetch(`/api/trips/${id}/complete`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to complete trip.");
      loadTripData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return <div className="py-12 text-center text-slate-500 text-sm">Loading trip operations...</div>;
  }

  if (error || !trip) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-red-50 border border-red-200 text-red-700 rounded-xl text-center space-y-4">
        <p className="font-semibold">{error || "Trip not found"}</p>
        <Link href="/rider/dashboard" className="text-xs text-indigo-600 underline">
          Return to Rider Desk
        </Link>
      </div>
    );
  }

  const request = trip.requestId as any;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-slate-900">
              Trip #{trip._id.toString().slice(-6)} Operations Console
            </h1>
            <StatusBadge status={trip.status} type="trip" />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Assigned Rider: {(trip.riderId as any)?.name} &bull; Vehicle: {(trip.vehicleId as any)?.code || "TOTO-1"}
          </p>
        </div>

        <Link
          href="/rider/dashboard"
          className="text-xs text-slate-600 hover:text-slate-900 bg-white border border-slate-300 px-3 py-1.5 rounded-lg transition"
        >
          &larr; Back to Rider Desk
        </Link>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
          {error}
        </div>
      )}

      {/* Lifecycle Control Bar */}
      {isAssignedRider && trip.status !== "completed" && trip.status !== "cancelled" && (
        <div className="p-4 bg-slate-900 text-white rounded-xl shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Operational Lifecycle Action</h3>
            <p className="text-xs text-slate-400">
              {trip.status === "accepted" && "Step 1: Claim the vehicle and initiate pickup."}
              {trip.status === "picking_up" && "Step 2: Mark all passengers Boarded or Missed, then Depart."}
              {trip.status === "in_progress" && "Step 3: Mark drop-offs, then Complete Trip to free the Toto."}
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {trip.status === "accepted" && (
              <button
                disabled={actionLoading}
                onClick={handleStartPickup}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 font-semibold text-xs rounded-lg shadow transition disabled:opacity-50"
              >
                {actionLoading ? "Claiming Toto..." : "1. Start Pickup (Claim Vehicle)"}
              </button>
            )}

            {trip.status === "picking_up" && (
              <button
                disabled={actionLoading}
                onClick={handleDepart}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 font-semibold text-xs rounded-lg shadow transition disabled:opacity-50"
              >
                {actionLoading ? "Departing..." : "2. Depart (Lock Manifest)"}
              </button>
            )}

            {trip.status === "in_progress" && (
              <button
                disabled={actionLoading}
                onClick={handleComplete}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 font-semibold text-xs rounded-lg shadow transition disabled:opacity-50"
              >
                {actionLoading ? "Releasing Toto..." : "3. Complete Trip & Release Vehicle"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Manifest and Timestamps */}
        <div className="lg:col-span-7 space-y-6">
          <ManifestTable
            tripId={trip._id.toString()}
            tripStatus={trip.status}
            manifest={trip.manifest}
            isAssignedRider={isAssignedRider}
            onRefresh={loadTripData}
          />

          {/* Lifecycle Timestamps */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Immutable Lifecycle Audit
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 bg-slate-50 rounded">
                <span className="text-slate-400 block text-[10px]">Accepted</span>
                <span className="font-semibold text-slate-800">
                  {formatCompanyTime(trip.lifecycle.acceptedAt, "hh:mm a")}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded">
                <span className="text-slate-400 block text-[10px]">Pickup Started</span>
                <span className="font-semibold text-slate-800">
                  {formatCompanyTime(trip.lifecycle.pickupStartedAt, "hh:mm a")}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded">
                <span className="text-slate-400 block text-[10px]">Departed</span>
                <span className="font-semibold text-slate-800">
                  {formatCompanyTime(trip.lifecycle.departedAt, "hh:mm a")}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded">
                <span className="text-slate-400 block text-[10px]">Completed</span>
                <span className="font-semibold text-slate-800">
                  {formatCompanyTime(trip.lifecycle.completedAt, "hh:mm a")}
                </span>
              </div>
            </div>

            {trip.completionReason && (
              <div className="p-2.5 bg-slate-100 rounded text-xs text-slate-700">
                <span className="font-semibold">Completion Reason: </span>
                <span className="uppercase font-mono text-[11px]">{trip.completionReason}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Route Map and Specifications */}
        <div className="lg:col-span-5 space-y-4">
          <SchematicMap
            locations={locations}
            activeOriginId={request?.originId?.toString()}
            activeDestinationId={request?.destinationId?.toString()}
            vehicleLocationId={request?.originId?.toString()}
            distance={trip.routeSnapshot.distance}
            duration={trip.routeSnapshot.duration}
            mode={trip.routeSnapshot.mode}
          />

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2 text-xs text-slate-600">
            <h4 className="font-bold text-slate-900">Saved Route Plan Snapshot</h4>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span>Mode:</span>
              <span className="font-semibold uppercase">{trip.routeSnapshot.mode}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span>Distance:</span>
              <span className="font-semibold">
                {trip.routeSnapshot.distance} {trip.routeSnapshot.mode === "demo" ? "demo units" : "km"}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span>Duration:</span>
              <span className="font-semibold">~{trip.routeSnapshot.duration} minutes</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span>Coordinate Versions:</span>
              <span className="font-mono text-[11px]">
                Origin v{trip.routeSnapshot.originVersion}, Dest v{trip.routeSnapshot.destinationVersion}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 pt-1">
              Route snapshot is immutably preserved and will not change if campus coordinates are later updated.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
