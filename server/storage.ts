import { type Job, type InsertJob, type Technician, type InsertTechnician, type JobEvent, type InsertJobEvent, type User, type UpsertUser, type Whitelist, type InsertWhitelist, type JobComment, type InsertJobComment, type JobPart, type InsertJobPart } from "@shared/schema";
import { DatabaseStorage, type WhitelistWithRole } from "./database";

export interface IStorage {
  // Replit Auth: User methods (required for authentication)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserRole(userId: string, role: string): Promise<User | undefined>;
  updateUserTimezone(userId: string, timezone: string): Promise<User | undefined>;
  
  // Whitelist methods
  isEmailWhitelisted(email: string): Promise<boolean>;
  addToWhitelist(whitelist: InsertWhitelist): Promise<Whitelist>;
  removeFromWhitelist(email: string): Promise<void>;
  getAllWhitelist(): Promise<WhitelistWithRole[]>;
  
  // Job methods
  getJob(id: string): Promise<Job | undefined>;
  getJobByJobId(jobId: string): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, updates: Partial<Job>): Promise<Job | undefined>;
  deleteJob(id: string): Promise<void>;
  getAllJobs(): Promise<Job[]>;
  getJobsByStatus(status: string): Promise<Job[]>;
  getJobsByState(state: string): Promise<Job[]>;
  getJobsByTechnician(technicianEmail: string): Promise<Job[]>;
  
  // Job Event methods
  createJobEvent(event: InsertJobEvent): Promise<JobEvent>;
  getJobEvents(jobId: string): Promise<JobEvent[]>;
  getAllJobEvents(limit?: number): Promise<JobEvent[]>;
  
  // Technician methods
  getTechnician(id: string): Promise<Technician | undefined>;
  getTechnicianByEmail(email: string): Promise<Technician | undefined>;
  createTechnician(technician: InsertTechnician): Promise<Technician>;
  getAllTechnicians(): Promise<Technician[]>;
  getActiveTechnicians(): Promise<Technician[]>;
  
  // Job Comment methods
  createJobComment(comment: InsertJobComment): Promise<JobComment>;
  getJobComments(jobId: string): Promise<JobComment[]>;
  
  // Job Part methods
  createJobPart(part: InsertJobPart): Promise<JobPart>;
  getJobParts(jobId: string): Promise<JobPart[]>;
  updateJobPart(id: string, updates: Partial<JobPart>): Promise<JobPart | undefined>;
  deleteJobPart(id: string): Promise<void>;
}

export const storage = new DatabaseStorage();
