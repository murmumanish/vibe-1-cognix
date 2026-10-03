# Lawazia Tech - Internal Mobility Desk (Toto Fleet)

A complete, runnable, production-grade transit dispatch system built as a Next.js App Router monolith with MongoDB Atlas and Mongoose.

The desk serializes scheduling for Lawazia Tech's single passenger vehicle (**Toto**) between three core campus locations: **College**, **Station**, and **Office**.

---

## 1. Architecture Overview

### Single-Vehicle Serialization Point
Lawazia Tech operates exactly one physical Toto. To guarantee that:
1. Two conflicting requests cannot be double-booked, and
2. Exactly one trip may be physically active at any time,

correctness is enforced directly in MongoDB transactions using the **Vehicle document as an optimistic serialization lock**:
- Every schedule modification conditionally checks and increments `Vehicle.scheduleVersion`.
- Concurrent acceptance attempts on conflicting requests result in one committed transaction and a `409 Conflict` (Clash) for competing riders.
- Active trip state (`Vehicle.activeTripId`) is claimed conditionally (`findOneAndUpdate({ activeTripId: null })`). An active trip blocks any other trip from starting pickup.

### Key Monolith Modules
- **Authentication & Security (`src/lib/auth.ts`, `src/lib/csrf.ts`, `src/lib/rate-limit.ts`)**: Secure bcrypt hashing, opaque SHA-256 database-backed sessions, HttpOnly/SameSite cookies, CSRF validation on mutations, and DB-backed rate limiting.
- **Locations & Coordinates (`src/models/Location.ts`, `src/services/routing.service.ts`)**: Dynamic Cartesian demo coordinates and GeoJSON road routing (OSRM). Cached in `RouteCache` with coordinate revision invalidation.
- **Scheduling Service (`src/services/scheduling.service.ts`)**: ACID transactions with half-open reservation intervals `[reservedStart, reservedEnd)` and transfer repositioning feasibility checks.
- **Attendance & Lifecycle (`src/services/attendance.service.ts`)**: State machine transitions (`Accepted -> Picking Up -> In Progress -> Completed`), manifest attendance tracking (Boarded / Missed / Dropped), automatic no-show release, and manifest locking upon departure.
- **Passenger History Segregation (`src/app/api/history/me`)**: Strict isolation between **My Requests** (filed by user), **Named Trips** (user referenced on manifest), and **Travel History** (user actually boarded and was dropped).

---

## 2. Prerequisites & Cloud Database Setup

### Developer Prerequisites
- Node.js `v20.x`, `v22.x`, or `v24.x`
- npm `v10.x` or `v11.x`
- Free MongoDB Atlas account (M0 Sandbox or dedicated cluster)

### Configuring MongoDB Atlas
1. Log in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create or select a Cluster (Atlas clusters are replica sets by default, supporting multi-document ACID transactions).
3. **Database Access**: Under Security &rarr; Database Access, add a new database user (e.g. `desk_admin`) with Read/Write privileges (`readWriteAnyDatabase` or scoped to `internal_mobility_desk`).
4. **Network Access**: Under Security &rarr; Network Access, add IP Address `0.0.0.0/0` (Allow Access from Anywhere) or your local public IP.
5. **Connection String**: Under Deployment &rarr; Database &rarr; Connect &rarr; Drivers (Node.js), copy the connection string:
   ```
   mongodb+srv://<username>:<password>@cluster0.mongodb.net/internal_mobility_desk?retryWrites=true&w=majority
   ```

---

## 3. Environment Variables Configuration

Create a `.env` file in the root directory (based on `.env.example`):

```bash
# 1. MongoDB Connection
MONGODB_URI=mongodb+srv://desk_admin:YourSecurePassword@cluster0.mongodb.net/internal_mobility_desk?retryWrites=true&w=majority

# 2. Company Configuration
COMPANY_TIMEZONE=Asia/Kolkata
RIDER_INVITATION_CODE=TOTO_LAWAZIA_2026

# 3. Vehicle & Scheduling Parameters
VEHICLE_SEAT_CAPACITY=4
PICKUP_TOLERANCE_MINUTES=0
PICKUP_HANDLING_BUFFER_MINUTES=3
DROPOFF_HANDLING_BUFFER_MINUTES=2
SAFETY_BUFFER_MINUTES=5

# 4. Routing Provider Configuration
# "demo" (Schematic Cartesian Euclidean) or "geographic" (OSRM Road Network)
ROUTING_MODE=demo
OSRM_BASE_URL=https://router.project-osrm.org
DEMO_SPEED_UNITS_PER_MINUTE=15

# 5. Security & Session Settings
SESSION_SECRET=super_secret_session_key_internal_mobility_desk_2026
SESSION_EXPIRY_HOURS=24
NODE_ENV=development
```

