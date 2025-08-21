import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertJobSchema } from "@shared/schema";
import { goCanvasService } from "./services/gocanvas";
import { googleSheetsService } from "./services/googleSheets";
import { jobTrackerService } from "./services/jobTracker";
import { referenceDataService } from "./services/referenceData";

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

  // Get all reference data from GoCanvas
  app.get("/api/gocanvas/reference-data", async (req, res) => {
    try {
      const referenceData = await goCanvasService.getReferenceData();
      res.json({ success: true, data: referenceData });
    } catch (error) {
      console.error("Failed to fetch GoCanvas reference data:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to fetch reference data", 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Get specific reference data by ID
  app.get("/api/gocanvas/reference-data/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const referenceData = await goCanvasService.getReferenceDataById(id);
      res.json({ success: true, data: referenceData });
    } catch (error) {
      console.error(`Failed to fetch reference data ${req.params.id}:`, error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to fetch reference data", 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Reference Data endpoints for form population
  app.get("/api/reference/shop-users", async (req, res) => {
    try {
      const users = await referenceDataService.getShopUsers();
      res.json(users);
    } catch (error) {
      console.error("Failed to get shop users:", error);
      res.status(500).json({ error: "Failed to fetch shop users" });
    }
  });

  app.get("/api/reference/shops/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const shops = await referenceDataService.getShopsForUser(userId);
      res.json(shops);
    } catch (error) {
      console.error(`Failed to get shops for user ${req.params.userId}:`, error);
      res.status(500).json({ error: "Failed to fetch shops" });
    }
  });

  app.get("/api/reference/permission/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const permission = await referenceDataService.getPermissionForUser(userId);
      res.json({ permission });
    } catch (error) {
      console.error(`Failed to get permission for user ${req.params.userId}:`, error);
      res.status(500).json({ error: "Failed to fetch permission" });
    }
  });

  app.get("/api/reference/customers", async (req, res) => {
    try {
      const customers = await referenceDataService.getCustomerNames();
      res.json(customers);
    } catch (error) {
      console.error("Failed to get customers:", error);
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.get("/api/reference/ship-to/:customerName", async (req, res) => {
    try {
      const { customerName } = req.params;
      const shipToOptions = await referenceDataService.getShipToForCustomer(decodeURIComponent(customerName));
      res.json(shipToOptions);
    } catch (error) {
      console.error(`Failed to get ship to options for customer ${req.params.customerName}:`, error);
      res.status(500).json({ error: "Failed to fetch ship to options" });
    }
  });

  app.get("/api/reference/ship2-ids/:customerName/:shipTo", async (req, res) => {
    try {
      const { customerName, shipTo } = req.params;
      const ship2Ids = await referenceDataService.getShip2IdsForCustomerShipTo(
        decodeURIComponent(customerName),
        decodeURIComponent(shipTo)
      );
      res.json(ship2Ids);
    } catch (error) {
      console.error(`Failed to get Ship2 IDs for customer ${req.params.customerName} and shipTo ${req.params.shipTo}:`, error);
      res.status(500).json({ error: "Failed to fetch Ship2 IDs" });
    }
  });

  app.get("/api/reference/tech-comments", async (req, res) => {
    try {
      const comments = await referenceDataService.getTechComments();
      res.json(comments);
    } catch (error) {
      console.error("Failed to get tech comments:", error);
      res.status(500).json({ error: "Failed to fetch tech comments" });
    }
  });

  app.get("/api/reference/send-clamps-gaskets", async (req, res) => {
    try {
      const options = await referenceDataService.getSendClampsGaskets();
      res.json(options);
    } catch (error) {
      console.error("Failed to get send clamps gaskets options:", error);
      res.status(500).json({ error: "Failed to fetch send clamps gaskets options" });
    }
  });

  app.get("/api/reference/preferred-processes", async (req, res) => {
    try {
      const processes = await referenceDataService.getPreferredProcesses();
      res.json(processes);
    } catch (error) {
      console.error("Failed to get preferred processes:", error);
      res.status(500).json({ error: "Failed to fetch preferred processes" });
    }
  });

  app.get("/api/reference/customer-instructions/:customerName", async (req, res) => {
    try {
      const { customerName } = req.params;
      const instructions = await referenceDataService.getCustomerSpecificInstructions(decodeURIComponent(customerName));
      res.json({ instructions });
    } catch (error) {
      console.error("Failed to get customer instructions:", error);
      res.status(500).json({ error: "Failed to fetch customer instructions" });
    }
  });

  app.get("/api/reference/customer-notes", async (req, res) => {
    try {
      const notes = await referenceDataService.getCustomerNotes();
      res.json(notes);
    } catch (error) {
      console.error("Failed to get customer notes:", error);
      res.status(500).json({ error: "Failed to fetch customer notes" });
    }
  });

  // Debug endpoint to check column data
  app.get("/api/debug/columns", async (req, res) => {
    try {
      const debugData = await referenceDataService.getDebugColumnData();
      res.json(debugData);
    } catch (error) {
      console.error("Failed to get debug data:", error);
      res.status(500).json({ error: "Failed to fetch debug data" });
    }
  });

  // Specific endpoint to check column 11
  app.get("/api/debug/column11", async (req, res) => {
    try {
      const col11Data = await referenceDataService.getColumn11Data();
      res.json(col11Data);
    } catch (error) {
      console.error("Failed to get column 11 data:", error);
      res.status(500).json({ error: "Failed to fetch column 11 data" });
    }
  });

  // Show row 1 data for all columns
  app.get("/api/debug/row1", async (req, res) => {
    try {
      const rowData = await referenceDataService.getRow1Data();
      res.json(rowData);
    } catch (error) {
      console.error("Failed to get row 1 data:", error);
      res.status(500).json({ error: "Failed to fetch row 1 data" });
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
        const submissionId = await goCanvasService.createSubmission(job);
        
        if (submissionId && typeof submissionId === 'string' && !submissionId.startsWith('skip-')) {
          // Update job with GoCanvas submission ID
          await storage.updateJob(job.id, {
            gocanvasSubmissionId: submissionId,
            gocanvasSynced: "true",
          });
          console.log(`Created GoCanvas submission ${submissionId} for job ${job.jobId}`);
        } else {
          console.log(`Job ${job.jobId} created - GoCanvas submission ${submissionId}`);
        }
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

  // GoCanvas API endpoints
  app.get("/api/gocanvas/forms", async (req, res) => {
    try {
      const forms = await goCanvasService.listForms();
      res.json(forms);
    } catch (error) {
      console.error("Error fetching GoCanvas forms:", error);
      res.status(500).json({ error: "Failed to fetch forms from GoCanvas" });
    }
  });

  app.get("/api/gocanvas/forms/:id", async (req, res) => {
    try {
      const formDetails = await goCanvasService.getFormDetails(req.params.id);
      res.json(formDetails);
    } catch (error) {
      console.error("Error fetching form details:", error);
      res.status(500).json({ error: "Failed to fetch form details from GoCanvas" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
