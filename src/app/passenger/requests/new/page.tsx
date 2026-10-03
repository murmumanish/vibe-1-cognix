"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ILocation } from "@/types";
import { SchematicMap } from "@/components/SchematicMap";
import { formatForDateTimeLocalInput } from "@/lib/date-utils";

interface PassengerRow {
  name: string;
  email: string;
  isFiler: boolean;
}

export default function NewRideRequestPage() {
  const router = useRouter();
  const [locations, setLocations] = useState<ILocation[]>([]);
  const [originId, setOriginId] = useState("");
  const [destinationId, setDestinationId] = useState("");

  // Default to 15 minutes from now in local company timezone
  const defaultPickupTime = new Date(Date.now() + 15 * 60 * 1000);
  const [pickupDatetime, setPickupDatetime] = useState(
    formatForDateTimeLocalInput(defaultPickupTime)
  );

  const [isTraveling, setIsTraveling] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [passengers, setPassengers] = useState<PassengerRow[]>([
    { name: "", email: "", isFiler: true },
  ]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load current user and locations
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setCurrentUser(data.user);
          setPassengers([{ name: data.user.name, email: data.user.email, isFiler: true }]);
        }
      });

    fetch("/api/locations")
      .then((res) => res.json())
      .then((data) => {
        if (data.locations && data.locations.length >= 2) {
          setLocations(data.locations);
          setOriginId(data.locations[0]._id);
          setDestinationId(data.locations[1]._id);
        }
      });
  }, []);

  function handleTravelingToggle(checked: boolean) {
    setIsTraveling(checked);
    if (!checked) {
      // Remove filer from traveling list, or set name to empty
      setPassengers((prev) =>
        prev.map((p) => (p.isFiler ? { name: "", email: "", isFiler: false } : p))
      );
    } else if (currentUser) {
      setPassengers((prev) => [
        { name: currentUser.name, email: currentUser.email, isFiler: true },
        ...prev.filter((p) => !p.isFiler),
      ]);
    }
  }

  function addPassenger() {
    if (passengers.length >= 4) {
      alert("Maximum Toto vehicle capacity is 4 passengers.");
      return;
    }
    setPassengers([...passengers, { name: "", email: "", isFiler: false }]);
  }

  function removePassenger(index: number) {
    if (passengers.length === 1) return;
    setPassengers(passengers.filter((_, i) => i !== index));
  }

  function updatePassenger(index: number, field: keyof PassengerRow, value: any) {
    const next = [...passengers];
    next[index] = { ...next[index], [field]: value };
    setPassengers(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (originId === destinationId) {
      setError("Origin and Destination cannot be the same location.");
      return;
    }

    const invalidMember = passengers.find((p) => !p.name.trim());
    if (invalidMember) {
      setError("Every passenger in the manifest must have a non-blank name.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originId,
          destinationId,
          pickupDatetime,
          manifest: passengers,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create ride request.");
      }

      router.push(`/passenger/requests/${data.request._id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Book Toto Ride</h1>
        <p className="text-sm text-slate-500">
          Submit an individual or group request between College, Station, and Office.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Column */}
        <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Origin & Destination Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Pickup Origin (From)
                </label>
                <select
                  value={originId}
                  onChange={(e) => setOriginId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                >
                  {locations.map((loc) => (
                    <option key={loc._id.toString()} value={loc._id.toString()}>
                      {loc.name} ({loc.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Drop-off Destination (To)
                </label>
                <select
                  value={destinationId}
                  onChange={(e) => setDestinationId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                >
                  {locations.map((loc) => (
                    <option key={loc._id.toString()} value={loc._id.toString()}>
                      {loc.name} ({loc.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Pickup Date & Time */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Requested Pickup Date & Time (Company Timezone - IST)
              </label>
              <input
                type="datetime-local"
                value={pickupDatetime}
                onChange={(e) => setPickupDatetime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">
                All requests are converted and scheduled in UTC server-side. Earliest pickup time is strictly guaranteed.
              </p>
            </div>

            {/* Filer traveling checkbox */}
            <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
              <input
                type="checkbox"
                id="isTraveling"
                checked={isTraveling}
                onChange={(e) => handleTravelingToggle(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <label htmlFor="isTraveling" className="text-sm font-medium text-slate-800">
                I am traveling in this Toto group
              </label>
            </div>

            {/* Named Passenger Manifest */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Named Passenger Manifest ({passengers.length}/4)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Every passenger must be named. Enter email to link registered accounts.
                  </p>
                </div>
                {passengers.length < 4 && (
                  <button
                    type="button"
                    onClick={addPassenger}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md transition"
                  >
                    + Add Passenger
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {passengers.map((p, index) => (
                  <div
                    key={index}
                    className="flex flex-col sm:flex-row items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm"
                  >
                    <div className="w-full sm:flex-1">
                      <input
                        type="text"
                        placeholder="Full Name *"
                        value={p.name}
                        onChange={(e) => updatePassenger(index, "name", e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        required
                      />
                    </div>
                    <div className="w-full sm:flex-1">
                      <input
                        type="email"
                        placeholder="Account Email (optional for guests)"
                        value={p.email}
                        onChange={(e) => updatePassenger(index, "email", e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    {passengers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePassenger(index)}
                        className="text-xs text-red-600 hover:text-red-800 px-2 py-1"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Optional Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Optional Ride Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Carrying equipment box, waiting near gate 2"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm shadow-sm transition disabled:opacity-50"
            >
              {loading ? "Submitting Request..." : "Submit Ride Request"}
            </button>
          </form>
        </div>

        {/* Map Preview Column */}
        <div className="lg:col-span-5 space-y-4">
          <SchematicMap
            locations={locations}
            activeOriginId={originId}
            activeDestinationId={destinationId}
            vehicleLocationId={locations[0]?._id.toString()}
            mode="demo"
          />

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 space-y-1">
            <h4 className="font-bold flex items-center space-x-1">
              <span>⚠️</span>
              <span>Important Single-Vehicle Policy</span>
            </h4>
            <p>
              XYZ Company operates exactly one Toto vehicle. Submitting a request does not guarantee instant acceptance if a conflicting reservation exists. You will be notified immediately upon acceptance or clash.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
