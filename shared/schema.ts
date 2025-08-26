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
  poNumber: text("po_number").notNull(),
  serialNumbers: text("serial_numbers"),
  techCustomerQuestionInquiry: text("tech_customer_question_inquiry"),
  shopHandoff: text("shop_handoff").notNull(), // technician email
  handoffEmailWorkflow: text("handoff_email_workflow"),
  
  // Tracking Fields
  status: text("status").notNull().default("pending"), // pending, in-progress, completed, overdue
  initiatedAt: timestamp("initiated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  handoffAt: timestamp("handoff_at"), // when handed off to technician
  completedAt: timestamp("completed_at"),
  turnaroundTime: integer("turnaround_time"), // in minutes (Full Turnaround: Initiated to Completed)
  timeWithTech: integer("time_with_tech"), // in minutes (Time with Tech: Handoff to Completed)
  
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
  handoffAt: true,
  completedAt: true,
  turnaroundTime: true,
  timeWithTech: true,
  gocanvasSubmissionId: true,
  gocanvasSynced: true,
  googleSheetsSynced: true,
}).extend({
  // Required fields with validation
  shopName: z.string().min(1, "Shop Name is required"),
  customerName: z.string().min(1, "Customer Name is required"),
  contactName: z.string().min(1, "Contact Name is required"),
  contactNumber: z.string().min(1, "Contact Number is required"),
  poNumber: z.string().min(1, "PO Number is required"),
  shopHandoff: z.string().min(1, "Shop Handoff is required"),
  // Optional fields that can be empty
  customerShipTo: z.string().optional(),
  p21OrderNumber: z.string().optional(),
  userId: z.string().optional(),
  permissionToStart: z.string().optional(),
  permissionDeniedStop: z.string().optional(),
  p21ShipToId: z.string().optional(),
  customerSpecificInstructions: z.string().optional(),
  sendClampsGaskets: z.string().optional(),
  preferredProcess: z.string().optional(),
  anyOtherSpecificInstructions: z.string().optional(),
  anyCommentsForTech: z.string().optional(),
  noteToTechAboutCustomer: z.string().optional(),
  serialNumbers: z.string().optional(),
  techCustomerQuestionInquiry: z.string().optional(),
  handoffEmailWorkflow: z.string().optional(),
  gocanvasDispatchId: z.string().optional(),
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
