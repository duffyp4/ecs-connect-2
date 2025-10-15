import session from "express-session";
import type { Express, RequestHandler } from "express";

// Simple password - you can change this to any password you want
const APP_PASSWORD = process.env.APP_PASSWORD || "ecs2024";

export function getSession() {
  return session({
    secret: process.env.SESSION_SECRET || "your-secret-key-here",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  });
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const session = req.session as any;
  
  if (session && session.authenticated) {
    return next();
  }
  
  res.status(401).json({ message: "Authentication required" });
};

export function setupAuth(app: Express) {
  app.use(getSession());

  // Login endpoint
  app.post("/api/login", (req, res) => {
    const { password } = req.body;
    
    if (password === APP_PASSWORD) {
      const session = req.session as any;
      session.authenticated = true;
      req.session.save((err: any) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({ success: false, message: "Session save failed" });
        }
        res.json({ success: true, message: "Login successful" });
      });
    } else {
      res.status(401).json({ success: false, message: "Invalid password" });
    }
  });

  // Logout endpoint
  app.post("/api/logout", (req, res) => {
    const session = req.session as any;
    session.authenticated = false;
    req.session.destroy((err: any) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ success: true, message: "Logout successful" });
    });
  });

  // Check auth status
  app.get("/api/auth/status", (req, res) => {
    const session = req.session as any;
    res.json({ 
      authenticated: !!(session && session.authenticated),
    });
  });
}