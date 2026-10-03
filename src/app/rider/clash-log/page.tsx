"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { formatCompanyTime } from "@/lib/date-utils";

export default function ClashLogPage() {
  const [clashRequests, setClashRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/rider/history")
      .then((res) => res.json())
      .then((data) => {
        setClashRequests(data.clashRequests || []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Schedule Clash & Conflict Log</h1>
          <p className="text-sm text-slate-500">
            Immutable log of concurrent acceptance conflicts, interval collisions, and transfer rejections.
          </p>
        </div>

        <Link
          href="/rider/dashboard"
          className="text-xs bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3.5 py-2 rounded-lg transition"
        >
          &larr; Operations Desk
        </Link>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500 text-sm">Loading clash log...</div>
      ) : clashRequests.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto font-bold">
            ✓
          </div>
          <h3 className="text-base font-semibold text-slate-800">No schedule clashes recorded</h3>
          <p className="text-xs text-slate-500">
            All ride requests have been scheduled without conflicting reservations or repositioning infeasibilities.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {clashRequests.map((req) => (
            <div
              key={req._id}
              className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden"
            >
              <div className="p-4 bg-red-50/60 border-b border-red-100 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 text-sm">
                    {req.originSnapshot?.name} &rarr; {req.destinationSnapshot?.name}
                  </span>
                  <span className="text-xs text-slate-500 ml-2">
                    (Filer: {req.filerId?.name || "Passenger"})
                  </span>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                  {req.clashHistory?.length} Clash Event{req.clashHistory?.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="p-4 divide-y divide-slate-100 space-y-3">
                {req.clashHistory?.map((clash: any, idx: number) => (
                  <div key={idx} className="pt-2 first:pt-0 text-xs text-slate-700 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">
                        Attempted by: {clash.riderId?.name || "Rider"}
                      </span>
                      <span className="text-slate-400">
                        {formatCompanyTime(clash.attemptedAt)}
                      </span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded text-red-800 border border-slate-200 font-mono text-[11px]">
                      {clash.reason}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