---

## 4. Setup, Seeding, and Running Locally

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Seed Database and Build Indexes
Run the idempotent seed script to create all collections, unique indexes, seed the 3 default locations, instantiate the singleton `TOTO-1` vehicle, and create test accounts:
```bash
npm run seed
```

> **Pre-configured Test Accounts** (Password: `Password123!`):
> - **Passenger 1**: `alice@lawaziatech.com` (or `alice@xyz.com`)
> - **Passenger 2**: `bob@lawaziatech.com` (or `bob@xyz.com`)
> - **Passenger 3**: `charlie@lawaziatech.com` (or `charlie@xyz.com`)
> - **Company Rider 1**: `rider1@lawaziatech.com` (or `rider1@xyz.com`)
> - **Company Rider 2**: `rider2@lawaziatech.com` (or `rider2@xyz.com`)

### Step 3: Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 5. Verification & Automated Tests

Run the test suite covering the 14 mandatory concurrency, attendance, role, and interval edge cases:
```bash
npm test
```

### Build & Typecheck Verification
To verify the production build and Next.js bundle:
```bash
npm run build
```

---

## 6. Demo Walkthrough: Reproducing Core Checks

### Walkthrough 1: Concurrency Conflict & Clash Notification
1. Open an Incognito window and log in as `rider1@lawaziatech.com`.
2. In regular browser, log in as `alice@lawaziatech.com` and submit a request from **College &rarr; Station** for 2:00 PM.
3. As `bob@lawaziatech.com`, submit a request from **Station &rarr; Office** for the exact same time (2:00 PM).
4. As Rider 1, click **Accept & Schedule** on Alice's request &rarr; Request becomes `Accepted`, creating Trip #1.
5. In another session as Rider 2 (`rider2@lawaziatech.com`), attempt to accept Bob's request &rarr; Instantly rejected with a **`409 Conflict: Time conflict detected`** banner. Bob's request remains `Pending` with a recorded clash attempt in the clash log.

### Walkthrough 2: Group Manifest & Attendance Separation
1. Log in as `alice@lawaziatech.com` and book a group request for Alice, Bob, and Charlie.
2. Rider accepts and clicks **1. Start Pickup (Claim Vehicle)** &rarr; Toto is claimed (`operationalState: busy`).
3. In the Manifest table:
   - Mark Alice & Bob: `Boarded`
   - Mark Charlie: `Missed`
4. Click **2. Depart (Lock Manifest)** &rarr; Trip transitions to `In Progress`. Manifest is locked.
5. Mark Alice and Bob as `Dropped`. Click **3. Complete Trip & Release Vehicle**.
6. **Verify History Segregation**:
   - Alice & Bob see the ride in **Travel History** (boarded & dropped).
   - Charlie sees a `Missed` entry under **Named Trips**, but **no entry** in Travel History.
   - The Rider sees the full trip record with all 3 names and timestamps.

### Walkthrough 3: Single Vehicle Hijack Prevention & All-Missed No-Show
1. If Trip A is in progress, any attempt by another rider to start Trip B is blocked because `activeTripId` is locked.
2. If everyone misses pickup, the rider can depart with all no-shows &rarr; Toto is released immediately without requiring drop-offs.

---

## 7. Assumptions, Limitations & Future Extensions

- **Demo vs Geographic Mode**: Demo mode uses Cartesian straight-line schematic coordinates to run without internet dependency. Geographic mode connects to OSRM road services.
- **Guest Identity**: Manifest members without a verified account are treated as guests. Two guests with the same name maintain separate histories. Account linking for past guest rides requires a future claim verification flow outside this MVP.
- **Future Pooling**: Ride pooling is disabled in MVP to preserve explicit same-time conflict guarantees. Future pooling can be introduced with pickup-before-drop-off constraints and capacity checks.
