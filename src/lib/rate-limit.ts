import { connectToDatabase } from "./db";
import { RateLimit } from "@/models/RateLimit";

export async function checkRateLimit(
  key: string,
  limit: number = 20,
  windowSeconds: number = 60
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  try {
    await connectToDatabase();
    const now = new Date();
    const resetAt = new Date(now.getTime() + windowSeconds * 1000);

    const doc = await RateLimit.findOneAndUpdate(
      { key, resetAt: { $gt: now } },
      { $inc: { count: 1 }, $setOnInsert: { key, resetAt } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const count = doc.count;
    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);

    return {
      allowed,
      remaining,
      resetAt: doc.resetAt,
    };
  } catch (err) {
    // If DB rate limit fails, do not block users completely, allow gracefully
    console.error("Rate limit check error:", err);
    return {
      allowed: true,
      remaining: 1,
      resetAt: new Date(Date.now() + windowSeconds * 1000),
    };
  }
}
