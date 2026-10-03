"use client";

import React from "react";
import { ILocation } from "@/types";

interface SchematicMapProps {
  locations: ILocation[];
  activeOriginId?: string;
  activeDestinationId?: string;
  vehicleLocationId?: string;
  routeGeometry?: any;
  distance?: number;
  duration?: number;
  mode?: "demo" | "geographic";
}

export function SchematicMap({
  locations,
  activeOriginId,
  activeDestinationId,
  vehicleLocationId,
  distance,
  duration,
  mode = "demo",
}: SchematicMapProps) {
  // Normalize demo Cartesian coordinates to fit within a 600x400 viewBox
  const width = 600;
  const height = 400;
  const padding = 50;

  // Find min and max for scaling
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  locations.forEach((loc) => {
    if (loc.coordinateMode === "demo") {
      const coords = loc.coordinates as { x: number; y: number };
      if (coords && typeof coords.x === "number") {
        minX = Math.min(minX, coords.x);
        maxX = Math.max(maxX, coords.x);
        minY = Math.min(minY, coords.y);
        maxY = Math.max(maxY, coords.y);
      }
    }
  });

  if (minX === Infinity) {
    minX = 0;
    maxX = 500;
    minY = 0;
    maxY = 500;
  }

  // Avoid divide by zero if only one point
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const scaleX = (x: number) => padding + ((x - minX) / rangeX) * (width - 2 * padding);
  const scaleY = (y: number) => padding + ((y - minY) / rangeY) * (height - 2 * padding);

  // Get coordinates for active origin & destination
  const originLoc = locations.find((l) => l._id.toString() === activeOriginId);
  const destLoc = locations.find((l) => l._id.toString() === activeDestinationId);

  let originCoord: { x: number; y: number } | null = null;
  let destCoord: { x: number; y: number } | null = null;

  if (originLoc && originLoc.coordinateMode === "demo") {
    const c = originLoc.coordinates as { x: number; y: number };
    originCoord = { x: scaleX(c.x), y: scaleY(c.y) };
  }

  if (destLoc && destLoc.coordinateMode === "demo") {
    const c = destLoc.coordinates as { x: number; y: number };
    destCoord = { x: scaleX(c.x), y: scaleY(c.y) };
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-lg p-4 text-white">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-2">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
            Interactive Schematic Map ({mode.toUpperCase()} MODE)
          </h3>
        </div>
        <div className="text-xs text-slate-400">
          {distance !== undefined && (
            <span className="bg-slate-800 px-2.5 py-1 rounded-md text-emerald-400 font-mono font-medium">
              {distance} {mode === "demo" ? "demo units" : "km"} &bull; ~{duration} mins
            </span>
          )}
        </div>
      </div>

      <div className="relative w-full aspect-[3/2] bg-slate-950/80 rounded-lg flex items-center justify-center border border-slate-800/80">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Subtle grid lines */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="#1e293b"
                strokeWidth="1"
              />
            </pattern>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
            </marker>
          </defs>
          <rect width={width} height={height} fill="url(#grid)" />

          {/* Active Trip Route Line */}
          {originCoord && destCoord && (
            <g>
              <line
                x1={originCoord.x}
                y1={originCoord.y}
                x2={destCoord.x}
                y2={destCoord.y}
                stroke="#10b981"
                strokeWidth="3"
                strokeDasharray="6 4"
                markerEnd="url(#arrow)"
                className="transition-all duration-500"
              />
            </g>
          )}

          {/* Location Nodes */}
          {locations.map((loc) => {
            const isOrigin = loc._id.toString() === activeOriginId;
            const isDest = loc._id.toString() === activeDestinationId;
            const hasToto = loc._id.toString() === vehicleLocationId;

            let cx = width / 2;
            let cy = height / 2;

            if (loc.coordinateMode === "demo") {
              const c = loc.coordinates as { x: number; y: number };
              cx = scaleX(c.x);
              cy = scaleY(c.y);
            }

            return (
              <g key={loc._id.toString()} className="transition-transform duration-300">
                {/* Node outer ring */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isOrigin || isDest ? 14 : 9}
                  className={`${
                    isOrigin
                      ? "fill-indigo-500/20 stroke-indigo-400 stroke-2"
                      : isDest
                      ? "fill-emerald-500/20 stroke-emerald-400 stroke-2"
                      : "fill-slate-800 stroke-slate-500 stroke-1"
                  }`}
                />
                {/* Node core circle */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isOrigin || isDest ? 6 : 4}
                  className={`${
                    isOrigin
                      ? "fill-indigo-400"
                      : isDest
                      ? "fill-emerald-400"
                      : "fill-slate-300"
                  }`}
                />

                {/* Node Label */}
                <text
                  x={cx}
                  y={cy - 18}
                  textAnchor="middle"
                  className="fill-slate-200 text-[11px] font-semibold select-none drop-shadow"
                >
                  {loc.name} ({loc.code})
                </text>

                {/* Toto Vehicle indicator icon */}
                {hasToto && (
                  <g transform={`translate(${cx - 16}, ${cy + 12})`}>
                    <rect
                      x="0"
                      y="0"
                      width="32"
                      height="16"
                      rx="4"
                      fill="#f59e0b"
                      stroke="#fbbf24"
                      strokeWidth="1"
                    />
                    <text
                      x="16"
                      y="11"
                      textAnchor="middle"
                      className="fill-black text-[9px] font-extrabold select-none"
                    >
                      TOTO
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="absolute bottom-2 left-2 flex items-center space-x-3 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-md text-[11px] text-slate-300 backdrop-blur">
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block"></span>
            <span>Origin</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
            <span>Destination</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-3.5 h-2 rounded bg-amber-500 inline-block"></span>
            <span>Toto Position</span>
          </div>
        </div>
      </div>
    </div>
  );
}
