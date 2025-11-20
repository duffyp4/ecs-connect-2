import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, json, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Replit Auth: Session storage table
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Replit Auth: User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default("user"),
  timezone: varchar("timezone").notNull().default("America/Chicago"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Email Whitelist table
export const whitelist = pgTable("whitelist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull().unique(),
  addedBy: varchar("added_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWhitelistSchema = createInsertSchema(whitelist).omit({
  id: true,
  createdAt: true,
});

export type InsertWhitelist = z.infer<typeof insertWhitelistSchema>;
export type Whitelist = typeof whitelist.$inferSelect;

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
  
  // Tracking Fields - New State System (8 states including post-completion tracking)
  state: text("state").notNull().default("queued_for_pickup"), // queued_for_pickup, picked_up, at_shop, in_service, service_complete, ready_for_pickup, picked_up_from_shop, queued_for_delivery, delivered
  initiatedAt: timestamp("initiated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at"),
  
  // State-specific Timestamps
  pickedUpAt: timestamp("picked_up_at"),
  atShopAt: timestamp("at_shop_at"),
  inServiceAt: timestamp("in_service_at"),
  serviceCompleteAt: timestamp("service_complete_at"), // when emissions service log is completed
  readyAt: timestamp("ready_at"), // when marked ready_for_pickup
  queuedForDeliveryAt: timestamp("queued_for_delivery_at"),
  deliveredAt: timestamp("delivered_at"),
  
  // Legacy Timestamps (kept for backward compatibility)
  possessionStart: timestamp("possession_start"), // earliest of picked_up or shop_checkin
  handoffAt: timestamp("handoff_at"), // when handed off to technician
  readyForPickupDeliveryAt: timestamp("ready_for_pickup_delivery_at"),
  completedAt: timestamp("completed_at"),
  
  // Pickup/Delivery Data
  pickupAddress: text("pickup_address"),
  pickupNotes: text("pickup_notes"),
  pickupDriverEmail: text("pickup_driver_email"),
  deliveryAddress: text("delivery_address"),
  deliveryNotes: text("delivery_notes"),
  deliveryDriverEmail: text("delivery_driver_email"),
  deliveryMethod: text("delivery_method"), // 'pickup' or 'delivery'
  itemCount: integer("item_count"),
  
  // Order Numbers (for delivery)
  orderNumber: text("order_number"),
  orderNumber2: text("order_number_2"),
  orderNumber3: text("order_number_3"),
  orderNumber4: text("order_number_4"),
  orderNumber5: text("order_number_5"),
  
  // Technician Assignment
  assignedTechnician: text("assigned_technician"),
  
  // Scenario Tracking
  startedWithPickup: text("started_with_pickup").default("false"), // did job start with pickup dispatch?
  selfPickup: text("self_pickup").default("false"), // is customer picking up vs ECS delivery?
  startMode: text("start_mode"), // 'pickup_dispatch' or 'shop_checkin' - how job was initiated
  completionMode: text("completion_mode"), // 'delivered' or 'ready_for_pickup' - how job was completed
  
  // Pre-calculated KPI Fields (in minutes)
  timeToPickup: integer("time_to_pickup"), // pickup_dispatched to picked_up
  timeAtShop: integer("time_at_shop"), // possession_start to ready_for_pickup_delivery
  timeWithTech: integer("time_with_tech"), // tech_start to tech_complete
  totalTurnaround: integer("total_turnaround"), // start to end (depends on scenario)
  turnaroundTime: integer("turnaround_time"), // kept for backward compatibility
  
  // GoCanvas Integration - Multiple Forms
  gocanvasDispatchId: text("gocanvas_submission_id"), // Emissions Service Log dispatch (column name kept for data preservation)
  pickupDispatchId: text("pickup_dispatch_id"), // Pickup Log dispatch
  deliveryDispatchId: text("delivery_dispatch_id"), // Delivery Log dispatch
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

export const jobEvents = pgTable("job_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull(), // references jobs.id
  eventType: text("event_type").notNull(), // pickup_dispatched, picked_up, shop_checkin, tech_start, tech_complete, ready_for_pickup, delivery_dispatched, delivered
  description: text("description").notNull(), // human-readable description of the event
  timestamp: timestamp("timestamp").notNull().default(sql`CURRENT_TIMESTAMP`),
  actor: text("actor").notNull(), // CSR, Driver, System, Technician
  actorEmail: text("actor_email"), // who performed the action
  metadata: json("metadata"), // GPS coords, notes, driver name, etc.
});

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  jobId: true,
  initiatedAt: true,
  state: true,
  possessionStart: true,
  handoffAt: true,
  readyForPickupDeliveryAt: true,
  deliveredAt: true,
  completedAt: true,
  startedWithPickup: true,
  selfPickup: true,
  timeToPickup: true,
  timeAtShop: true,
  timeWithTech: true,
  totalTurnaround: true,
  turnaroundTime: true,
  gocanvasDispatchId: true,
  pickupDispatchId: true,
  deliveryDispatchId: true,
  gocanvasSynced: true,
  googleSheetsSynced: true,
}).extend({
  // Required fields with validation (matching asterisk fields in UI)
  shopName: z.string().min(1, "Shop Name is required"),
  customerName: z.string().min(1, "Customer Name is required"),
  customerShipTo: z.string().min(1, "Customer Ship To is required"),
  contactName: z.string().min(1, "Contact Name is required"),
  contactNumber: z.string().min(1, "Contact Number is required").refine(
    (value) => {
      // Remove all non-digits to check if we have exactly 10 digits
      const digits = value.replace(/\D/g, '');
      return digits.length === 10;
    },
    { message: "Contact Number must be a valid 10-digit phone number" }
  ),
  poNumber: z.string().min(1, "PO Number is required"),
  serialNumbers: z.string().min(1, "Serial Number(s) is required"),
  shopHandoff: z.string().min(1, "Shop Handoff is required"),
  userId: z.string().min(1, "User ID is required"),
  // Optional fields that can be empty
  permissionToStart: z.string().optional(),
  permissionDeniedStop: z.string().optional(),
  p21ShipToId: z.string().optional(),
  customerSpecificInstructions: z.string().optional(),
  sendClampsGaskets: z.string().optional(),
  preferredProcess: z.string().optional(),
  anyOtherSpecificInstructions: z.string().optional(),
  anyCommentsForTech: z.string().optional(),
  noteToTechAboutCustomer: z.string().optional(),
  techCustomerQuestionInquiry: z.string().optional(),
  handoffEmailWorkflow: z.string().optional(),
  gocanvasDispatchId: z.string().optional(),
});

