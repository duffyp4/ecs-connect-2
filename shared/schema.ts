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
  checkInDate: text("check_in_date"),
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

// Reference Data for form dropdowns (temporarily using simple arrays)
export const referenceDataEntries = pgTable("reference_data_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sheetName: text("sheet_name").notNull(), // "Workflow Shops" or "Workflow Customer Name"
  fieldName: text("field_name").notNull(), // Column header from the sheet
  fieldValue: text("field_value").notNull(), // The actual value
  lookupKey: text("lookup_key"), // For lookup logic (e.g., shopUserID for shop rows)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertReferenceDataEntrySchema = createInsertSchema(referenceDataEntries).omit({
  id: true,
  createdAt: true,
});

export type SelectReferenceDataEntry = typeof referenceDataEntries.$inferSelect;
export type InsertReferenceDataEntry = z.infer<typeof insertReferenceDataEntrySchema>;
