import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { updateDropoffStatus } from "@/services/attendance.service";
import { validateCsrf } from "@/lib/csrf";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    if (!validateCsrf(req)) {
      return NextResponse.json({ error: "Invalid CSRF token or origin." }, { status: 403 });
    }

    const user = await requireUser(req, ["rider"]);
    const { id, memberId } = await params;

    const trip = await updateDropoffStatus(user._id, id, memberId);
    return NextResponse.json({ success: true, trip });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to record dropoff." },
      { status: err.statusCode || 500 }
    );
  }
}
