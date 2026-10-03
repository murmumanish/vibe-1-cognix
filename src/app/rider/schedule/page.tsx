"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { DayItinerarySummary } from "@/services/itinerary.service";
import { formatCompanyTime } from "@/lib/date-utils";

export default function RiderSchedulePage() {
  const [itinerary, setItinerary] = useState<DayItinerarySummary | null>(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState(true);

  async function loadSchedule(dateStr: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/rider/itinerary?date=${dateStr}`);
      const data = await res.json();
      if (res.ok) {
        setItinerary(data.itinerary);
      }
    } catch (e) {
      console.error("Failed to load itinerary", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSchedule(selectedDate);
  }, [selectedDate]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Service Day Itinerary & Schedule</h1>
          <p className="text-sm text-slate-500">
            Multi-trip schedule, repositioning travel calculations, and delay risk monitoring.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
          <Link
            href="/rider/dashboard"
            className="text-xs bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg transition"
          >
            &larr; Operations Desk
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500 text-sm">Calculating daily itinerary...</div>
      ) : !itinerary || itinerary.items.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-2">
          <h3 className="text-base font-semibold text-slate-800">No scheduled trips for this date</h3>
          <p className="text-xs text-slate-500">
            Accepted trips for {selectedDate} will appear here with calculated repositioning travel.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 block font-medium">Scheduled Trips</span>
              <span className="text-2xl font-bold text-slate-900">{itinerary.totalTrips}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 block font-medium">Passenger Travel</span>
              <span className="text-2xl font-bold text-indigo-600">
                {itinerary.totalPassengerDistance} units
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 block font-medium">Empty Repositioning</span>
              <span className="text-2xl font-bold text-amber-600">
                {itinerary.totalRepositionDistance} units
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 block font-medium">Est. Service Duration</span>
              <span className="text-2xl font-bold text-slate-900">
                ~{itinerary.totalEstimatedMinutes} mins
              </span>
            </div>
          </div>

          {/* Chronological Timeline */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Chronological Trip Sequence & Transfers
              </h3>
              <span className="text-xs text-slate-500 italic font-mono">
                {itinerary.optimizationNote}
              </span>
            </div>

            <div className="space-y-4">
              {itinerary.items.map((item, index) => (
                <div key={item.tripId} className="space-y-2">
                  {/* Repositioning Segment if any */}
                  {item.repositionDistance > 0 && (
                    <div className="flex items-center space-x-3 px-4 py-2 bg-amber-50/70 border border-dashed border-amber-300 rounded-lg text-xs text-amber-800">
                      <span className="font-mono text-amber-600 font-bold">⇄ REPOSITIONING:</span>
                      <span>
                        Toto repositioning travel: {item.repositionDistance} demo units (~{item.repositionDuration} mins transfer)
                      </span>
                    </div>
                  )}

                  {/* Main Trip Card */}
                  <div
                    className={`p-4 rounded-xl border transition ${
                      item.atRisk
                        ? "bg-red-50 border-red-300"
                        : "bg-white border-slate-200 hover:border-indigo-300"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-3">
                        <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                          {index + 1}
                        </span>
                        <div>
                          <div className="font-bold text-slate-900 text-sm">
                            {item.originName} &rarr; {item.destinationName}
                          </div>
                          <div className="text-xs text-slate-500">
                            Pickup promised: {formatCompanyTime(item.pickupTime)} &bull; {item.passengers} Passengers &bull; Rider: {item.riderName}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        {item.atRisk && (
                          <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full animate-pulse">
                            ⚠️ AT RISK (DELAY)
                          </span>
                        )}
                        <Link
                          href={`/rider/trips/${item.tripId}`}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-md transition"
                        >
                          Operations Console &rarr;
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
