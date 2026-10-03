import React from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      {/* Hero Banner */}
      <div className="text-center space-y-4 mb-12">
        <div className="inline-flex items-center space-x-2 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full text-xs font-semibold text-indigo-700">
          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping"></span>
          <span>Official Lawazia Tech Monolith &bull; Real-time Toto Dispatch</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
          Lawazia Tech Internal Mobility Desk
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Dedicated campus transit system connecting <span className="font-semibold text-slate-800">College</span>,{" "}
          <span className="font-semibold text-slate-800">Station</span>, and{" "}
          <span className="font-semibold text-slate-800">Office</span>. Single vehicle, concurrency-protected scheduling, and verifiable attendance.
        </p>

        {user ? (
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            {user.role === "passenger" ? (
              <>
                <Link
                  href="/passenger/requests/new"
                  className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition"
                >
                  Book Toto Ride &rarr;
                </Link>
                <Link
                  href="/passenger/dashboard"
                  className="w-full sm:w-auto px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-medium rounded-lg shadow-sm transition"
                >
                  View My Requests
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/rider/dashboard"
                  className="w-full sm:w-auto px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg shadow-sm transition"
                >
                  Enter Rider Console &rarr;
                </Link>
                <Link
                  href="/rider/schedule"
                  className="w-full sm:w-auto px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-medium rounded-lg shadow-sm transition"
                >
                  View Day Itinerary
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition"
            >
              Sign In to Your Account
            </Link>
            <Link
              href="/register"
              className="w-full sm:w-auto px-6 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-medium rounded-lg shadow-sm transition"
            >
              Register (Passenger or Rider)
            </Link>
          </div>
        )}
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
            01
          </div>
          <h3 className="font-bold text-slate-900">One Physical Toto</h3>
          <p className="text-sm text-slate-600">
            Strict single-vehicle serialization. Exactly one trip physically active at a time, preventing double bookings and vehicle hijacking.
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
            02
          </div>
          <h3 className="font-bold text-slate-900">ACID Concurrency</h3>
          <p className="text-sm text-slate-600">
            Database-backed transactions with optimistic versioning. Simultaneous acceptance attempts guarantee one winner and a 409 clash alert.
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700 font-bold">
            03
          </div>
          <h3 className="font-bold text-slate-900">Verifiable Attendance</h3>
          <p className="text-sm text-slate-600">
            Named passenger manifest. Records boarding, no-shows, and drop-offs with immutable audit trails. Filer and passenger histories stay separated.
          </p>
        </div>
      </div>
    </div>
  );
}
