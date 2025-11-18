import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { jobs, technicians, jobEvents, users, whitelist, jobComments, jobParts, type Job, type InsertJob, type Technician, type InsertTechnician, type JobEvent, type InsertJobEvent, type User, type UpsertUser, type Whitelist, type InsertWhitelist, type JobComment, type InsertJobComment, type JobPart, type InsertJobPart } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { IStorage } from "./storage";
import ws from "ws";

export interface WhitelistWithRole extends Whitelist {
  role?: string | null;
}

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
    const jobId = this.generateJobId();
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
        addedBy: whitelist.addedBy,
        createdAt: whitelist.createdAt,
        role: users.role,
      })
      .from(whitelist)
      .leftJoin(users, eq(whitelist.email, users.email));
    return result;
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

  private generateJobId(): string {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-T:\.Z]/g, '').slice(0, 14);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `ECS-${timestamp}-${random}`;
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