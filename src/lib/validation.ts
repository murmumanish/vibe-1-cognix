import { z } from "zod";

export const registerSchema = z
  .object({
    name: z.string().min(2, "Full name must be at least 2 characters").trim(),
    email: z.string().email("Please provide a valid email address").toLowerCase().trim(),
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: z.enum(["passenger", "rider"]),
    invitationCode: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.role === "rider") {
        return !!data.invitationCode && data.invitationCode.trim().length > 0;
      }
      return true;
    },
    {
      message: "Company rider invitation code is required for rider registration",
      path: ["invitationCode"],
    }
  );

export const loginSchema = z.object({
  email: z.string().email("Please provide a valid email address").toLowerCase().trim(),
  password: z.string().min(1, "Password is required"),
});

export const manifestMemberSchema = z.object({
  name: z.string().min(1, "Passenger name cannot be blank").trim(),
  email: z.string().email("Invalid email format").toLowerCase().trim().optional().or(z.literal("")),
  isFiler: z.boolean().default(false),
});

export const createRideRequestSchema = z
  .object({
    originId: z.string().min(1, "Origin location is required"),
    destinationId: z.string().min(1, "Destination location is required"),
    pickupDatetime: z.string().min(1, "Pickup date and time is required"),
    manifest: z
      .array(manifestMemberSchema)
      .min(1, "At least one passenger must be specified"),
    notes: z.string().max(500, "Notes cannot exceed 500 characters").optional().default(""),
  })
  .refine((data) => data.originId !== data.destinationId, {
    message: "Origin and destination cannot be the same location",
    path: ["destinationId"],
  });

export const markBoardingSchema = z.object({
  status: z.enum(["boarded", "missed"]),
});

export const addLocationSchema = z.object({
  code: z.string().min(2).max(10).toUpperCase().trim(),
  name: z.string().min(2).trim(),
  coordinateMode: z.enum(["demo", "geographic"]),
  coordinates: z.any(),
});
