import { Types } from "mongoose";

export type UserRole = "passenger" | "rider";

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISession {
  _id: Types.ObjectId;
  tokenHash: string;
  userId: Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type CoordinateMode = "demo" | "geographic";

export interface IDemoCoordinates {
  x: number;
  y: number;
}

export interface IGeographicCoordinates {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export interface ILocation {
  _id: Types.ObjectId;
  code: string;
  name: string;
  active: boolean;
  coordinateMode: CoordinateMode;
  coordinates: IDemoCoordinates | IGeographicCoordinates;
  coordinateVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export type VehicleOperationalState = "available" | "busy" | "maintenance";

export interface IVehicle {
  _id: Types.ObjectId;
  code: string;
  seatCapacity: number;
  currentLocationId: Types.ObjectId;
  activeTripId: Types.ObjectId | null;
  scheduleVersion: number;
  operationalState: VehicleOperationalState;
  createdAt: Date;
  updatedAt: Date;
}

export type BoardingStatus = "unmarked" | "boarded" | "missed";
export type DropoffStatus = "not_applicable" | "pending" | "dropped";

export interface IManifestMember {
  memberId: string;
  userId?: Types.ObjectId | null;
  name: string;
  email?: string;
  isFiler: boolean;
  boardingStatus: BoardingStatus;
  boardingMarkedAt?: Date | null;
  boardingMarkedBy?: Types.ObjectId | null;
  dropoffStatus: DropoffStatus;
  dropoffMarkedAt?: Date | null;
  dropoffMarkedBy?: Types.ObjectId | null;
}

export type RideRequestStatus =
  | "pending"
  | "accepted"
  | "picking_up"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "clashed";

export interface IClashRecord {
  riderId: Types.ObjectId;
  attemptedAt: Date;
  reason: string;
}

export interface IRideRequest {
  _id: Types.ObjectId;
  filerId: Types.ObjectId;
  originId: Types.ObjectId;
  destinationId: Types.ObjectId;
  originSnapshot: {
    code: string;
    name: string;
    coordinates: any;
    coordinateMode: CoordinateMode;
  };
  destinationSnapshot: {
    code: string;
    name: string;
    coordinates: any;
    coordinateMode: CoordinateMode;
  };
  pickupInstant: Date;
  latestPickupInstant: Date;
  passengerCount: number;
  manifest: IManifestMember[];
  notes?: string;
  status: RideRequestStatus;
  clashHistory: IClashRecord[];
  assignedRiderId: Types.ObjectId | null;
  tripId: Types.ObjectId | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export type ReservationStatus = "active" | "completed" | "cancelled";

export interface IReservation {
  _id: Types.ObjectId;
  vehicleId: Types.ObjectId;
  tripId: Types.ObjectId;
  reservedStart: Date;
  reservedEnd: Date;
  status: ReservationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type TripStatus =
  | "accepted"
  | "picking_up"
  | "in_progress"
  | "completed"
  | "cancelled";

export type CompletionReason = "normal" | "no_show" | "cancelled";

export interface IRouteStop {
  locationId: Types.ObjectId;
  name: string;
  type: "origin" | "destination" | "reposition";
  etaMinutes: number;
}

export interface IRouteSnapshot {
  distance: number;
  duration: number; // minutes
  mode: CoordinateMode;
  geometry: any;
  waypoints: any[];
  stops: IRouteStop[];
  originVersion: number;
  destinationVersion: number;
  calculatedAt: Date;
  provider: string;
}

export interface ITripLifecycle {
  acceptedAt: Date;
  pickupStartedAt?: Date | null;
  departedAt?: Date | null;
  completedAt?: Date | null;
  cancelledAt?: Date | null;
}

export interface ITrip {
  _id: Types.ObjectId;
  requestId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  riderId: Types.ObjectId;
  status: TripStatus;
  reservationId: Types.ObjectId;
  lifecycle: ITripLifecycle;
  manifest: IManifestMember[];
  routeSnapshot: IRouteSnapshot;
  completionReason?: CompletionReason;
  atRisk: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAuditEvent {
  _id: Types.ObjectId;
  actorId?: Types.ObjectId | null;
  entityType: string;
  entityId: string;
  action: string;
  before?: any;
  after?: any;
  idempotencyKey?: string;
  timestamp: Date;
}

export interface IIdempotencyRecord {
  _id: Types.ObjectId;
  actorId: Types.ObjectId;
  action: string;
  key: string;
  payloadHash: string;
  responseStatus: number;
  responseBody: any;
  expiresAt: Date;
  createdAt: Date;
}

export interface IRouteCache {
  _id: Types.ObjectId;
  cacheKey: string;
  mode: CoordinateMode;
  distance: number;
  duration: number;
  geometry: any;
  expiresAt: Date;
  createdAt: Date;
}

export interface IRateLimit {
  _id: Types.ObjectId;
  key: string;
  count: number;
  resetAt: Date;
}