// Pickup-specific validation schema - only validates fields needed for pickup dispatch
export const pickupJobSchema = createInsertSchema(jobs).omit({
  id: true,
  jobId: true,
  initiatedAt: true,
  state: true,
  possessionStart: true,
  handoffAt: true,
  readyForPickupDeliveryAt: true,
  deliveredAt: true,
  completedAt: true,
  startedWithPickup: true,
  selfPickup: true,
  timeToPickup: true,
  timeAtShop: true,
  timeWithTech: true,
  totalTurnaround: true,
  turnaroundTime: true,
  gocanvasDispatchId: true,
  pickupDispatchId: true,
  deliveryDispatchId: true,
  gocanvasSynced: true,
  googleSheetsSynced: true,
}).extend({
  // Only require fields needed for pickup dispatch
  shopName: z.string().min(1, "Location is required"),
  customerName: z.string().min(1, "Customer Name is required"),
  customerShipTo: z.string().min(1, "Customer Ship To is required"),
  // All other fields are optional for pickup
  contactName: z.string().optional(),
  contactNumber: z.string().optional(),
  poNumber: z.string().optional(),
  serialNumbers: z.string().optional(),
  shopHandoff: z.string().optional(),
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
  techCustomerQuestionInquiry: z.string().optional(),
  handoffEmailWorkflow: z.string().optional(),
  gocanvasDispatchId: z.string().optional(),
});

// Check-in schema - for completing pickup jobs at check-in with essential fields
// Use .partial() to make all fields optional, then explicitly require only essential ones
export const checkInJobSchema = createInsertSchema(jobs)
  .omit({
    id: true,
    jobId: true,
    initiatedAt: true,
    state: true,
    possessionStart: true,
    handoffAt: true,
    readyForPickupDeliveryAt: true,
    deliveredAt: true,
    completedAt: true,
    startedWithPickup: true,
    selfPickup: true,
    timeToPickup: true,
    timeAtShop: true,
    timeWithTech: true,
    totalTurnaround: true,
    turnaroundTime: true,
    gocanvasSubmissionId: true,
    gocanvasDispatchId: true,
    pickupDispatchId: true,
    deliveryDispatchId: true,
    gocanvasSynced: true,
    googleSheetsSynced: true,
  })
  .partial() // Make all fields optional first
  .extend({
    // Pre-populated fields (disabled in UI, already known)
    shopName: z.string().min(1, "Shop Name is required"),
    customerName: z.string().min(1, "Customer Name is required"),
    // Essential required fields for check-in
    userId: z.string().min(1, "User ID is required"),
    permissionToStart: z.string().min(1, "Permission to Start is required"),
    shopHandoff: z.string().min(1, "Shop Handoff is required"),
    contactName: z.string().min(1, "Contact Name is required"),
    contactNumber: z.string().min(1, "Contact Number is required"),
  });

