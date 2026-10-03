import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestDatabase, teardownTestDatabase } from "./test-db";
import { registerSchema } from "../src/lib/validation";
import { createSession, validateSessionToken, hashPassword, verifyPassword } from "../src/lib/auth";

let testContext: any;

describe("Authentication, Rider Code, and Role Controls (Mandatory Case 10)", () => {
  beforeAll(async () => {
    testContext = await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  it("Enforces rider invitation code on registration", () => {
    // Rider registration without code must fail
    const invalidRider = registerSchema.safeParse({
      name: "Dave",
      email: "dave@xyz.com",
      password: "password123",
      role: "rider",
    });
    expect(invalidRider.success).toBe(false);

    // Rider registration with invitation code succeeds
    const validRider = registerSchema.safeParse({
      name: "Dave",
      email: "dave@xyz.com",
      password: "password123",
      role: "rider",
      invitationCode: "TOTO_XYZ_2026",
    });
    expect(validRider.success).toBe(true);

    // Passenger registration does not require invitation code
    const validPassenger = registerSchema.safeParse({
      name: "Eve",
      email: "eve@xyz.com",
      password: "password123",
      role: "passenger",
    });
    expect(validPassenger.success).toBe(true);
  });

  it("Secures password hashing and opaque session tokens", async () => {
    const rawPassword = "SecurePassword2026!";
    const hashed = await hashPassword(rawPassword);

    expect(hashed).not.toBe(rawPassword);
    const valid = await verifyPassword(rawPassword, hashed);
    expect(valid).toBe(true);

    const invalid = await verifyPassword("WrongPassword", hashed);
    expect(invalid).toBe(false);

    // Session creation & validation
    const { token } = await createSession(testContext.users.alice._id);
    expect(token).toBeDefined();

    const user = await validateSessionToken(token);
    expect(user).toBeDefined();
    expect(user?._id.toString()).toBe(testContext.users.alice._id.toString());
    // Password hash should not be returned in user JSON
    expect((user as any).passwordHash).toBeUndefined();
  });
});
