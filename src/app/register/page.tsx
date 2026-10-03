"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<"passenger" | "rider">("passenger");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload: any = {
        name,
        email,
        password,
        role,
      };

      if (role === "rider") {
        payload.invitationCode = invitationCode;
      }

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Registration failed.");
      }

      if (data.user.role === "rider") {
        router.push("/rider/dashboard");
      } else {
        router.push("/passenger/dashboard");
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto my-12 bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Create an Account</h2>
        <p className="text-sm text-slate-500 mt-1">Register for Lawazia Tech Mobility</p>
      </div>

      {/* Role Selector Tabs */}
      <div className="flex border border-slate-200 rounded-lg p-1 bg-slate-50 mb-6">
        <button
          type="button"
          onClick={() => setRole("passenger")}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
            role === "passenger"
              ? "bg-white text-indigo-700 shadow-sm border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Passenger
        </button>
        <button
          type="button"
          onClick={() => setRole("rider")}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition ${
            role === "rider"
              ? "bg-white text-purple-700 shadow-sm border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Company Rider
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Full Name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            placeholder="e.g. Alice Smith"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Email Address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            placeholder="alice@lawaziatech.com"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Password (min 6 chars)
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            placeholder="••••••••"
          />
        </div>

        {role === "rider" && (
          <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 space-y-2">
            <label className="block text-xs font-semibold text-purple-900 uppercase tracking-wider">
              Company Rider Invitation Code
            </label>
            <input
              type="text"
              required
              value={invitationCode}
              onChange={(e) => setInvitationCode(e.target.value)}
              className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white"
              placeholder="Enter company invitation code"
            />
            <p className="text-[11px] text-purple-700">
              Rider registration requires a verified company authorization code (configured in RIDER_INVITATION_CODE).
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-2.5 px-4 font-medium rounded-lg text-sm shadow-sm transition disabled:opacity-50 text-white ${
            role === "rider"
              ? "bg-purple-600 hover:bg-purple-700"
              : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          {loading
            ? "Creating account..."
            : `Register as ${role === "rider" ? "Company Rider" : "Passenger"}`}
        </button>
      </form>

      <div className="mt-6 text-center text-xs text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="text-indigo-600 font-semibold hover:underline">
          Sign In
        </Link>
      </div>
    </div>
  );
}
