import { type User, type InsertUser, type Job, type InsertJob, type Technician, type InsertTechnician } from "@shared/schema";
import { DatabaseStorage } from "./database";

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

export const storage = new DatabaseStorage();
