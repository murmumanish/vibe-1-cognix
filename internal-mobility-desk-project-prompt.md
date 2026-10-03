# Project prompt: Internal Mobility Desk

## 1. Your assignment

Build a complete, runnable Internal Mobility Desk for XYZ Company. Use a **Next.js monolith**, **MongoDB Atlas**, and **Mongoose**. Implement the application, database models, UI, authentication, routing, concurrency protection, tests, seed script, and setup documentation. Do not deliver only a mockup or architecture proposal.

XYZ Company has one Toto: a small passenger vehicle. Students and employees request rides between College, Station, and Office. A request can be for one person or a group submitted by one person. Every passenger must be named. Multiple registered riders can manage requests, but they share the same physical Toto. The vehicle can execute only one trip at a time.

The desk must record who actually boarded, who missed pickup, and who was dropped off. Preserve this history after completion.

## 2. Required technology and boundaries

- Next.js App Router and TypeScript, with frontend and backend in one repository and deployment.
- Next.js Route Handlers for HTTP endpoints; shared server-side services for business logic.
- MongoDB Atlas with Mongoose for all persistence. Run database code in the Node.js runtime.
- Use a reusable, cached Mongoose connection suitable for development reloads and deployment instances.
- No separate Express server, microservices, Firebase, Supabase, or hosted authentication service.
- Interpret “no SDK” as no vendor SDKs for maps, directions, authentication, or backend services. Mongoose is explicitly required and allowed. Ordinary validation, password hashing, testing, and UI libraries are allowed.
- Call routing providers through standard server-side `fetch` and documented HTTP APIs.
- Use an SVG map for the initial coordinate schematic. A map-rendering library is optional if documented separately; do not make an external map SDK necessary to run the MVP.
- Keep secrets exclusively on the server. Commit an `.env.example`, never real credentials.
- Use compatible stable dependency versions at implementation time and commit a lockfile.

Prerequisites for the developer: a GitHub account, a supported Node.js installation, and a free MongoDB Atlas database. Explain database user creation, network access configuration, and connection-string setup in the README. Do not assume GitHub authentication is required for passengers.

## 3. Roles, registration, and login

Implement **registration and login for both passenger and rider**, with a clear role selector.

### Passenger

- Register with full name, unique normalized email, and password.
- Log in, log out, and access only passenger-authorized pages and endpoints.
- Create individual or group requests, view request status, cancel eligible requests, and view personal history.

### Rider

- Register with full name, unique normalized email, password, and a configurable company rider invitation code.
- Validate the invitation code server-side; store its configuration in an environment variable. It is not a third application role.
- Log in and view all requests, the Toto schedule, assigned trips, manifests, maps, and all trip history.
- Accept requests. Only the rider assigned to a trip may start it, mark its passengers, or complete it.
- Multiple rider accounts must be supported even though there is only one vehicle.

Use secure password hashing, opaque database-backed sessions, HttpOnly cookies, production Secure cookies, appropriate SameSite settings, session expiry, and server-side role checks. Protect cookie-authenticated mutations against CSRF, rate-limit authentication endpoints, and never expose password hashes or session tokens in responses. Use database-backed rate limits if enforcement must work across instances.

Do not permit client payloads to set approval, assignment, boarding, or completion fields. Public rider registration must require the invitation code; do not grant operational privileges merely because a client sends `role: rider`.

## 4. Locations and coordinates

Initially offer exactly three active locations in both From and To selectors:

1. College
2. Station
3. Office

Store locations in MongoDB, not in hardcoded dropdown arrays. Each location has a stable ID, unique code, display name, active flag, and coordinates. Reject requests where From equals To or either location is inactive.

Support two explicitly distinct coordinate modes:

- **Geographic mode:** real longitude and latitude, stored as GeoJSON Point `[longitude, latitude]`. Validate longitude and latitude ranges. Use these coordinates for road routing.
- **Demo mode:** arbitrary Cartesian `x, y` coordinates, used only for a schematic map and Euclidean distance. Clearly label distances as demo units, not kilometers, and never send these values to a geographic routing provider.

