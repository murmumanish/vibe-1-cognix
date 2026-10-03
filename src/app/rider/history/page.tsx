"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ITrip } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCompanyTime } from "@/lib/date-utils";

export default function RiderAllTripsHistoryPage() {
  const [trips, setTrips] = useState<ITrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  async function fetchTrips() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (dateFilter) params.append("date", dateFilter);

      const res = await fetch(`/api/rider/history?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setTrips(data.trips || []);
      }
    } catch (e) {
      console.error("Failed to load rider history", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTrips();
  }, [statusFilter, dateFilter]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">All Trips History Archive</h1>
          <p className="text-sm text-slate-500">
            Complete desk records of every scheduled, completed, and cancelled Toto trip.
          </p>
        </div>

        <Link
          href="/rider/dashboard"
          className="text-xs bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3.5 py-2 rounded-lg transition"
        >
          &larr; Operations Desk
        </Link>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-xs">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Status Filter</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
          >
            <option value="">All Statuses</option>
            <option value="accepted">Accepted</option>
            <option value="picking_up">Picking Up</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Date</label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
          />
        </div>

        {(statusFilter || dateFilter) && (
          <div className="self-end pb-0.5">
            <button
              onClick={() => {
                setStatusFilter("");
                setDateFilter("");
              }}
              className="text-xs text-indigo-600 hover:underline font-semibold"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500 text-sm">Loading trips archive...</div>
      ) : trips.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-2">
          <h3 className="text-base font-semibold text-slate-800">No trips matching criteria</h3>
          <p className="text-xs text-slate-500">Try adjusting your status or date filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {trips.map((trip) => {
            const req = trip.requestId as any;
            return (
              <div
                key={trip._id.toString()}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-3">
                    <span className="font-bold text-sm text-slate-900">
                      Trip #{trip._id.toString().slice(-6)}
                    </span>
                    <StatusBadge status={trip.status} type="trip" />
                    {trip.completionReason && (
                      <span className="text-[11px] font-mono px-2 py-0.5 bg-slate-100 rounded text-slate-600">
                        {trip.completionReason.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    Created: {formatCompanyTime(trip.createdAt)} &bull; Rider: {(trip.riderId as any)?.name || "Rider"}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-700">
                  <div>
                    <span className="font-semibold block text-slate-500">Route & Transit:</span>
                    <div>
                      {req?.originSnapshot?.name || "Origin"} &rarr; {req?.destinationSnapshot?.name || "Destination"}
                    </div>
                    <div className="text-slate-400 mt-0.5">
                      {trip.routeSnapshot.distance} {trip.routeSnapshot.mode === "demo" ? "demo units" : "km"} (~{trip.routeSnapshot.duration} mins)
                    </div>
                  </div>

                  <div>
                    <span className="font-semibold block text-slate-500">Passenger Attendance ({trip.manifest.length}):</span>
                    <div className="space-y-0.5 mt-1">
                      {trip.manifest.map((m) => (
                        <div key={m.memberId} className="flex items-center justify-between">
                          <span>{m.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {m.boardingStatus} {m.dropoffStatus !== "not_applicable" ? `(${m.dropoffStatus})` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="font-semibold block text-slate-500">Lifecycle Milestones:</span>
                    <div className="text-slate-500 space-y-0.5 mt-1">
                      <div>Pickup: {formatCompanyTime(trip.lifecycle.pickupStartedAt, "hh:mm a")}</div>
                      <div>Departed: {formatCompanyTime(trip.lifecycle.departedAt, "hh:mm a")}</div>
                      <div>Completed: {formatCompanyTime(trip.lifecycle.completedAt, "hh:mm a")}</div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Link
                    href={`/rider/trips/${trip._id}`}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-md transition"
                  >
                    View Operations Log &rarr;
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
