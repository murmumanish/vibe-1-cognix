"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { IRideRequest } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCompanyTime } from "@/lib/date-utils";

export default function PassengerDashboardPage() {
  const [requests, setRequests] = useState<IRideRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  async function fetchRequests() {
    try {
      const res = await fetch("/api/requests");
      const data = await res.json();
      if (res.ok) {
        setRequests(data.requests || []);
      }
    } catch (e) {
      console.error("Failed to load requests", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRequests();
  }, []);

  async function handleCancel(id: string) {
    if (!confirm("Are you sure you want to cancel this ride request?")) return;
    setActionError(null);
    try {
      const res = await fetch(`/api/requests/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Cancelled by passenger" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to cancel request.");
      }
      fetchRequests();
    } catch (err: any) {
      setActionError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Passenger Dashboard</h1>
          <p className="text-sm text-slate-500">
            View your ride requests and dispatch statuses for the Toto vehicle.
          </p>
        </div>
        <Link
          href="/passenger/requests/new"
          className="inline-flex items-center justify-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm shadow-sm transition"
        >
          + Request Toto Ride
        </Link>
      </div>

      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-500 text-sm">
          Loading your ride requests...
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center font-bold text-lg">
            🚖
          </div>
          <h3 className="text-base font-semibold text-slate-800">No requests filed yet</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            Need a ride between College, Station, or Office? Submit a single or group request.
          </p>
          <Link
            href="/passenger/requests/new"
            className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition"
          >
            Create Your First Request
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Route</th>
                  <th className="px-6 py-3.5">Pickup Time (IST)</th>
                  <th className="px-6 py-3.5">Passengers</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {requests.map((req) => (
                  <tr key={req._id.toString()} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 flex items-center space-x-1.5">
                        <span>{req.originSnapshot.name}</span>
                        <span className="text-slate-400">&rarr;</span>
                        <span>{req.destinationSnapshot.name}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {req.originSnapshot.code} to {req.destinationSnapshot.code}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-700">
                      {formatCompanyTime(req.pickupInstant)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-medium text-slate-900">
                        {req.passengerCount} Person{req.passengerCount === 1 ? "" : "s"}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-xs">
                        {req.manifest.map((m) => m.name).join(", ")}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={req.status} type="request" />
                      {req.assignedRiderId && (
                        <div className="text-[11px] text-slate-500 mt-1">
                          Rider: {(req.assignedRiderId as any).name || "Assigned"}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Link
                        href={`/passenger/requests/${req._id}`}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded transition"
                      >
                        Details
                      </Link>
                      {(req.status === "pending" || req.status === "accepted") && (
                        <button
                          onClick={() => handleCancel(req._id.toString())}
                          className="text-xs font-medium text-red-600 hover:text-red-800 bg-red-50 px-2.5 py-1 rounded transition"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
