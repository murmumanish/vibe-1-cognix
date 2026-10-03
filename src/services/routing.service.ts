import { ILocation, IRouteSnapshot, CoordinateMode } from "@/types";
import { RouteCache } from "@/models/RouteCache";
import { RouteUnavailableError } from "@/lib/errors";

const ROUTING_MODE = (process.env.ROUTING_MODE || "demo") as CoordinateMode;
const OSRM_BASE_URL = process.env.OSRM_BASE_URL || "https://router.project-osrm.org";
const DEMO_SPEED_UNITS_PER_MINUTE = parseFloat(process.env.DEMO_SPEED_UNITS_PER_MINUTE || "15");

interface RouteResult {
  distance: number; // km in geographic, units in demo
  duration: number; // minutes
  geometry: any;
  waypoints: any[];
  mode: CoordinateMode;
  provider: string;
}

/**
 * Calculates Euclidean distance between two 2D Cartesian points
 */
function calculateEuclideanDistance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.round(Math.sqrt(dx * dx + dy * dy) * 10) / 10;
}

/**
 * Computes demo mode route using Cartesian coordinates
 */
function computeDemoRoute(fromLoc: ILocation, toLoc: ILocation): RouteResult {
  const c1 = fromLoc.coordinates as { x: number; y: number };
  const c2 = toLoc.coordinates as { x: number; y: number };

  if (typeof c1.x !== "number" || typeof c2.x !== "number") {
    throw new Error("Invalid Cartesian coordinates for demo routing.");
  }

  const distance = calculateEuclideanDistance(c1.x, c1.y, c2.x, c2.y);
  // Duration in minutes = distance / speed, rounded up to at least 2 minutes
  const duration = Math.max(2, Math.ceil(distance / DEMO_SPEED_UNITS_PER_MINUTE));

  return {
    distance,
    duration,
    geometry: {
      type: "LineString",
      coordinates: [
        [c1.x, c1.y],
        [c2.x, c2.y],
      ],
    },
    waypoints: [
      { name: fromLoc.name, coordinates: [c1.x, c1.y] },
      { name: toLoc.name, coordinates: [c2.x, c2.y] },
    ],
    mode: "demo",
    provider: "schematic-euclidean",
  };
}

/**
 * Computes geographic route via OSRM HTTP API
 */
async function computeGeographicRoute(fromLoc: ILocation, toLoc: ILocation): Promise<RouteResult> {
  const c1 = fromLoc.coordinates as { type: "Point"; coordinates: [number, number] };
  const c2 = toLoc.coordinates as { type: "Point"; coordinates: [number, number] };

  if (!c1?.coordinates || !c2?.coordinates) {
    throw new RouteUnavailableError("Missing GeoJSON coordinates for geographic routing.");
  }

  const [lng1, lat1] = c1.coordinates;
  const [lng2, lat2] = c2.coordinates;

  // OSRM format: /route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=full&geometries=geojson
  const url = `${OSRM_BASE_URL}/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new RouteUnavailableError(
        `Routing provider returned status ${res.status}: ${res.statusText}`
      );
    }

    const data = await res.json();
    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      throw new RouteUnavailableError(
        `OSRM routing failed: ${data.message || "No feasible route found"}`
      );
    }

    const route = data.routes[0];
    const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
    const durationMinutes = Math.max(2, Math.ceil(route.duration / 60));

    return {
      distance: distanceKm,
      duration: durationMinutes,
      geometry: route.geometry,
      waypoints: data.waypoints || [],
      mode: "geographic",
      provider: "osrm",
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new RouteUnavailableError("Routing provider request timed out.");
    }
    throw new RouteUnavailableError(`Geographic route calculation failed: ${err.message}`);
  }
}

/**
 * Gets or calculates route between two locations, using RouteCache with coordinate revisions
 */
export async function calculateRoute(
  fromLoc: ILocation,
  toLoc: ILocation
): Promise<RouteSnapshotResult> {
  const mode = fromLoc.coordinateMode === "geographic" && toLoc.coordinateMode === "geographic"
    ? "geographic"
    : "demo";

  const cacheKey = `${fromLoc._id}_v${fromLoc.coordinateVersion}_to_${toLoc._id}_v${toLoc.coordinateVersion}_${mode}`;

  // Check cache
  const cached = await RouteCache.findOne({
    cacheKey,
    expiresAt: { $gt: new Date() },
  });

  let route: RouteResult;

  if (cached) {
    route = {
      distance: cached.distance,
      duration: cached.duration,
      geometry: cached.geometry,
      waypoints: [],
      mode: cached.mode,
      provider: "cache",
    };
  } else {
    if (mode === "demo") {
      route = computeDemoRoute(fromLoc, toLoc);
    } else {
      route = await computeGeographicRoute(fromLoc, toLoc);
    }

    // Cache result for 24 hours
    await RouteCache.findOneAndUpdate(
      { cacheKey },
      {
        cacheKey,
        mode,
        distance: route.distance,
        duration: route.duration,
        geometry: route.geometry,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      { upsert: true }
    ).catch((err) => console.warn("Cache write warning:", err));
  }

  const snapshot: IRouteSnapshot = {
    distance: route.distance,
    duration: route.duration,
    mode: route.mode,
    geometry: route.geometry,
    waypoints: route.waypoints,
    stops: [
      {
        locationId: fromLoc._id,
        name: fromLoc.name,
        type: "origin",
        etaMinutes: 0,
      },
      {
        locationId: toLoc._id,
        name: toLoc.name,
        type: "destination",
        etaMinutes: route.duration,
      },
    ],
    originVersion: fromLoc.coordinateVersion,
    destinationVersion: toLoc.coordinateVersion,
    calculatedAt: new Date(),
    provider: route.provider,
  };

  return { route, snapshot };
}

export interface RouteSnapshotResult {
  route: RouteResult;
  snapshot: IRouteSnapshot;
}
