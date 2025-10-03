import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { jobs, technicians, jobEvents, type Job, type InsertJob, type Technician, type InsertTechnician, type JobEvent, type InsertJobEvent } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  private db: ReturnType<typeof drizzle>;

  constructor() {
    const sql = neon(process.env.DATABASE_URL!);
    this.db = drizzle(sql);
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