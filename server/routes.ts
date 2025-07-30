import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertJobSchema } from "@shared/schema";
import { goCanvasService } from "./services/gocanvas";
import { googleSheetsService } from "./services/googleSheets";
import { jobTrackerService } from "./services/jobTracker";

export async function registerRoutes(app: Express): Promise<Server> {
  // Start job tracking polling
  jobTrackerService.startPolling();

  // Get all technicians
  app.get("/api/technicians", async (req, res) => {
    try {
      const technicians = await storage.getActiveTechnicians();
      res.json(technicians);
    } catch (error) {
      console.error("Error fetching technicians:", error);
      res.status(500).json({ message: "Failed to fetch technicians" });
    }
  });

  // Create new job
  app.post("/api/jobs", async (req, res) => {
    try {
      const validatedData = insertJobSchema.parse(req.body);
      
      // Create job in storage
      const job = await storage.createJob(validatedData);
      
      // Create GoCanvas submission
      try {
        const formId = process.env.GOCANVAS_FORM_ID || process.env.GOCANVAS_FORM_ID_ENV_VAR || "default_form_id";
        const submissionId = await goCanvasService.createSubmission(formId, job);
        
        // Update job with GoCanvas submission ID
        await storage.updateJob(job.id, {
          gocanvasSubmissionId: submissionId,
          gocanvasSynced: "true",
        });

        console.log(`Created GoCanvas submission ${submissionId} for job ${job.jobId}`);
      } catch (gocanvasError) {
        console.error("GoCanvas submission failed:", gocanvasError);
        // Job is still created, but GoCanvas sync failed
      }

      const updatedJob = await storage.getJob(job.id);
      res.json(updatedJob);
    } catch (error) {
      console.error("Error creating job:", error);
      if (error instanceof Error && error.name === 'ZodError') {
        res.status(400).json({ message: "Invalid job data", errors: error });
      } else {
        res.status(500).json({ message: "Failed to create job" });
      }
    }
  });

  // Get all jobs
  app.get("/api/jobs", async (req, res) => {
    try {
      const { status, technician, limit } = req.query;
      
      let jobs = await storage.getAllJobs();
      
      if (status && status !== 'all') {
        jobs = jobs.filter(job => job.status === status);
      }
      
      if (technician && technician !== 'all') {
        jobs = jobs.filter(job => job.shopHandoff === technician);
      }
      
      if (limit) {
        jobs = jobs.slice(0, parseInt(limit as string));
      }
      
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      res.status(500).json({ message: "Failed to fetch jobs" });
    }
  });

  // Get job by ID
  app.get("/api/jobs/:id", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        res.status(404).json({ message: "Job not found" });
        return;
      }
      res.json(job);
    } catch (error) {
      console.error("Error fetching job:", error);
      res.status(500).json({ message: "Failed to fetch job" });
    }
  });

  // Get dashboard metrics
  app.get("/api/metrics", async (req, res) => {
    try {
      const metrics = await jobTrackerService.calculateMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error calculating metrics:", error);
      res.status(500).json({ message: "Failed to calculate metrics" });
    }
  });

  // Export jobs to Google Sheets
  app.post("/api/jobs/export", async (req, res) => {
    try {
      const jobs = await storage.getAllJobs();
      const result = await googleSheetsService.batchSyncJobs(jobs);
      res.json(result);
    } catch (error) {
      console.error("Error exporting jobs:", error);
      res.status(500).json({ message: "Failed to export jobs" });
    }
  });

  // Update job status (for testing)
  app.patch("/api/jobs/:id", async (req, res) => {
    try {
      const { status } = req.body;
      const updatedJob = await storage.updateJob(req.params.id, { status });
      
      if (!updatedJob) {
        res.status(404).json({ message: "Job not found" });
        return;
      }
      
      res.json(updatedJob);
    } catch (error) {
      console.error("Error updating job:", error);
      res.status(500).json({ message: "Failed to update job" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
