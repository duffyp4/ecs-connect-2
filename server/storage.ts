import { type Job, type InsertJob, type Technician, type InsertTechnician, type JobEvent, type InsertJobEvent } from "@shared/schema";
import { DatabaseStorage } from "./database";

export interface IStorage {
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
}

export const storage = new DatabaseStorage();
