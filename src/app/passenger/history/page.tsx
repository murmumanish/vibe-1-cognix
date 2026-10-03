"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { IRideRequest, ITrip } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCompanyTime } from "@/lib/date-utils";

type TabType = "my_requests" | "named_trips" | "travel_history";

export default function PassengerHistoryPage() {
  const [activeTab, setActiveTab] = useState<TabType>("my_requests");
  const [myRequests, setMyRequests] = useState<IRideRequest[]>([]);
  const [namedTrips, setNamedTrips] = useState<ITrip[]>([]);
  const [travelHistory, setTravelHistory] = useState<ITrip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/history/me")
      .then((res) => res.json())
      .then((data) => {
        setMyRequests(data.myRequests || []);
        setNamedTrips(data.namedTrips || []);
        setTravelHistory(data.travelHistory || []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Passenger Transit History</h1>
        <p className="text-sm text-slate-500">
          Strictly segregated records preserving your filed requests, group manifests, and completed rides.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-8">
        <button
          onClick={() => setActiveTab("my_requests")}
          className={`pb-3 text-sm font-semibold transition border-b-2 ${
            activeTab === "my_requests"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          My Filed Requests ({myRequests.length})
        </button>
        <button
          onClick={() => setActiveTab("named_trips")}
          className={`pb-3 text-sm font-semibold transition border-b-2 ${
            activeTab === "named_trips"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Named Trips ({namedTrips.length})
        </button>
        <button
          onClick={() => setActiveTab("travel_history")}
          className={`pb-3 text-sm font-semibold transition border-b-2 ${
            activeTab === "travel_history"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Verified Travel History ({travelHistory.length})
        </button>
      </div>

      {/* Limitation Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-800 space-y-1">
        <span className="font-bold block">Account Isolation Guarantee:</span>
        <p>
          Passenger histories are linked exclusively via verified user IDs, not display names. If a request listed you as an unregistered guest without linking your email, it does not appear in your personal verified history.
        </p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500 text-sm">Loading history...</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          {/* Tab 1: My Requests */}
          {activeTab === "my_requests" && (
            <div className="divide-y divide-slate-100">
              {myRequests.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">No filed requests found.</div>
              ) : (
                myRequests.map((req) => (
                  <div key={req._id.toString()} className="p-5 flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">
                        {req.originSnapshot.name} &rarr; {req.destinationSnapshot.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Pickup: {formatCompanyTime(req.pickupInstant)} &bull; {req.passengerCount} Passengers
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Manifest: {req.manifest.map((m) => m.name).join(", ")}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <StatusBadge status={req.status} type="request" />
                      <Link
                        href={`/passenger/requests/${req._id}`}
                        className="text-xs text-indigo-600 hover:underline font-medium"
                      >
                        View &rarr;
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 2: Named Trips */}
          {activeTab === "named_trips" && (
            <div className="divide-y divide-slate-100">
              {namedTrips.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">
                  You are not named on any scheduled or completed trips.
                </div>
              ) : (
                namedTrips.map((trip) => {
                  const myManifest = trip.manifest.find(
                    (m) => m.email || m.userId // match member
                  );
                  return (
                    <div key={trip._id.toString()} className="p-5 flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">
                          Trip #{trip._id.toString().slice(-6)}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Assigned Rider: {(trip.riderId as any)?.name || "Rider"} &bull; Status: {trip.status}
                        </div>
                        {myManifest && (
                          <div className="text-xs mt-1 space-x-2">
                            <span className="text-slate-600">Your Attendance:</span>
                            <StatusBadge status={myManifest.boardingStatus} type="attendance" />
                            {myManifest.dropoffStatus !== "not_applicable" && (
                              <StatusBadge status={myManifest.dropoffStatus} type="attendance" />
                            )}
                          </div>
                        )}
                      </div>
                      <StatusBadge status={trip.status} type="trip" />
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Tab 3: Verified Travel History */}
          {activeTab === "travel_history" && (
            <div className="divide-y divide-slate-100">
              {travelHistory.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">
                  No completed travel records yet. Completed trips where you boarded and were dropped off will appear here.
                </div>
              ) : (
                travelHistory.map((trip) => (
                  <div key={trip._id.toString()} className="p-5 flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">
                        Completed Toto Trip #{trip._id.toString().slice(-6)}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Completed at: {formatCompanyTime(trip.lifecycle.completedAt)} &bull; {trip.routeSnapshot.distance} {trip.routeSnapshot.mode === "demo" ? "demo units" : "km"}
                      </div>
                      <div className="text-xs text-emerald-700 font-medium mt-1">
                        ✓ Boarded and successfully dropped off
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-md">
                      Verified Completed
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