Seed only the three named locations with clearly labeled demo coordinates. Provide a configuration/import script for real coordinates and adding more locations without code changes. Do not invent real campus addresses or coordinates.

Do not hardcode a distance lookup such as `College-Station: 5`. Calculate costs from coordinates and routing data. Any cost table generated during route optimization must be dynamic, keyed by location IDs and coordinate revisions, and rebuildable when locations change.

## 5. Request form and passenger identity

The request form must collect:

- From location.
- To location.
- Requested pickup date and time.
- Passenger count.
- Every passenger's full name and a stable identity where available.
- Optional notes.

One authenticated passenger submits the entire group. All members of one group share that request's From, To, and pickup time. Separate requests are needed for different origins or destinations.

Derive passenger count from the submitted manifest and validate any displayed count against it. Enforce a configurable vehicle seat capacity; do not assume a particular Toto capacity. Reject empty manifests, blank names, duplicate registered passenger IDs, past pickup times, and groups larger than capacity. Include the filer by default but allow them to file for others without claiming they are traveling.

**Names are display values, not account identifiers.** For registered passengers, resolve a supplied email or company/student identifier on the server and store their User ID with a snapshot of their name. Avoid exposing an unrestricted passenger directory. Unregistered guests may have a name and a generated manifest-member ID; they remain visible in the request and rider history but cannot automatically receive account history by matching names.

If two people have the same name, their histories must stay separate. A later guest-to-account link needs a verified claim process and is outside the MVP. Include this limitation in the UI and README.

## 6. Trip scheduling: explicit MVP rules

For the MVP, **one accepted request creates one trip**. A group is one trip with multiple manifest members.

- Multiple requests may be submitted for the same time.
- Only one conflicting request can be accepted for the Toto.
- Two riders accepting conflicting requests concurrently must produce exactly one committed acceptance; the loser receives `409 Conflict` and a clear clash message.
- Two riders accepting the same request concurrently must produce one assignment and one trip.
- Different future requests may be accepted if their reservation intervals and vehicle repositioning requirements are feasible.
- Exactly one trip may be physically active at any time.

Treat requested pickup time as the earliest promised pickup, with a configurable latest-pickup tolerance, defaulting to zero until the company configures it. Keep all stored instants in UTC and display times in the configured company timezone, initially `Asia/Kolkata`.

Reserve a half-open interval `[reservedStart, reservedEnd)` covering pickup handling, estimated passenger travel, drop-off handling, and configured safety buffer. A timestamp alone is insufficient. Check transfer time from the previous trip's destination to the next pickup as well. Exact same-time requests always clash under the MVP rule.

After acceptance, show the request as Accepted and identify its rider. A failed acceptance stays Pending with a recorded clash attempt; show a Clash notification rather than permanently rejecting a request that might later be accepted or rescheduled.

**Do not silently introduce ride pooling.** The requirement “two requests, same time: one accepted, one clash” is incompatible with automatically accepting both into a shared trip. Optimize the feasible itinerary across accepted trips. Future pooling may be added as an explicit separate mode with capacity, pickup-before-drop-off, and time-window constraints, but leave it disabled in the MVP.

## 7. Concurrency and database guarantees

Correctness must live in MongoDB, not only in the UI, one Node process, or an in-memory mutex.

Use a single seeded Vehicle document as the serialization point for mutations that affect that Toto's schedule. Suggested fields: `scheduleVersion`, `activeTripId`, `currentLocationId`, `seatCapacity`, and operational state. Keep reservations as indexed separate documents; do not grow an unlimited schedule array on the vehicle.

Acceptance must use a Mongoose/MongoDB transaction that:

1. Conditionally claims the expected Vehicle `scheduleVersion` and increments it, writing the shared Vehicle document so concurrent schedule mutations conflict.
2. Re-reads and validates the pending request, actor, schedule, interval overlap, repositioning, and route-input versions within the transaction.
3. Conditionally changes the request from Pending to Accepted and assigns the rider.
4. Creates the trip, manifest snapshots, reservation, and acceptance audit event.
5. Commits all related changes together.