export const insertTechnicianSchema = createInsertSchema(technicians).omit({
  id: true,
});

export const insertJobEventSchema = createInsertSchema(jobEvents).omit({
  id: true,
  timestamp: true,
});

export type InsertJob = z.infer<typeof insertJobSchema>;
export type PickupJob = z.infer<typeof pickupJobSchema>;
export type CheckInJob = z.infer<typeof checkInJobSchema>;
export type Job = typeof jobs.$inferSelect;
export type InsertTechnician = z.infer<typeof insertTechnicianSchema>;
export type Technician = typeof technicians.$inferSelect;
export type InsertJobEvent = z.infer<typeof insertJobEventSchema>;
export type JobEvent = typeof jobEvents.$inferSelect;

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

// Job Comments table
export const jobComments = pgTable("job_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id", { length: 50 }).notNull(), // ECS-formatted job ID
  userId: varchar("user_id").notNull(),
  commentText: text("comment_text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertJobCommentSchema = createInsertSchema(jobComments).omit({
  id: true,
  createdAt: true,
});

export type InsertJobComment = z.infer<typeof insertJobCommentSchema>;
export type JobComment = typeof jobComments.$inferSelect;

// Job Parts table - for tracking parts on jobs with GoCanvas loop screen integration
export const jobParts = pgTable("job_parts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id", { length: 50 }).notNull(), // ECS-formatted job ID
  
  // Fields entered by CSR in ECS Connect (pre-dispatch)
  part: text("part"), // Field ID: 728953416
  process: text("process"), // Field ID: 728953403 - Process Being Performed
  ecsSerial: text("ecs_serial"), // Field ID: 728953409 - ECS Serial Number
  filterPn: text("filter_pn"), // Field ID: 728953404 - Filter Part Number
  poNumber: text("po_number"), // Field ID: 728953411 - PO Number
  mileage: text("mileage"), // Field ID: 728953412 - Mileage
  unitVin: text("unit_vin"), // Field ID: 728953413 - Unit / Vin Number
  gasketClamps: text("gasket_clamps"), // Field ID: 728953467 - Gasket or Clamps
  ec: text("ec"), // Field ID: 728953477 - EC
  eg: text("eg"), // Field ID: 728953478 - EG
  ek: text("ek"), // Field ID: 728953479 - EK
  
  // Fields filled by technician in GoCanvas (post-dispatch, from submission webhook)
  ecsPartNumber: text("ecs_part_number"), // Field ID: 728953405 - ECS Part Number
  passOrFail: text("pass_or_fail"), // Field ID: 728953401 - Did the Part Pass or Fail?
  requireRepairs: text("require_repairs"), // Field ID: 728953515 - Did the Part Require Repairs?
  failedReason: text("failed_reason"), // Field ID: 728953518 - Failed Reason
  repairsPerformed: text("repairs_performed"), // Field ID: 728953517 - Which Repairs Were Performed
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertJobPartSchema = createInsertSchema(jobParts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // Required fields - 4 out of 11 are required for CSR entry
  part: z.string().min(1, "Part is required"),
  process: z.string().min(1, "Process Being Performed is required"),
  ecsSerial: z.string().min(1, "ECS Serial Number is required"),
  gasketClamps: z.string().min(1, "Gasket or Clamps is required"),
  // Optional CSR fields
  filterPn: z.string().optional(),
  poNumber: z.string().optional(),
  mileage: z.string().optional(),
  unitVin: z.string().optional(),
  ec: z.string().optional(),
  eg: z.string().optional(),
  ek: z.string().optional(),
  // Optional GoCanvas completion fields (filled from webhook)
  ecsPartNumber: z.string().optional(),
  passOrFail: z.string().optional(),
  requireRepairs: z.string().optional(),
  failedReason: z.string().optional(),
  repairsPerformed: z.string().optional(),
});

export type InsertJobPart = z.infer<typeof insertJobPartSchema>;
export type JobPart = typeof jobParts.$inferSelect;
