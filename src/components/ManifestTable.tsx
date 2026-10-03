"use client";

import React, { useState } from "react";
import { IManifestMember, TripStatus } from "@/types";
import { StatusBadge } from "./StatusBadge";
import { formatCompanyTime } from "@/lib/date-utils";

interface ManifestTableProps {
  tripId: string;
  tripStatus: TripStatus;
  manifest: IManifestMember[];
  isAssignedRider: boolean;
  onRefresh: () => void;
}

export function ManifestTable({
  tripId,
  tripStatus,
  manifest,
  isAssignedRider,
  onRefresh,
}: ManifestTableProps) {
  const [loadingMemberId, setLoadingMemberId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canMarkBoarding = isAssignedRider && tripStatus === "picking_up";
  const canMarkDropoff = isAssignedRider && tripStatus === "in_progress";

  async function handleBoarding(memberId: string, status: "boarded" | "missed") {
    setError(null);
    setLoadingMemberId(memberId);
    try {
      const res = await fetch(`/api/trips/${tripId}/passengers/${memberId}/boarding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update boarding status.");
      }
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingMemberId(null);
    }
  }

  async function handleDropoff(memberId: string) {
    setError(null);
    setLoadingMemberId(memberId);
    try {
      const res = await fetch(`/api/trips/${tripId}/passengers/${memberId}/dropoff`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to record dropoff.");
      }
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingMemberId(null);
    }
  }

  async function handleBatchBoarding(status: "boarded" | "missed") {
    setError(null);
    const unmarked = manifest.filter((m) => m.boardingStatus === "unmarked");
    if (unmarked.length === 0) return;
    try {
      await Promise.all(
        unmarked.map((m) =>
          fetch(`/api/trips/${tripId}/passengers/${m.memberId}/boarding`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          })
        )
      );
      onRefresh();
    } catch (err: any) {
      setError(err.message || "Failed to update attendance.");
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Passenger Manifest & Attendance</h3>
          <p className="text-xs text-gray-500">
            {tripStatus === "picking_up" && "Mark attendance during pickup. Manifest locks upon departure."}
            {tripStatus === "in_progress" && "Trip in transit. Record drop-off when passengers arrive at destination."}
            {tripStatus === "completed" && "Trip completed. Attendance history is locked."}
            {tripStatus === "accepted" && "Trip scheduled. Start pickup to open the attendance register."}
          </p>
        </div>
        <div className="text-xs font-medium text-gray-600 bg-gray-100 px-3 py-1 rounded-md">
          {manifest.length} Named Passenger{manifest.length === 1 ? "" : "s"}
        </div>
      </div>

      {tripStatus === "picking_up" && isAssignedRider && (
        <div className="bg-amber-50/70 border-b border-amber-200/80 px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <span className="text-amber-800">
            <strong>Attendance Rule:</strong> Did someone not show up? Mark them <strong>Missed</strong>. To depart, every passenger must be marked either <em>Boarded</em> or <em>Missed</em>.
          </span>
          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => handleBatchBoarding("boarded")}
              className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded font-medium shadow-sm transition"
            >
              Board All Unmarked
            </button>
            <button
              type="button"
              onClick={() => handleBatchBoarding("missed")}
              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded font-medium shadow-sm transition"
            >
              Mark Remaining Missed
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="m-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
          <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3">Passenger</th>
              <th className="px-6 py-3">Account Type</th>
              <th className="px-6 py-3">Boarding Status</th>
              <th className="px-6 py-3">Drop-off Status</th>
              {isAssignedRider && (tripStatus === "picking_up" || tripStatus === "in_progress") && (
                <th className="px-6 py-3 text-right">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {manifest.map((member) => (
              <tr key={member.memberId} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">{member.name}</div>
                  {member.email && (
                    <div className="text-xs text-gray-500">{member.email}</div>
                  )}
                  {member.isFiler && (
                    <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-1.5 py-0.5 rounded">
                      Filer
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-xs text-gray-600">
                  {member.userId ? (
                    <span className="inline-flex items-center text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-medium border border-emerald-200">
                      Verified Account
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200">
                      Guest Passenger
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={member.boardingStatus} type="attendance" />
                  {member.boardingMarkedAt && (
                    <div className="text-[11px] text-gray-400 mt-1">
                      {formatCompanyTime(member.boardingMarkedAt, "hh:mm a")}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={member.dropoffStatus} type="attendance" />
                  {member.dropoffMarkedAt && (
                    <div className="text-[11px] text-gray-400 mt-1">
                      {formatCompanyTime(member.dropoffMarkedAt, "hh:mm a")}
                    </div>
                  )}
                </td>
                {isAssignedRider && (tripStatus === "picking_up" || tripStatus === "in_progress") && (
                  <td className="px-6 py-4 text-right">
                    {canMarkBoarding && (
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          disabled={loadingMemberId === member.memberId}
                          onClick={() => handleBoarding(member.memberId, "boarded")}
                          className={`text-xs px-2.5 py-1 rounded font-medium transition ${
                            member.boardingStatus === "boarded"
                              ? "bg-green-600 text-white"
                              : "bg-green-50 text-green-700 hover:bg-green-100 border border-green-300"
                          }`}
                        >
                          Board
                        </button>
                        <button
                          disabled={loadingMemberId === member.memberId}
                          onClick={() => handleBoarding(member.memberId, "missed")}
                          className={`text-xs px-2.5 py-1 rounded font-medium transition ${
                            member.boardingStatus === "missed"
                              ? "bg-red-600 text-white"
                              : "bg-red-50 text-red-700 hover:bg-red-100 border border-red-300"
                          }`}
                        >
                          Missed
                        </button>
                      </div>
                    )}

                    {canMarkDropoff && member.boardingStatus === "boarded" && (
                      <div className="flex items-center justify-end">
                        {member.dropoffStatus !== "dropped" ? (
                          <button
                            disabled={loadingMemberId === member.memberId}
                            onClick={() => handleDropoff(member.memberId)}
                            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-3 py-1 rounded transition"
                          >
                            Mark Dropped
                          </button>
                        ) : (
                          <span className="text-xs text-green-600 font-semibold flex items-center">
                            ✓ Dropped Off
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
