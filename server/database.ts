import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { jobs, technicians, jobEvents, users, whitelist, jobComments, jobParts, ecsSerialTracking, jobListTabs, formSubmissions, type Job, type InsertJob, type Technician, type InsertTechnician, type JobEvent, type InsertJobEvent, type User, type UpsertUser, type Whitelist, type InsertWhitelist, type JobComment, type InsertJobComment, type JobPart, type InsertJobPart, type JobListTab, type InsertJobListTab, type FormSubmission, type InsertFormSubmission } from "@shared/schema";
import { eq, desc, and, sql as drizzleSql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { IStorage } from "./storage";
import ws from "ws";
import { generateJobId } from "@shared/shopCodes";

export type WhitelistWithRole = Whitelist;

neonConfig.webSocketConstructor = ws;

export class DatabaseStorage implements IStorage {
  private db: ReturnType<typeof drizzle>;

  constructor() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
    this.db = drizzle(pool);
  }

  // Job methods
  async getJob(id: string): Promise<Job | undefined> {
    const result = await this.db.select().from(jobs).where(eq(jobs.id, id));
    return result[0];
  }

  async getJobByJobId(jobId: string): Promise<Job | undefined> {
    const result = await this.db.select().from(jobs).where(eq(jobs.jobId, jobId));
    return result[0];
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    // Generate Job ID using the centralized format: ECS-YYYYMMDDHHMMSS-XX (shop code)
    // Uses shopName from the job data to ensure consistent shop code
    const jobId = generateJobId(insertJob.shopName);
    const result = await this.db.insert(jobs).values({
      jobId,
      gocanvasSynced: "false",
      googleSheetsSynced: "false",
      ...insertJob,
    }).returning();
    return result[0];
  }

  async updateJob(id: string, updates: Partial<Job>): Promise<Job | undefined> {
    const result = await this.db.update(jobs).set(updates).where(eq(jobs.id, id)).returning();
    return result[0];
  }

  async deleteJob(id: string): Promise<void> {
    await this.db.delete(jobs).where(eq(jobs.id, id));
  }

  async getAllJobs(): Promise<Job[]> {
    const result = await this.db.select().from(jobs).orderBy(desc(jobs.initiatedAt));
    return result;
  }

  async getJobsByStatus(status: string): Promise<Job[]> {
    // For backward compatibility, map old status to new state
    const result = await this.db.select().from(jobs).where(eq(jobs.state, status));
    return result;
  }

  async getJobsByState(state: string): Promise<Job[]> {
    const result = await this.db.select().from(jobs).where(eq(jobs.state, state)).orderBy(desc(jobs.initiatedAt));
    return result;
  }

  async getJobsByTechnician(technicianEmail: string): Promise<Job[]> {
    const result = await this.db.select().from(jobs).where(eq(jobs.shopHandoff, technicianEmail));
    return result;
  }

  // Job Event methods
  async createJobEvent(insertEvent: InsertJobEvent): Promise<JobEvent> {
    const result = await this.db.insert(jobEvents).values({
      id: randomUUID(),
      ...insertEvent,
    }).returning();
    return result[0];
  }

  async getJobEvents(jobId: string): Promise<JobEvent[]> {
    // Query events using ECS-formatted job ID
    const result = await this.db.select().from(jobEvents).where(eq(jobEvents.jobId, jobId)).orderBy(jobEvents.timestamp);
    return result;
  }

  async getAllJobEvents(limit?: number): Promise<JobEvent[]> {
    const query = this.db.select().from(jobEvents).orderBy(desc(jobEvents.timestamp));
    if (limit) {
      const result = await query.limit(limit);
      return result;
    }
    const result = await query;
    return result;
  }

  // Technician methods
  async getTechnician(id: string): Promise<Technician | undefined> {
    const result = await this.db.select().from(technicians).where(eq(technicians.id, id));
    return result[0];
  }

  async getTechnicianByEmail(email: string): Promise<Technician | undefined> {
    const result = await this.db.select().from(technicians).where(eq(technicians.email, email));
    return result[0];
  }

  async createTechnician(insertTechnician: InsertTechnician): Promise<Technician> {
    const result = await this.db.insert(technicians).values({
      id: randomUUID(),
      active: "true",
      ...insertTechnician,
    }).returning();
    return result[0];
  }

  async getAllTechnicians(): Promise<Technician[]> {
    const result = await this.db.select().from(technicians);
    return result;
  }

  async getActiveTechnicians(): Promise<Technician[]> {
    const result = await this.db.select().from(technicians).where(eq(technicians.active, "true"));
    return result;
  }

  // Replit Auth: User methods (required for authentication)
  async getUser(id: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const result = await this.db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.email,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  }

  async updateUserRole(userId: string, role: string): Promise<User | undefined> {
    const result = await this.db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async updateUserTimezone(userId: string, timezone: string): Promise<User | undefined> {
    const result = await this.db
      .update(users)
      .set({ timezone, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  // Whitelist methods
  async isEmailWhitelisted(email: string): Promise<boolean> {
    const result = await this.db
      .select()
      .from(whitelist)
      .where(eq(whitelist.email, email.toLowerCase()));
    return result.length > 0;
  }

  async getWhitelistByEmail(email: string): Promise<Whitelist | undefined> {
    const result = await this.db
      .select()
      .from(whitelist)
      .where(eq(whitelist.email, email.toLowerCase()));
    return result[0];
  }

  async addToWhitelist(insertWhitelist: InsertWhitelist): Promise<Whitelist> {
    const result = await this.db
      .insert(whitelist)
      .values({
        ...insertWhitelist,
        email: insertWhitelist.email.toLowerCase(),
      })
      .returning();
    return result[0];
  }

  async removeFromWhitelist(email: string): Promise<void> {
    await this.db
      .delete(whitelist)
      .where(eq(whitelist.email, email.toLowerCase()));
  }

  async getAllWhitelist(): Promise<WhitelistWithRole[]> {
    const result = await this.db
      .select({
        id: whitelist.id,
        email: whitelist.email,
        role: whitelist.role,
        homeShop: whitelist.homeShop,
        addedBy: whitelist.addedBy,
        createdAt: whitelist.createdAt,
      })
      .from(whitelist);
    return result;
  }

  async updateWhitelistRole(email: string, role: string): Promise<Whitelist | undefined> {
    const result = await this.db
      .update(whitelist)
      .set({ role: role as any })
      .where(eq(whitelist.email, email.toLowerCase()))
      .returning();
    return result[0];
  }

  async updateWhitelistHomeShop(email: string, homeShop: string | null): Promise<Whitelist | undefined> {
    const result = await this.db
      .update(whitelist)
      .set({ homeShop })
      .where(eq(whitelist.email, email.toLowerCase()))
      .returning();
    return result[0];
  }

  // Job Comment methods
  async createJobComment(insertComment: InsertJobComment): Promise<JobComment> {
    const result = await this.db.insert(jobComments).values({
      id: randomUUID(),
      ...insertComment,
    }).returning();
    return result[0];
  }

  async getJobComments(jobId: string): Promise<any[]> {
    const result = await this.db
      .select({
        id: jobComments.id,
        jobId: jobComments.jobId,
        userId: jobComments.userId,
        commentText: jobComments.commentText,
        createdAt: jobComments.createdAt,
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
      })
      .from(jobComments)
      .leftJoin(users, eq(jobComments.userId, users.id))
      .where(eq(jobComments.jobId, jobId))
      .orderBy(jobComments.createdAt);
    return result;
  }

  // Job Part methods
  async createJobPart(insertPart: InsertJobPart): Promise<JobPart> {
    const result = await this.db.insert(jobParts).values({
      id: randomUUID(),
      ...insertPart,
    }).returning();
    return result[0];
  }

  async getJobParts(jobId: string): Promise<JobPart[]> {
    const result = await this.db
      .select()
      .from(jobParts)
      .where(eq(jobParts.jobId, jobId))
      .orderBy(jobParts.createdAt);
    return result;
  }

  async getAllJobParts(): Promise<Array<JobPart & { job: Job | null }>> {
    const result = await this.db
      .select()
      .from(jobParts)
      .leftJoin(jobs, eq(jobParts.jobId, jobs.jobId))
      .orderBy(desc(jobParts.createdAt));
    
    return result.map(row => ({
      ...row.job_parts,
      job: row.jobs,
    }));
  }

  async updateJobPart(id: string, updates: Partial<JobPart>): Promise<JobPart | undefined> {
    const result = await this.db
      .update(jobParts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(jobParts.id, id))
      .returning();
    return result[0];
  }

  async deleteJobPart(id: string): Promise<void> {
    await this.db.delete(jobParts).where(eq(jobParts.id, id));
  }


  // ECS Serial Number methods
  // Peek at next serial number WITHOUT reserving it
  async peekNextSerialNumber(shopCode: string, date: string): Promise<string> {
    // Get tracking record for this shop/date
    const existingRecord = await this.db
      .select()
      .from(ecsSerialTracking)
      .where(and(
        eq(ecsSerialTracking.shopCode, shopCode),
        eq(ecsSerialTracking.date, date)
      ));
    
    let nextSequence: number;
    
    if (existingRecord.length === 0) {
      // First serial for this shop/date - check job_parts table too
      nextSequence = 1;
    } else {
      // Next sequence would be current + 1
      nextSequence = existingRecord[0].lastSequence + 1;
    }
    
    // ALSO check job_parts table for any serials matching this shop/date pattern
    // that might be higher than the tracking table sequence
    const serialPattern = `${shopCode}.${date}.%`;
    const existingParts = await this.db
      .select()
      .from(jobParts)
      .where(drizzleSql`${jobParts.ecsSerial} LIKE ${serialPattern}`);
    
    // Extract sequence numbers from existing parts
    for (const part of existingParts) {
      if (part.ecsSerial) {
        const match = part.ecsSerial.match(/\.(\d{2})$/);
        if (match) {
          const sequence = parseInt(match[1], 10);
          if (sequence >= nextSequence) {
            nextSequence = sequence + 1;
          }
        }
      }
    }
    
    // Format: XX.MMDDYYYY.ZZ
    const formattedSequence = String(nextSequence).padStart(2, '0');
    return `${shopCode}.${date}.${formattedSequence}`;
  }

  async generateNextSerialNumber(shopCode: string, date: string): Promise<string> {
    // Get or create tracking record for this shop/date
    const existingRecord = await this.db
      .select()
      .from(ecsSerialTracking)
      .where(and(
        eq(ecsSerialTracking.shopCode, shopCode),
        eq(ecsSerialTracking.date, date)
      ));
    
    let nextSequence: number;
    
    if (existingRecord.length === 0) {
      // First serial for this shop/date
      nextSequence = 1;
      await this.db.insert(ecsSerialTracking).values({
        shopCode,
        date,
        lastSequence: 1,
        usedSerials: [`${shopCode}.${date}.01`],
      });
    } else {
      // Increment sequence
      nextSequence = existingRecord[0].lastSequence + 1;
      const serialNumber = `${shopCode}.${date}.${String(nextSequence).padStart(2, '0')}`;
      
      await this.db
        .update(ecsSerialTracking)
        .set({
          lastSequence: nextSequence,
          usedSerials: drizzleSql`array_append(${ecsSerialTracking.usedSerials}, ${serialNumber})`,
          updatedAt: new Date(),
        })
        .where(and(
          eq(ecsSerialTracking.shopCode, shopCode),
          eq(ecsSerialTracking.date, date)
        ));
    }
    
    // Format: XX.MMDDYYYY.ZZ
    const formattedSequence = String(nextSequence).padStart(2, '0');
    return `${shopCode}.${date}.${formattedSequence}`;
  }
  
  async isSerialNumberAvailable(
    serialNumber: string, 
    excludeJobId?: string,
    excludePartId?: string
  ): Promise<boolean> {
    // Check if this serial number exists in any tracking record
    const allRecords = await this.db.select().from(ecsSerialTracking);
    
    for (const record of allRecords) {
      if (record.usedSerials.includes(serialNumber)) {
        return false;
      }
    }
    
    // Check if it's already assigned to a part (excluding current part if editing)
    let query = this.db
      .select()
      .from(jobParts)
      .where(eq(jobParts.ecsSerial, serialNumber));
    
    const existingParts = await query;
    
    // If we're excluding a specific part (editing mode), filter it out
    if (excludePartId) {
      const otherParts = existingParts.filter(p => p.id !== excludePartId);
      return otherParts.length === 0;
    }
    
    return existingParts.length === 0;
  }
  
  async reserveSerialNumber(shopCode: string, date: string, sequence: number, serialNumber: string): Promise<void> {
    // Get or create tracking record
    const existingRecord = await this.db
      .select()
      .from(ecsSerialTracking)
      .where(and(
        eq(ecsSerialTracking.shopCode, shopCode),
        eq(ecsSerialTracking.date, date)
      ));
    
    if (existingRecord.length === 0) {
      // Create new tracking record
      await this.db.insert(ecsSerialTracking).values({
        shopCode,
        date,
        lastSequence: Math.max(sequence, 1),
        usedSerials: [serialNumber],
      });
    } else {
      // Update existing record
      const newLastSequence = Math.max(existingRecord[0].lastSequence, sequence);
      
      await this.db
        .update(ecsSerialTracking)
        .set({
          lastSequence: newLastSequence,
          usedSerials: drizzleSql`array_append(${ecsSerialTracking.usedSerials}, ${serialNumber})`,
          updatedAt: new Date(),
        })
        .where(and(
          eq(ecsSerialTracking.shopCode, shopCode),
          eq(ecsSerialTracking.date, date)
        ));
    }
  }

  // Job List Tab methods
  async getUserTabs(userId: string): Promise<JobListTab[]> {
    const result = await this.db.select().from(jobListTabs)
      .where(eq(jobListTabs.userId, userId))
      .orderBy(jobListTabs.position);
    return result;
  }

  async createTab(tab: InsertJobListTab): Promise<JobListTab> {
    const result = await this.db.insert(jobListTabs).values(tab).returning();
    return result[0];
  }

  async updateTab(id: string, updates: Partial<JobListTab>): Promise<JobListTab | undefined> {
    const result = await this.db.update(jobListTabs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(jobListTabs.id, id))
      .returning();
    return result[0];
  }

  async deleteTab(id: string): Promise<void> {
    await this.db.delete(jobListTabs).where(eq(jobListTabs.id, id));
  }

  async reorderTabs(userId: string, tabIds: string[]): Promise<void> {
    for (let i = 0; i < tabIds.length; i++) {
      await this.db.update(jobListTabs)
        .set({ position: i, updatedAt: new Date() })
        .where(and(eq(jobListTabs.id, tabIds[i]), eq(jobListTabs.userId, userId)));
    }
  }

  // Form Submission methods
  async createFormSubmission(submission: InsertFormSubmission): Promise<FormSubmission> {
    const result = await this.db.insert(formSubmissions).values({
      id: randomUUID(),
      ...submission,
    }).returning();
    return result[0];
  }

  async getFormSubmission(id: string): Promise<FormSubmission | undefined> {
    const result = await this.db.select().from(formSubmissions).where(eq(formSubmissions.id, id));
    return result[0];
  }

  async getFormSubmissionsByJob(jobId: string): Promise<FormSubmission[]> {
    return await this.db.select().from(formSubmissions)
      .where(eq(formSubmissions.jobId, jobId))
      .orderBy(desc(formSubmissions.dispatchedAt));
  }

  async getFormSubmissionsAssignedTo(email: string): Promise<FormSubmission[]> {
    return await this.db.select().from(formSubmissions)
      .where(and(
        eq(formSubmissions.assignedTo, email),
        // Only return active (non-completed) submissions
      ))
      .orderBy(desc(formSubmissions.dispatchedAt));
  }

  async updateFormSubmission(id: string, updates: Partial<FormSubmission>): Promise<FormSubmission | undefined> {
    const result = await this.db.update(formSubmissions)
      .set(updates)
      .where(eq(formSubmissions.id, id))
      .returning();
    return result[0];
  }

  // Initialize with sample technicians if none exist
  async initializeData(): Promise<void> {
    try {
      const existingTechnicians = await this.getAllTechnicians();
      
      if (existingTechnicians.length === 0) {
        console.log('Initializing database with sample technicians...');
        const sampleTechnicians = [
          { name: "John Smith", email: "tech1@ecs.com" },
          { name: "Mike Johnson", email: "tech2@ecs.com" },
          { name: "Sarah Davis", email: "tech3@ecs.com" },
          { name: "Chris Wilson", email: "tech4@ecs.com" },
        ];
        
        for (const tech of sampleTechnicians) {
          await this.createTechnician(tech);
        }
        console.log('Sample technicians created');
      }
    } catch (error) {
      console.log('Database initialization skipped, tables may not exist yet:', error);
    }
  }
}