Compute remote routing results **outside** the transaction. Within the transaction, verify the schedule and coordinate versions used by that calculation. If they changed, recalculate and retry with a bounded policy. Do not hold a transaction open during network calls.

All accept, cancel, start, complete, and reschedule paths must respect the same Vehicle serialization protocol. A transaction alone does not prevent two conflicting inserts if they only read availability and write different trip documents.

Add a unique index on trip `requestId` and an index supporting vehicle/reservation interval queries. A unique `(vehicleId, pickupTime)` index alone does not prevent overlapping intervals and is not an adequate solution.

Use an atomic conditional vehicle update when starting a trip: an existing `activeTripId` must prevent another trip from starting. Handle write conflicts and duplicate keys with bounded retries and domain-specific errors. After a retry, re-evaluate availability instead of blindly repeating the original write.

Use durable idempotency keys for acceptance and completion, scoped to actor and action with unique indexes and payload validation. Duplicate HTTP submissions must not create duplicate trips or audit events. Transactions must not execute independent operations in parallel on the same session.

## 8. Rider workflow and attendance

Trip lifecycle:

`Accepted -> Picking Up -> In Progress -> Completed`

Allow cancellation before the trip starts. Define and enforce permitted transitions server-side. Do not release an active Toto merely because an estimated reservation expires.

1. **Accept:** validate availability, assign the rider, reserve time, and create the route plan.
2. **Start pickup:** claim the active vehicle and open the named manifest.
3. **Mark each member:** Boarded or Missed, with timestamp and acting rider ID. Each member begins Unmarked.
4. **Depart:** require every member to be Boarded or Missed. If everyone missed, allow an explicit no-show completion that releases the vehicle and records zero transported passengers.
5. **Drop off:** mark each boarded member Dropped with timestamp. A missed person cannot be dropped.
6. **Done:** require every boarded person to be dropped; atomically complete the trip, close its reservation, update vehicle location, and clear its active trip reference.

Keep boarding and drop-off as separate facts: `boardingStatus` is Unmarked, Boarded, or Missed; `dropoffStatus` is NotApplicable, Pending, or Dropped. Do not overwrite the fact that a person boarded when recording their drop-off.

Allow attendance corrections only during pickup, with an append-only audit event. Lock the manifest after departure. Do not remove people or rewrite completed history to make counts match.

If a trip runs late, flag subsequent bookings as At Risk. Block starting another trip while the Toto remains active, show a revised itinerary, and require explicit rescheduling/cancellation where needed; do not silently alter accepted pickup promises.

## 9. Route optimization and map

On acceptance, produce a saved route plan and map showing the Toto's configured/current location, the pickup, destination, route segments, estimated distance/duration, and stops in sequence.

For multiple accepted future requests, optimize the vehicle itinerary across the selected service day or bounded planning horizon. The objective is minimum total travel distance **subject to** pickup times, transfer feasibility, capacity, and one active trip. Count empty repositioning travel as well as passenger travel. Never omit an accepted passenger or reorder a drop-off before that trip's pickup.

In the MVP, passengers in a group share one pickup and drop-off. Their names are individually tracked, but their shared location is visited once. Trips with fixed times may have only one feasible order; explain that the schedule can determine the route order. Do not promise a shorter route when time constraints prevent one.

Routing implementation:

