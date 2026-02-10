import { WebSocket, WebSocketServer } from "ws";
import type { Server } from "http";

interface Notification {
  type: "form_assigned" | "form_updated" | "job_updated";
  submissionId?: string;
  jobId?: string;
  formType?: string;
  message: string;
}

/**
 * NotificationService manages WebSocket connections for real-time
 * notifications to technicians and drivers.
 *
 * Each user authenticates by sending their email after connecting,
 * which maps them to a WebSocket connection for receiving dispatches.
 */
class NotificationService {
  private connections = new Map<string, Set<WebSocket>>(); // email -> connections
  private wss: WebSocketServer | null = null;

  /**
   * Attach the WebSocket server to an existing HTTP server.
   * Uses noServer mode to avoid conflicting with Vite's HMR WebSocket in dev.
   */
  setup(server: Server): void {
    this.wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (request, socket, head) => {
      if (request.url === "/ws/notifications") {
        this.wss!.handleUpgrade(request, socket, head, (ws) => {
          this.wss!.emit("connection", ws, request);
        });
      }
    });

    this.wss.on("connection", (ws) => {
      let userEmail: string | null = null;

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === "auth" && message.email) {
            userEmail = message.email;
            this.addConnection(userEmail, ws);
            ws.send(JSON.stringify({ type: "auth_ok" }));
            console.log(`[WS] User ${userEmail} connected`);
          }
        } catch {
          // Ignore malformed messages
        }
      });

      ws.on("close", () => {
        if (userEmail) {
          this.removeConnection(userEmail, ws);
          console.log(`[WS] User ${userEmail} disconnected`);
        }
      });

      ws.on("error", () => {
        if (userEmail) {
          this.removeConnection(userEmail, ws);
        }
      });

      // Send ping every 30s to keep connection alive
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        } else {
          clearInterval(pingInterval);
        }
      }, 30000);
    });

    console.log("[WS] Notification service ready on /ws/notifications");
  }

  /**
   * Send a notification to a specific user by email.
   */
  notify(email: string, notification: Notification): void {
    const connections = this.connections.get(email);
    if (!connections || connections.size === 0) {
      console.log(`[WS] User ${email} not connected, notification queued for poll`);
      return;
    }

    const payload = JSON.stringify(notification);
    for (const ws of connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  /**
   * Notify a user that a form has been assigned to them.
   */
  notifyFormAssigned(email: string, submissionId: string, jobId: string, formType: string): void {
    this.notify(email, {
      type: "form_assigned",
      submissionId,
      jobId,
      formType,
      message: `New ${formType} form assigned for job ${jobId}`,
    });
  }

  private addConnection(email: string, ws: WebSocket): void {
    if (!this.connections.has(email)) {
      this.connections.set(email, new Set());
    }
    this.connections.get(email)!.add(ws);
  }

  private removeConnection(email: string, ws: WebSocket): void {
    const connections = this.connections.get(email);
    if (connections) {
      connections.delete(ws);
      if (connections.size === 0) {
        this.connections.delete(email);
      }
    }
  }

  /**
   * Get the number of connected users.
   */
  getConnectedCount(): number {
    return this.connections.size;
  }
}

export const notificationService = new NotificationService();
