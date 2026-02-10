import { clerkMiddleware, clerkClient, getAuth } from "@clerk/express";
import type { Express, RequestHandler } from "express";
import { storage } from "./storage";

const hasClerkKeys = !!process.env.CLERK_SECRET_KEY;

// Dev mode user info - used when Clerk is not configured
const DEV_USER = {
  id: "dev-user-123",
  email: "dev@example.com",
  firstName: "Dev",
  lastName: "User",
};

export async function setupAuth(app: Express) {
  if (!hasClerkKeys) {
    // No Clerk keys configured: use mock auth (works in any NODE_ENV)
    console.log("[Auth] No Clerk keys found - using mock authentication");

    // Ensure dev user exists in database and whitelist
    await storage.upsertUser({
      id: DEV_USER.id,
      email: DEV_USER.email,
      firstName: DEV_USER.firstName,
      lastName: DEV_USER.lastName,
      profileImageUrl: null,
    });

    const isWhitelisted = await storage.isEmailWhitelisted(DEV_USER.email);
    if (!isWhitelisted) {
      await storage.addToWhitelist({
        email: DEV_USER.email,
        role: "admin",
      });
      console.log("[Auth] Added dev user to whitelist");
    }

    // Attach mock auth to all requests
    app.use((req: any, _res, next) => {
      req._devAuth = DEV_USER;
      next();
    });

    // Dev login/logout routes
    app.get("/api/login", (_req, res) => res.redirect("/"));
    app.get("/api/callback", (_req, res) => res.redirect("/"));
    app.get("/api/logout", (_req, res) => res.redirect("/"));

    return;
  }

  // Production mode: use Clerk middleware
  console.log("[Auth] Using Clerk authentication");
  app.use(clerkMiddleware());
}

/**
 * Middleware that requires an authenticated user.
 * In dev mode without Clerk, uses the mock dev user.
 * In production, uses Clerk's getAuth() to verify the session.
 */
export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
  // Dev mode without Clerk
  if (req._devAuth) {
    return next();
  }

  // Clerk auth
  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    return next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

/**
 * Get the authenticated user's Clerk ID from the request.
 * Returns the dev user ID in dev mode, or the Clerk userId in production.
 */
export function getRequestUserId(req: any): string | null {
  // Dev mode without Clerk
  if (req._devAuth) {
    return req._devAuth.id;
  }

  // Clerk auth
  try {
    const auth = getAuth(req);
    return auth.userId;
  } catch {
    return null;
  }
}

/**
 * Get the authenticated user's ID, throwing if not authenticated.
 * Use this in routes protected by isAuthenticated middleware.
 */
export function requireUserId(req: any): string {
  const userId = getRequestUserId(req);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

/**
 * Get the authenticated user's email from the database.
 * Looks up the user by their Clerk ID and returns the email.
 */
export async function getRequestUserEmail(req: any): Promise<string | null> {
  const userId = getRequestUserId(req);
  if (!userId) return null;

  const user = await storage.getUser(userId);
  return user?.email ?? null;
}

/**
 * Get the authenticated user's display name from the database.
 * Returns "First Last" or falls back to email.
 */
export async function getRequestUserName(req: any): Promise<string> {
  const userId = getRequestUserId(req);
  if (!userId) return "system";

  const user = await storage.getUser(userId);
  if (!user) return "system";

  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  return user.email ?? "system";
}

/**
 * Sync a Clerk user to our database. Called on /api/auth/user to ensure
 * the user exists in our local users table.
 * Returns the upserted user or null if not authenticated.
 */
export async function syncClerkUser(req: any) {
  // Dev mode - user already synced at startup
  if (req._devAuth) {
    return storage.getUser(req._devAuth.id);
  }

  const userId = getRequestUserId(req);
  if (!userId) return null;

  // Check if user already exists in our DB
  const existingUser = await storage.getUser(userId);
  if (existingUser) return existingUser;

  // User not in DB yet - fetch from Clerk and create
  try {
    const clerkUser = await clerkClient.users.getUser(userId);
    const email = clerkUser.emailAddresses?.[0]?.emailAddress;

    if (!email) {
      console.error(`[Auth] Clerk user ${userId} has no email address`);
      return null;
    }

    // Check whitelist before creating user
    const isWhitelisted = await storage.isEmailWhitelisted(email);
    if (!isWhitelisted) {
      console.log(`[Auth] User ${email} not whitelisted, denying access`);
      return null;
    }

    // Upsert user into our database
    return await storage.upsertUser({
      id: userId,
      email,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      profileImageUrl: clerkUser.imageUrl,
    });
  } catch (error) {
    console.error("[Auth] Failed to sync Clerk user:", error);
    return null;
  }
}