- Geographic mode: obtain road geometry, distance, and duration from a configurable routing HTTP provider, for example an OSRM-compatible Route service. Use a dynamic Table service where useful and available; do not assume every provider supports every distance annotation.
- Demo mode: calculate straight-line lengths from `x, y`, draw an SVG route, and label it as schematic. Use a configured demo speed only for demonstration travel estimates.
- Road-routing costs may be directional. Do not assume A-to-B equals B-to-A.
- Cache results with coordinate revisions, provider/profile, expiry, and explicit invalidation. Handle timeouts, unreachable locations, rate limits, and invalid responses.
- Road profiles must be suitable for permitted Toto roads. A generic driving profile is an estimate and does not establish access legality for every road.
- A provider Route endpoint returns road paths for an ordered list of waypoints; it does not by itself solve scheduling and pickup/drop-off ordering.
- For small plans, use an exact feasible-order search or branch-and-bound with a documented bound. For larger plans, use a deterministic feasible heuristic plus local improvement and label the result Best Found rather than Guaranteed Shortest.
- Distinguish a shortest road path for fixed endpoints from a globally optimal multi-trip itinerary. State which objective and constraints the algorithm actually verifies.

Persist route waypoints, geometry, distance, duration, planning-input versions, calculation time, provider/mode, and optimization quality. Preserve the completed trip's route snapshot even if locations later change.

If geographic routing is unavailable, show Route Unavailable and block acceptance when required feasibility cannot be established. Demo mode must be an explicit setup choice, not a hidden fallback that pretends straight-line estimates are real road routes. Configure production routing separately; do not treat a public demonstration server as a production availability guarantee.

## 10. History and visibility

Passenger pages must distinguish:

- **My Requests:** everything this account filed, including groups they did not join.
- **Named Trips:** trips whose manifest explicitly references this account, including Missed and Cancelled entries with clear labels.
- **Travel History:** completed trips where this account actually Boarded and was Dropped.

The rider's **All Trips** history includes every trip, its assigned rider, request filer, all names, boarding/drop-off results, times, route snapshot, cancellations, and no-shows. Include pending requests and clash attempts in a separate request/activity view because a failed acceptance did not create a trip.

Paginate and filter by date, status, location, and assigned rider. Passengers may view their own entries and the groups they filed, not arbitrary people's histories. Riders may view all trip manifests as required for this internal desk.

## 11. Suggested Mongoose models

Design schemas and indexes around these entities; adjust details while preserving the rules:

- **User:** name, normalized unique email, password hash, role, timestamps.
- **Session:** hashed token, user ID, expiry, timestamps; TTL cleanup plus expiry checking on every authenticated lookup.
- **Location:** code, name, active, coordinate mode, geographic point or demo coordinates, coordinate version.
- **Vehicle:** unique code, capacity, current location, active trip reference, schedule version, operational state.
- **RideRequest:** filer, origin/destination IDs and snapshots, pickup instant, latest pickup instant, manifest members with stable IDs/user references/name snapshots, count, notes, status, assigned rider, trip reference, version, timestamps.
- **Trip:** unique request reference, vehicle, rider, trip status, reservation times, actual lifecycle times, manifest attendance and drop-off fields, route snapshot, completion reason.
- **Reservation:** vehicle, trip, start/end, status; indexed for schedule overlap queries.
- **AuditEvent:** actor, entity, action, before/after changes as appropriate, timestamp, correlation/idempotency reference. Append-only application behavior.
- **IdempotencyRecord:** actor, action, key, payload hash, outcome reference, status/expiry, unique composite index.
- **RouteCache:** coordinate-version keys, provider/profile, geometry/costs, calculated time, expiry.

Use indexes for normalized email, manifest user ID plus time, rider history, request status/time, and reservation lookup. Create indexes and the singleton vehicle through an explicit idempotent setup script. Avoid relying on production startup to finish index creation before accepting traffic.

## 12. UI and API deliverables

Build responsive pages for registration, login, passenger dashboard, request creation/detail, passenger histories, rider dashboard, schedule/map, trip manifest, and rider history. Use accessible forms, clear loading/error/empty states, and explicit status badges. Keep privileged details behind authenticated pages.

