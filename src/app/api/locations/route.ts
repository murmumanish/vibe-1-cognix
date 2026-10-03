import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Location } from "@/models/Location";
import { addLocationSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    await connectToDatabase();
    const locations = await Location.find({ active: true }).sort({ name: 1 });
    return NextResponse.json({ locations });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch locations." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    // Allow riders or admins to add locations
    await requireUser(req, ["rider"]);

    const body = await req.json();
    const parsed = addLocationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { code, name, coordinateMode, coordinates } = parsed.data;

    const existing = await Location.findOne({ code });
    if (existing) {
      return NextResponse.json(
        { error: `Location code '${code}' already exists.` },
        { status: 409 }
      );
    }

    const location = await Location.create({
      code,
      name,
      coordinateMode,
      coordinates,
      active: true,
      coordinateVersion: 1,
    });

    return NextResponse.json({ success: true, location }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create location." },
      { status: err.statusCode || 500 }
    );
  }
}
