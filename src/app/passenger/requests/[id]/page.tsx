"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IRideRequest, ILocation } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { SchematicMap } from "@/components/SchematicMap";
import { formatCompanyTime } from "@/lib/date-utils";

export default function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [request, setRequest] = useState<IRideRequest | null>(null);
  const [locations, setLocations] = useState<ILocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/requests/${id}`).then((r) => r.json()),
      fetch("/api/locations").then((r) => r.json()),
    ])
      .then(([reqData, locData]) => {
        if (reqData.error) throw new Error(reqData.error);
        setRequest(reqData.request);
        setLocations(locData.locations || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleCancel() {
    if (!confirm("Are you sure you want to cancel this request?")) return;
    try {
      const res = await fetch(`/api/requests/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Cancelled by passenger" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.refresh();
      // Reload
      const updated = await fetch(`/api/requests/${id}`).then((r) => r.json());
      setRequest(updated.request);
    } catch (err: any) {
      alert(err.message);
    }
  }

  if (loading) {
    return <div className="py-12 text-center text-slate-500 text-sm">Loading request details...</div>;
  }

  if (error || !request) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-red-50 border border-red-200 text-red-700 rounded-xl text-center space-y-4">
        <p className="font-semibold">{error || "Request not found"}</p>
        <Link href="/passenger/dashboard" className="text-xs text-indigo-600 underline">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-slate-900">
              Request #{request._id.toString().slice(-6)}
            </h1>
            <StatusBadge
              status={(request.tripId as any)?.status || request.status}
              type="request"
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Submitted {formatCompanyTime(request.createdAt)}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/passenger/dashboard"
            className="text-xs text-slate-600 hover:text-slate-900 bg-white border border-slate-300 px-3 py-1.5 rounded-lg transition"
          >
            &larr; Back to Dashboard
          </Link>
          {(request.status === "pending" ||
            (request.status === "accepted" &&
              (!request.tripId || (request.tripId as any)?.status === "accepted"))) && (
            <button
              onClick={handleCancel}
              className="text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg transition"
            >
              Cancel Request
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Details & Manifest */}
        <div className="lg:col-span-7 space-y-6">
          {/* Trip Summary Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Transit Route & Time
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-[11px] text-slate-500 uppercase block font-semibold">Origin</span>
                <span className="font-bold text-slate-900">{request.originSnapshot.name}</span>
                <span className="text-xs text-slate-500 block">({request.originSnapshot.code})</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-[11px] text-slate-500 uppercase block font-semibold">Destination</span>
                <span className="font-bold text-slate-900">{request.destinationSnapshot.name}</span>
                <span className="text-xs text-slate-500 block">({request.destinationSnapshot.code})</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-[11px] text-slate-500 uppercase block font-semibold">Pickup Time (IST)</span>
                <span className="font-bold text-slate-900">{formatCompanyTime(request.pickupInstant)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <span className="text-[11px] text-slate-500 uppercase block font-semibold">Assigned Rider</span>
                <span className="font-bold text-slate-900">
                  {request.assignedRiderId ? (request.assignedRiderId as any).name : "Awaiting assignment"}
                </span>
              </div>
            </div>

            {request.notes && (
              <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-700">
                <span className="font-semibold block text-slate-500">Passenger Notes:</span>
                {request.notes}
              </div>
            )}
          </div>

          {/* Passenger Manifest */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Passenger Manifest ({request.passengerCount})
              </h3>
              <span className="text-xs text-slate-500">Named Passengers</span>
            </div>

            <div className="divide-y divide-slate-100">
              {request.manifest.map((member) => (
                <div key={member.memberId} className="py-2.5 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-slate-900">{member.name}</span>
                    {member.isFiler && (
                      <span className="ml-2 text-[10px] bg-indigo-50 text-indigo-700 font-semibold px-1.5 py-0.5 rounded">
                        Filer
                      </span>
                    )}
                    {member.email && (
                      <span className="text-xs text-slate-500 block">{member.email}</span>
                    )}
                  </div>
                  <div>
                    {member.userId ? (
                      <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium border border-emerald-200">
                        Account Linked
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-medium">
                        Guest
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Schematic Map */}
        <div className="lg:col-span-5 space-y-4">
          <SchematicMap
            locations={locations}
            activeOriginId={request.originId.toString()}
            activeDestinationId={request.destinationId.toString()}
            vehicleLocationId={request.originId.toString()}
            mode="demo"
          />
        </div>
      </div>
    </div>
  );
}
