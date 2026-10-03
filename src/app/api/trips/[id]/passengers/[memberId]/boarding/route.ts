import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { updateBoardingStatus } from "@/services/attendance.service";
import { markBoardingSchema } from "@/lib/validation";
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

    const body = await req.json();
    const parsed = markBoardingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const trip = await updateBoardingStatus(user._id, id, memberId, parsed.data.status);
    return NextResponse.json({ success: true, trip });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update boarding status." },
      { status: err.statusCode || 500 }
    );
  }
}