Suggested Route Handler contracts:

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/locations`
- `POST /api/requests`, `GET /api/requests`, `GET /api/requests/:id`
- `POST /api/requests/:id/cancel`, `POST /api/requests/:id/accept`
- `GET /api/trips`, `GET /api/trips/:id`
- `POST /api/trips/:id/start-pickup`
- `PATCH /api/trips/:id/passengers/:memberId/boarding`
- `POST /api/trips/:id/depart`
- `PATCH /api/trips/:id/passengers/:memberId/dropoff`
- `POST /api/trips/:id/complete`
- `GET /api/history/me`, `GET /api/rider/history`, `GET /api/rider/itinerary`

All endpoints need schema validation, authentication/authorization where applicable, consistent error objects, and meaningful status codes. Provide fresh availability after conflicts. Never let a passenger access another user's data by changing an ID in a URL.

## 13. Required verification

Write meaningful service/integration tests against a transaction-capable MongoDB environment and an end-to-end smoke test. Mock routing responses for deterministic tests; do not depend on live network routing during correctness tests.

Mandatory cases:

1. Two requests for the same pickup time; one accepted, the other reports Clash. Exactly one trip and valid reservation exist.
2. Send simultaneous acceptance calls from two different riders using independently connected database clients. Verify only one conflicting trip commits.
3. Two riders accept the same request concurrently. Exactly one assignment/trip exists; retries do not duplicate events.
4. A group contains Alice, Bob, and Charlie. Alice and Bob board and are dropped; Charlie is missed. Counts show two transported and one missed.
5. Alice and Bob see the completed trip in Travel History. Charlie sees a Missed entry in Named Trips but no completed travel entry. The rider sees the full trip and all three names.
6. Overlapping intervals clash even if pickup timestamps differ. A non-overlapping trip with insufficient repositioning time also clashes.
7. Two trips cannot start simultaneously, including when started by different riders.
8. Completion frees the Toto only after all boarded passengers are dropped. Expired estimates do not free an active trip.
9. Different people with identical names do not share history. A filer who did not travel does not gain a travel record.
10. Authentication, rider registration code, role restrictions, and object-level access controls work.
11. Changing a location invalidates future route calculations without changing completed route snapshots.
12. Adding a fourth location through data configuration makes it available without editing UI or route logic.
13. Routing failures do not leave partial acceptance data. Concurrent cancellations/acceptances maintain schedule consistency.
14. Late trips flag affected reservations and prevent a second active trip. All-missed completion releases the Toto with no transported passengers.

Verify production build, type checking, and linting. Document actual commands and outcomes; do not claim tests passed unless they ran.

## 14. Setup and final handoff

Include:

- Complete source code, lockfile, `.gitignore`, `.env.example`, seed/index setup, and tests.
- README covering local installation, Atlas configuration, environment variables, setup/seed, running, testing, build, and deployment as one monolith.
- Environment placeholders for `MONGODB_URI`, company timezone, rider invitation code, session configuration, vehicle capacity, demo/routing mode, routing base URL/profile/credentials if needed, handling buffers, and pickup tolerance.
- A concise architecture description, collection/index documentation, workflow/state transitions, and explanation of concurrency protection.
- Demo walkthrough reproducing the three original checks.
- Routing limitations, guest history limitations, setup assumptions, and future pooling extension points.

Keep modules separate within the monolith: authentication, locations, requests, reservations, trips/attendance, routing, and history. Do not store critical state only in browser storage. Do not treat a client-side disabled button as concurrency protection.

Start by presenting the data model and transaction design briefly, then implement the working application. If an ambiguity remains, use the explicit MVP rules in this prompt and document the decision.

## 15. Primary technical references

Use current official documentation during implementation:

- [Mongoose atomic findOneAndUpdate behavior](https://mongoosejs.com/docs/tutorials/findoneandupdate)
- [Mongoose transactions](https://mongoosejs.com/docs/transactions.html)
- [MongoDB transactions](https://www.mongodb.com/docs/manual/core/transactions/)
- [MongoDB transaction production considerations](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/)
- [OSRM HTTP routing documentation](https://project-osrm.org/docs/v26.4.0/http)

These references support database operations and routing APIs; application-specific scheduling and concurrency invariants still require the design and tests above.
