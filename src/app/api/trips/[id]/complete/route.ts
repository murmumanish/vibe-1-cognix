import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { completeTrip } from "@/services/attendance.service";
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

    const trip = await completeTrip(user._id, id);
    return NextResponse.json({ success: true, trip });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to complete trip." },
      { status: err.statusCode || 500 }
    );
  }
}
