/**
 * Simple password gate for staging environments.
 *
 * When the STAGING_PASSWORD env var is set, all requests are blocked until
 * the user enters the password via a minimal HTML login page. A signed cookie
 * persists the session so the user doesn't have to re-enter it on every request.
 *
 * To enable: set STAGING_PASSWORD on Railway (or in .env for local testing).
 * To disable: remove/unset the env var.
 */

import { type Request, type Response, type NextFunction } from "express";
import crypto from "crypto";

const COOKIE_NAME = "staging_auth";

/** Derive a token from the password so we don't store it in plaintext in the cookie. */
function deriveToken(password: string): string {
  return crypto.createHash("sha256").update(`staging:${password}`).digest("hex").slice(0, 32);
}

/** Minimal HTML login page — no external dependencies needed. */
function loginPage(error?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ECS Connect — Staging Access</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f4f5f7;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      padding: 2rem;
      width: 100%;
      max-width: 360px;
    }
    h1 { font-size: 1.25rem; margin-bottom: 0.25rem; }
    .subtitle { color: #6b7280; font-size: 0.875rem; margin-bottom: 1.5rem; }
    label { display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.5rem; }
    input {
      width: 100%;
      padding: 0.625rem 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 0.9rem;
      outline: none;
    }
    input:focus { border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,0.15); }
    button {
      width: 100%;
      margin-top: 1rem;
      padding: 0.625rem;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
    }
    button:hover { background: #1d4ed8; }
    .error {
      background: #fef2f2;
      color: #b91c1c;
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      font-size: 0.8rem;
      margin-bottom: 1rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>ECS Connect</h1>
    <p class="subtitle">Enter the staging password to continue.</p>
    ${error ? `<div class="error">${error}</div>` : ""}
    <form method="POST" action="/api/staging-login">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" autofocus required />
      <button type="submit">Continue</button>
    </form>
  </div>
</body>
</html>`;
}

/**
 * Install the staging auth middleware + login endpoint on the Express app.
 * No-ops if STAGING_PASSWORD is not set.
 */
export function setupStagingAuth(app: import("express").Express): void {
  const password = process.env.STAGING_PASSWORD;
  if (!password) return; // No password set — staging gate disabled

  const validToken = deriveToken(password);

  // Health check endpoint — always accessible so Railway can verify the app is alive.
  // Must be registered before the gate middleware.
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  // Check endpoint — lets the client verify staging auth status
  // Registered before the gate middleware so it's always accessible.
  app.get("/api/staging-check", (req: Request, res: Response) => {
    const cookies = req.headers.cookie || "";
    const match = cookies.split(";").find((c) => c.trim().startsWith(`${COOKIE_NAME}=`));
    const token = match?.split("=")[1]?.trim();
    res.json({ authenticated: token === validToken });
  });

  // Login endpoint — validates password and sets the cookie
  app.post("/api/staging-login", (req: Request, res: Response) => {
    const submitted = req.body?.password;
    if (submitted === password) {
      res.cookie(COOKIE_NAME, validToken, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        secure: process.env.NODE_ENV === "production",
      });
      res.redirect("/");
    } else {
      res.status(401).send(loginPage("Incorrect password. Please try again."));
    }
  });

  // Gate middleware — blocks all other requests without a valid cookie
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Don't gate the login endpoint itself
    if (req.path === "/api/staging-login" || req.path === "/api/staging-check" || req.path === "/health") return next();

    // Parse the cookie manually (no cookie-parser dependency needed)
    const cookies = req.headers.cookie || "";
    const match = cookies.split(";").find((c) => c.trim().startsWith(`${COOKIE_NAME}=`));
    const token = match?.split("=")[1]?.trim();

    if (token === validToken) {
      return next(); // Authenticated — let the request through
    }

    // Not authenticated
    if (req.path.startsWith("/api/")) {
      return res.status(401).json({ message: "Staging authentication required" });
    }

    // Serve the login page for all other requests (HTML, assets, etc.)
    res.status(401).send(loginPage());
  });
}
