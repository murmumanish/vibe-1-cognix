"use client";

import React from "react";

interface StatusBadgeProps {
  status: string;
  type?: "request" | "trip" | "attendance";
}

export function StatusBadge({ status, type = "request" }: StatusBadgeProps) {
  let colorClasses = "bg-gray-100 text-gray-800 border-gray-300";
  let label = status.replace(/_/g, " ").toUpperCase();

  switch (status.toLowerCase()) {
    case "pending":
    case "unmarked":
      colorClasses = "bg-yellow-50 text-yellow-800 border-yellow-300";
      break;
    case "accepted":
      colorClasses = "bg-blue-50 text-blue-800 border-blue-300";
      break;
    case "picking_up":
      colorClasses = "bg-purple-50 text-purple-800 border-purple-300 animate-pulse";
      label = "PICKING UP";
      break;
    case "in_progress":
      colorClasses = "bg-indigo-50 text-indigo-800 border-indigo-300";
      label = "IN PROGRESS";
      break;
    case "completed":
    case "boarded":
    case "dropped":
      colorClasses = "bg-green-50 text-green-800 border-green-300";
      break;
    case "cancelled":
    case "missed":
    case "clashed":
      colorClasses = "bg-red-50 text-red-800 border-red-300";
      break;
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorClasses}`}
    >
      {label}
    </span>
  );
}
