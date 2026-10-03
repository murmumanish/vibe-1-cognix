import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { cancelRideRequest } from "@/services/scheduling.service";
import { validateCsrf } from "@/lib/csrf";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!validateCsrf(req)) {
      return NextResponse.json({ error: "Invalid CSRF token or origin." }, { status: 403 });
    }

    const user = await requireUser(req);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = body?.reason || "Cancelled by user";

    const result = await cancelRideRequest(user._id, user.role, id, reason);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to cancel request." },
      { status: err.statusCode || 500 }
    );
  }
}
