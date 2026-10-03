import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { acceptRideRequest } from "@/services/scheduling.service";
import { validateCsrf } from "@/lib/csrf";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!validateCsrf(req)) {
      return NextResponse.json({ error: "Invalid CSRF token or origin." }, { status: 403 });
    }

    const user = await requireUser(req, ["rider"]);
    const { id } = await params;

    const idempotencyKey =
      req.headers.get("x-idempotency-key") ||
      (await req.json().catch(() => ({})))?.idempotencyKey;

    const result = await acceptRideRequest(user._id, id, idempotencyKey);
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: err.message || "Failed to accept request.",
        clash: err.name === "ConflictError",
        details: err.details,
      },
      { status: err.statusCode || 500 }
    );
  }
}
