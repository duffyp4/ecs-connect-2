import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, json, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id", { length: 50 }).notNull().unique(),
  
  // CSR Form Fields
  trailerId: text("trailer_id"),
  permissionStart: text("permission_start"),
  permissionDenied: text("permission_denied"),
  storeName: text("store_name").notNull(),
  customerName: text("customer_name").notNull(),
  noShipId: text("no_ship_id"),
  customerShipId: text("customer_ship_id"),
  poShipToId: text("po_ship_to_id"),
  customerInstructions: text("customer_instructions"),
  serialChange: text("serial_change"),
  preferredPressure: text("preferred_pressure"),
  otherInstructions: text("other_instructions"),
  techComments: text("tech_comments"),
  testCustomer: text("test_customer"),
  contactName: text("contact_name").notNull(),
  contactNumber: text("contact_number").notNull(),
  poNumber: text("po_number"),
  serialNumbers: text("serial_numbers"),
  techHelper: text("tech_helper"),
  checkInDate: text("check_in_date").notNull(),
  checkInTime: text("check_in_time").notNull(),
  shopHandoff: text("shop_handoff").notNull(), // technician email
  internalExternal: text("internal_external"),
  
  // Tracking Fields
  status: text("status").notNull().default("pending"), // pending, in-progress, completed, overdue
  initiatedAt: timestamp("initiated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: timestamp("completed_at"),
  turnaroundTime: integer("turnaround_time"), // in minutes
  
  // GoCanvas Integration
  gocanvasSubmissionId: text("gocanvas_submission_id"),
  gocanvasSynced: text("gocanvas_synced").default("false"),
  
  // Google Sheets Integration
  googleSheetsSynced: text("google_sheets_synced").default("false"),
});

export const technicians = pgTable("technicians", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  active: text("active").notNull().default("true"),
});

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  jobId: true,
  initiatedAt: true,
  status: true,
  gocanvasSubmissionId: true,
  gocanvasSynced: true,
  googleSheetsSynced: true,
  completedAt: true,
  turnaroundTime: true,
});

export const insertTechnicianSchema = createInsertSchema(technicians).omit({
  id: true,
});

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;
export type InsertTechnician = z.infer<typeof insertTechnicianSchema>;
export type Technician = typeof technicians.$inferSelect;

// Keep existing user schema
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
