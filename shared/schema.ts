import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, json, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id", { length: 50 }).notNull().unique(),
  
  // CSR Form Fields (exactly matching GoCanvas form structure from screenshot)
  p21OrderNumber: text("p21_order_number"),
  userId: text("user_id"),
  permissionToStart: text("permission_to_start"),
  permissionDeniedStop: text("permission_denied_stop"),
  shopName: text("shop_name").notNull(),
  customerName: text("customer_name").notNull(),
  customerShipTo: text("customer_ship_to"),
  p21ShipToId: text("p21_ship_to_id"),
  customerSpecificInstructions: text("customer_specific_instructions"),
  sendClampsGaskets: text("send_clamps_gaskets"),
  preferredProcess: text("preferred_process"),
  anyOtherSpecificInstructions: text("any_other_specific_instructions"),
  anyCommentsForTech: text("any_comments_for_tech"),
  noteToTechAboutCustomer: text("note_to_tech_about_customer"),
  contactName: text("contact_name").notNull(),
  contactNumber: text("contact_number").notNull(),
  poNumber: text("po_number"),
  serialNumbers: text("serial_numbers"),
  techCustomerQuestionInquiry: text("tech_customer_question_inquiry"),
  checkInDate: text("check_in_date").notNull(),
  checkInTime: text("check_in_time").notNull(),
  shopHandoff: text("shop_handoff").notNull(), // technician email
  handoffEmailWorkflow: text("handoff_email_workflow"),
  
  // Tracking Fields
  status: text("status").notNull().default("pending"), // pending, in-progress, completed, overdue
  initiatedAt: timestamp("initiated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: timestamp("completed_at"),
  turnaroundTime: integer("turnaround_time"), // in minutes
  
  // GoCanvas Integration
  gocanvasSubmissionId: text("gocanvas_submission_id"),
  gocanvasDispatchId: text("gocanvas_dispatch_id"),
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

// Reference Data Tables
export const referenceDataShops = pgTable("reference_data_shops", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shopUserID: text("shop_user_id").notNull(),
  shop: text("shop").notNull(),
  permissionToStart: text("permission_to_start"),
  shopHandoff: text("shop_handoff"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const referenceDataCustomers = pgTable("reference_data_customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerName: text("customer_name").notNull(),
  shipToCombined: text("ship_to_combined"),
  ship2ID: text("ship2_id"),
  specificInstructionsForCustomer: text("specific_instructions_for_customer"),
  sendClampsGaskets: text("send_clamps_gaskets"),
  defaultService: text("default_service"),
  customerNotes: text("customer_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertReferenceDataShopsSchema = createInsertSchema(referenceDataShops).omit({
  id: true,
  createdAt: true,
});

export const insertReferenceDataCustomersSchema = createInsertSchema(referenceDataCustomers).omit({
  id: true,
  createdAt: true,
});

export type SelectReferenceDataShop = typeof referenceDataShops.$inferSelect;
export type InsertReferenceDataShop = z.infer<typeof insertReferenceDataShopsSchema>;
export type SelectReferenceDataCustomer = typeof referenceDataCustomers.$inferSelect;
export type InsertReferenceDataCustomer = z.infer<typeof insertReferenceDataCustomersSchema>;
