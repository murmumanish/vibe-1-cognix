"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { IRideRequest, ITrip } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCompanyTime } from "@/lib/date-utils";

export default function RiderDashboardPage() {
  const [pendingRequests, setPendingRequests] = useState<IRideRequest[]>([]);
  const [assignedTrips, setAssignedTrips] = useState<ITrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [clashError, setClashError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function loadData() {
    try {
      const [reqRes, tripRes] = await Promise.all([
        fetch("/api/requests?status=pending"),
        fetch("/api/trips"),
      ]);
      const reqData = await reqRes.json();
      const tripData = await tripRes.json();

      setPendingRequests(reqData.requests || []);
      setAssignedTrips(tripData.trips || []);
    } catch (e) {
      console.error("Dashboard load failed", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000); // Polling for live desk updates
    return () => clearInterval(interval);
  }, []);

  async function handleAccept(requestId: string) {
    setAcceptingId(requestId);
    setClashError(null);
    setSuccessMessage(null);

    const idempotencyKey = crypto.randomUUID();

    try {
      const res = await fetch(`/api/requests/${requestId}/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setClashError(data.error || "Conflict detected: This time slot or repositioning path clashes with an existing trip.");
        } else {
          throw new Error(data.error || "Failed to accept request.");
        }
      } else {
        setSuccessMessage("Trip successfully scheduled and assigned to you!");
      }
      loadData();
    } catch (err: any) {
      setClashError(err.message);
    } finally {
      setAcceptingId(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse"></span>
            <h1 className="text-2xl font-bold text-slate-900">Rider Operations Desk</h1>
          </div>
          <p className="text-sm text-slate-500">
            Accept requests, dispatch the Toto vehicle, and manage attendance manifests.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/rider/schedule"
            className="text-xs bg-slate-800 hover:bg-slate-700 text-white font-medium px-3.5 py-2 rounded-lg transition"
          >
            Daily Itinerary & Schedule
          </Link>
          <Link
            href="/rider/clash-log"
            className="text-xs bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-medium px-3.5 py-2 rounded-lg transition"
          >
            Clash Activity Log
          </Link>
        </div>
      </div>

      {/* Notifications */}
      {clashError && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl shadow-sm text-sm text-red-800 space-y-1">
          <div className="font-bold flex items-center space-x-1.5">
            <span>🚨</span>
            <span>409 Scheduling Conflict / Clash Detected</span>
          </div>
          <p>{clashError}</p>
          <p className="text-xs text-red-600">
            Under XYZ Company policy, exact same-time requests or infeasible transfer repositionings are rejected to protect Toto schedule integrity.
          </p>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-green-50 border-l-4 border-green-500 rounded-r-xl shadow-sm text-sm text-green-800 flex items-center justify-between">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="text-xs text-green-700 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Active Trips Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
          <span>Active & Scheduled Trips</span>
          <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-semibold">
            {assignedTrips.filter((t) => t.status !== "completed" && t.status !== "cancelled").length}
          </span>
        </h2>

        {assignedTrips.filter((t) => t.status !== "completed" && t.status !== "cancelled").length === 0 ? (
          <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
            No active trips in progress. Accept pending requests below to dispatch the Toto.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assignedTrips
              .filter((t) => t.status !== "completed" && t.status !== "cancelled")
              .map((trip) => (
                <div
                  key={trip._id.toString()}
                  className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900">
                      Trip #{trip._id.toString().slice(-6)}
                    </span>
                    <StatusBadge status={trip.status} type="trip" />
                  </div>

                  <div className="text-xs text-slate-600 space-y-1">
                    <div>
                      <span className="font-medium text-slate-500">Rider: </span>
                      {(trip.riderId as any)?.name || "Assigned"}
                    </div>
                    <div>
                      <span className="font-medium text-slate-500">Manifest: </span>
                      {trip.manifest.length} Passengers ({trip.manifest.map((m) => m.name).join(", ")})
                    </div>
                    <div>
                      <span className="font-medium text-slate-500">Route: </span>
                      {trip.routeSnapshot.distance} {trip.routeSnapshot.mode === "demo" ? "demo units" : "km"} &bull; ~{trip.routeSnapshot.duration} mins
                    </div>
                  </div>

                  <Link
                    href={`/rider/trips/${trip._id}`}
                    className="block w-full text-center py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg transition"
                  >
                    Open Live Operations Console &rarr;
                  </Link>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Pending Requests Queue */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <span>Pending Ride Requests Queue</span>
            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
              {pendingRequests.length}
            </span>
          </h2>
          <span className="text-xs text-slate-500">Auto-refreshing live</span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-500 text-sm">Loading pending queue...</div>
        ) : pendingRequests.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
            Queue is currently empty. No pending ride requests.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Filer / Route</th>
                    <th className="px-6 py-3.5">Pickup Time (IST)</th>
                    <th className="px-6 py-3.5">Manifest</th>
                    <th className="px-6 py-3.5">Clash History</th>
                    <th className="px-6 py-3.5 text-right">Dispatch Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {pendingRequests.map((req) => (
                    <tr key={req._id.toString()} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">
                          {req.originSnapshot.name} &rarr; {req.destinationSnapshot.name}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Filer: {(req.filerId as any)?.name} ({(req.filerId as any)?.email})
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-700">
                        {formatCompanyTime(req.pickupInstant)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-medium text-slate-900">
                          {req.passengerCount} Passengers
                        </div>
                        <div className="text-[11px] text-slate-500 max-w-xs truncate">
                          {req.manifest.map((m) => m.name).join(", ")}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        {req.clashHistory && req.clashHistory.length > 0 ? (
                          <span className="text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                            {req.clashHistory.length} Clash Attempt{req.clashHistory.length === 1 ? "" : "s"}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">None</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          disabled={acceptingId === req._id.toString()}
                          onClick={() => handleAccept(req._id.toString())}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
                        >
                          {acceptingId === req._id.toString() ? "Locking..." : "Accept & Schedule"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
