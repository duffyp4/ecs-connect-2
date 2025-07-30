import { type User, type InsertUser, type Job, type InsertJob, type Technician, type InsertTechnician } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Job methods
  getJob(id: string): Promise<Job | undefined>;
  getJobByJobId(jobId: string): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, updates: Partial<Job>): Promise<Job | undefined>;
  getAllJobs(): Promise<Job[]>;
  getJobsByStatus(status: string): Promise<Job[]>;
  getJobsByTechnician(technicianEmail: string): Promise<Job[]>;
  
  // Technician methods
  getTechnician(id: string): Promise<Technician | undefined>;
  getTechnicianByEmail(email: string): Promise<Technician | undefined>;
  createTechnician(technician: InsertTechnician): Promise<Technician>;
  getAllTechnicians(): Promise<Technician[]>;
  getActiveTechnicians(): Promise<Technician[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private jobs: Map<string, Job>;
  private technicians: Map<string, Technician>;

  constructor() {
    this.users = new Map();
    this.jobs = new Map();
    this.technicians = new Map();
    
    // Initialize with sample technicians
    this.initializeTechnicians();
  }

  private async initializeTechnicians() {
    const sampleTechnicians = [
      { name: "John Smith", email: "tech1@ecs.com", active: "true" },
      { name: "Mike Johnson", email: "tech2@ecs.com", active: "true" },
      { name: "Sarah Davis", email: "tech3@ecs.com", active: "true" },
      { name: "Chris Wilson", email: "tech4@ecs.com", active: "true" },
    ];
    
    for (const tech of sampleTechnicians) {
      await this.createTechnician(tech);
    }
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Job methods
  async getJob(id: string): Promise<Job | undefined> {
    return this.jobs.get(id);
  }

  async getJobByJobId(jobId: string): Promise<Job | undefined> {
    return Array.from(this.jobs.values()).find(job => job.jobId === jobId);
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const id = randomUUID();
    const jobId = this.generateJobId();
    const job: Job = {
      id,
      jobId,
      status: "pending",
      initiatedAt: new Date(),
      completedAt: null,
      turnaroundTime: null,
      gocanvasSubmissionId: null,
      gocanvasSynced: "false",
      googleSheetsSynced: "false",
      // Ensure all fields are properly defined with correct types
      trailerId: insertJob.trailerId || null,
      permissionStart: insertJob.permissionStart || null,
      permissionDenied: insertJob.permissionDenied || null,
      storeName: insertJob.storeName,
      customerName: insertJob.customerName,
      noShipId: insertJob.noShipId || null,
      customerShipId: insertJob.customerShipId || null,
      poShipToId: insertJob.poShipToId || null,
      customerInstructions: insertJob.customerInstructions || null,
      serialChange: insertJob.serialChange || null,
      preferredPressure: insertJob.preferredPressure || null,
      otherInstructions: insertJob.otherInstructions || null,
      techComments: insertJob.techComments || null,
      testCustomer: insertJob.testCustomer || null,
      contactName: insertJob.contactName,
      contactNumber: insertJob.contactNumber,
      poNumber: insertJob.poNumber || null,
      serialNumbers: insertJob.serialNumbers || null,
      techHelper: insertJob.techHelper || null,
      checkInDate: insertJob.checkInDate,
      checkInTime: insertJob.checkInTime,
      shopHandoff: insertJob.shopHandoff,
      internalExternal: insertJob.internalExternal || null,
    };
    this.jobs.set(id, job);
    return job;
  }

  async updateJob(id: string, updates: Partial<Job>): Promise<Job | undefined> {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    
    const updatedJob = { ...job, ...updates };
    this.jobs.set(id, updatedJob);
    return updatedJob;
  }

  async getAllJobs(): Promise<Job[]> {
    return Array.from(this.jobs.values()).sort((a, b) => 
      new Date(b.initiatedAt).getTime() - new Date(a.initiatedAt).getTime()
    );
  }

  async getJobsByStatus(status: string): Promise<Job[]> {
    return Array.from(this.jobs.values()).filter(job => job.status === status);
  }

  async getJobsByTechnician(technicianEmail: string): Promise<Job[]> {
    return Array.from(this.jobs.values()).filter(job => job.shopHandoff === technicianEmail);
  }

  // Technician methods
  async getTechnician(id: string): Promise<Technician | undefined> {
    return this.technicians.get(id);
  }

  async getTechnicianByEmail(email: string): Promise<Technician | undefined> {
    return Array.from(this.technicians.values()).find(tech => tech.email === email);
  }

  async createTechnician(insertTechnician: InsertTechnician): Promise<Technician> {
    const id = randomUUID();
    const technician: Technician = { 
      id,
      name: insertTechnician.name,
      email: insertTechnician.email,
      active: insertTechnician.active || "true"
    };
    this.technicians.set(id, technician);
    return technician;
  }

  async getAllTechnicians(): Promise<Technician[]> {
    return Array.from(this.technicians.values());
  }

  async getActiveTechnicians(): Promise<Technician[]> {
    return Array.from(this.technicians.values()).filter(tech => tech.active === "true");
  }

  private generateJobId(): string {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-T:\.Z]/g, '').slice(0, 14);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `ECS-${timestamp}-${random}`;
  }
}

export const storage = new MemStorage();
