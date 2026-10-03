"use client";

import React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { IUser } from "@/types";

interface NavbarProps {
  user: IUser | null;
}

export function Navbar({ user }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (e) {
      console.error("Logout error", e);
    }
  }

  const isPassenger = user?.role === "passenger";
  const isRider = user?.role === "rider";

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold text-sm">
                XYZ
              </span>
              <span className="font-bold text-lg tracking-tight hover:text-indigo-400 transition">
                Internal Mobility Desk
              </span>
            </Link>
            <span className="hidden md:inline-block text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-mono">
              Toto Dispatch
            </span>
          </div>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center space-x-4">
            {isPassenger && (
              <>
                <Link
                  href="/passenger/dashboard"
                  className={`text-sm font-medium px-3 py-1.5 rounded-md transition ${
                    pathname.startsWith("/passenger/dashboard")
                      ? "bg-slate-800 text-indigo-400"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  My Requests
                </Link>
                <Link
                  href="/passenger/requests/new"
                  className={`text-sm font-medium px-3 py-1.5 rounded-md transition ${
                    pathname === "/passenger/requests/new"
                      ? "bg-slate-800 text-indigo-400"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Book Toto
                </Link>
                <Link
                  href="/passenger/history"
                  className={`text-sm font-medium px-3 py-1.5 rounded-md transition ${
                    pathname === "/passenger/history"
                      ? "bg-slate-800 text-indigo-400"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Travel History
                </Link>
              </>
            )}

            {isRider && (
              <>
                <Link
                  href="/rider/dashboard"
                  className={`text-sm font-medium px-3 py-1.5 rounded-md transition ${
                    pathname === "/rider/dashboard"
                      ? "bg-slate-800 text-indigo-400"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Queue & Trips
                </Link>
                <Link
                  href="/rider/schedule"
                  className={`text-sm font-medium px-3 py-1.5 rounded-md transition ${
                    pathname === "/rider/schedule"
                      ? "bg-slate-800 text-indigo-400"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Schedule & Itinerary
                </Link>
                <Link
                  href="/rider/clash-log"
                  className={`text-sm font-medium px-3 py-1.5 rounded-md transition ${
                    pathname === "/rider/clash-log"
                      ? "bg-slate-800 text-indigo-400"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  Clash Notifications
                </Link>
                <Link
                  href="/rider/history"
                  className={`text-sm font-medium px-3 py-1.5 rounded-md transition ${
                    pathname === "/rider/history"
                      ? "bg-slate-800 text-indigo-400"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  All Trips
                </Link>
              </>
            )}
          </nav>

          {/* User Status / Actions */}
          <div className="flex items-center space-x-3">
            {user ? (
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-200">{user.name}</div>
                  <span
                    className={`inline-block text-[10px] px-2 py-0.2 rounded font-semibold uppercase ${
                      user.role === "rider"
                        ? "bg-purple-900/60 text-purple-300 border border-purple-700"
                        : "bg-blue-900/60 text-blue-300 border border-blue-700"
                    }`}
                  >
                    {user.role}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-md transition border border-slate-700"
                >
                  Log out
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  href="/login"
                  className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-md"
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-3 py-1.5 rounded-md transition"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
