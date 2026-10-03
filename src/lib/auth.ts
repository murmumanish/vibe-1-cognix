import bcrypt from "bcryptjs";
import crypto from "crypto";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { connectToDatabase } from "./db";
import { User } from "@/models/User";
import { Session } from "@/models/Session";
import { IUser, UserRole } from "@/types";
import { UnauthorizedError, ForbiddenError } from "./errors";

export const SESSION_COOKIE_NAME = "session_token";
const SESSION_EXPIRY_HOURS = parseInt(process.env.SESSION_EXPIRY_HOURS || "24", 10);

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: any): Promise<{ token: string; expiresAt: Date }> {
  await connectToDatabase();
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);

  await Session.create({
    tokenHash,
    userId,
    expiresAt,
  });

  return { token, expiresAt };
}

export async function invalidateSession(token: string): Promise<void> {
  await connectToDatabase();
  const tokenHash = hashToken(token);
  await Session.deleteOne({ tokenHash });
}

export async function validateSessionToken(token: string): Promise<IUser | null> {
  if (!token) return null;
  await connectToDatabase();
  const tokenHash = hashToken(token);

  const session = await Session.findOne({
    tokenHash,
    expiresAt: { $gt: new Date() },
  });

  if (!session) return null;

  const user = await User.findById(session.userId);
  return user ? (user.toJSON() as IUser) : null;
}

export async function getCurrentUser(req?: NextRequest | Request): Promise<IUser | null> {
  let token: string | undefined;

  if (req) {
    const cookieHeader = req.headers.get("cookie") || "";
    const match = cookieHeader.match(new RegExp(`(?:^|; )${SESSION_COOKIE_NAME}=([^;]*)`));
    token = match ? decodeURIComponent(match[1]) : undefined;
  }

  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    } catch {
      // If cookies() is not available (e.g. in some context)
    }
  }

  if (!token) return null;
  return validateSessionToken(token);
}

export async function requireUser(
  req?: NextRequest | Request,
  allowedRoles?: UserRole[]
): Promise<IUser> {
  const user = await getCurrentUser(req);
  if (!user) {
    throw new UnauthorizedError("Authentication required.");
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    throw new ForbiddenError(
      `Access denied. Role '${user.role}' is not authorized for this resource.`
    );
  }

  return user;
}
