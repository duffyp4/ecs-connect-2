import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertJobSchema, pickupJobSchema } from "@shared/schema";
import { goCanvasService } from "./services/gocanvas";
import { fieldMapper } from "@shared/fieldMapper";
import { googleSheetsService } from "./services/googleSheets";
import { jobTrackerService } from "./services/jobTracker";
import { referenceDataService } from "./services/referenceData";
import { jobEventsService } from "./services/jobEvents";
import { setupAuth, requireAuth } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);

  // Start job tracking polling
  jobTrackerService.startPolling();

  // Get all technicians - protected route
  app.get("/api/technicians", requireAuth, async (req, res) => {
    try {
      const jobs = await storage.getAllJobs();
      // Extract unique shop handoff emails from jobs
      const emailSet = new Set(jobs.map(job => job.shopHandoff).filter(Boolean));
      const uniqueEmails = Array.from(emailSet);
      // Convert to format expected by frontend: [{id, name, email}]
      const technicians = uniqueEmails.map(email => ({
        id: email,
        name: email.split('@')[0], // Use part before @ as display name
        email: email
      }));
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
      const { shipTo } = req.query;
      const instructions = await referenceDataService.getCustomerSpecificInstructions(
        decodeURIComponent(customerName),
        shipTo ? decodeURIComponent(shipTo as string) : undefined
      );
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

  // Get specific customer record details
  app.get("/api/debug/customer/:customerName", async (req, res) => {
    try {
      const customerData = await referenceDataService.getCustomerRecord(req.params.customerName);
      res.json(customerData);
    } catch (error) {
      console.error("Failed to get customer data:", error);
      res.status(500).json({ error: "Failed to fetch customer data" });
    }
  });

  // Get customer-specific reference data values
  app.get("/api/reference/customer-specific/:customerName", async (req, res) => {
    try {
      const { customerName } = req.params;
      const { shipTo } = req.query;
      const customerData = await referenceDataService.getCustomerSpecificData(
        decodeURIComponent(customerName),
        shipTo ? decodeURIComponent(shipTo as string) : undefined
      );
      res.json(customerData);
    } catch (error) {
      console.error("Failed to get customer specific data:", error);
      res.status(500).json({ error: "Failed to fetch customer specific data" });
    }
  });

  // Get all unique shop names from the reference data
  app.get("/api/reference/all-shops", async (req, res) => {
    try {
      const shops = await referenceDataService.getAllShops();
      res.json(shops);
    } catch (error) {
      console.error("Failed to get all shops:", error);
      res.status(500).json({ error: "Failed to fetch all shops" });
    }
  });

  // Get users for a specific shop
  app.get("/api/reference/shop/:shopName/users", async (req, res) => {
    try {
      const { shopName } = req.params;
      const users = await referenceDataService.getUsersForShop(decodeURIComponent(shopName));
      res.json(users);
    } catch (error) {
      console.error("Failed to get users for shop:", error);
      res.status(500).json({ error: "Failed to fetch users for shop" });
    }
  });

  // Get drivers for pickup/delivery
  app.get("/api/reference/drivers", async (req, res) => {
    try {
      const drivers = await referenceDataService.getDrivers();
      res.json(drivers);
    } catch (error) {
      console.error("Failed to get drivers:", error);
      res.status(500).json({ error: "Failed to fetch drivers" });
    }
  });

  // Get driver details (name + email) for pickup/delivery
  app.get("/api/reference/driver-details", async (req, res) => {
    try {
      const driverDetails = await referenceDataService.getDriverDetails();
      res.json(driverDetails);
    } catch (error) {
      console.error("Failed to get driver details:", error);
      res.status(500).json({ error: "Failed to fetch driver details" });
    }
  });

  // Get locations from ECS Locations - Drivers reference data
  app.get("/api/reference/locations", async (req, res) => {
    try {
      const locations = await referenceDataService.getLocations();
      res.json(locations);
    } catch (error) {
      console.error("Failed to get locations:", error);
      res.status(500).json({ error: "Failed to fetch locations" });
    }
  });

  // Create new job
  app.post("/api/jobs", requireAuth, async (req, res) => {
    try {
      const { arrivalPath, ...jobData } = req.body;
      
      // Validate using appropriate schema based on arrival path
      const schema = arrivalPath === 'pickup' ? pickupJobSchema : insertJobSchema;
      const validatedData = schema.parse(jobData);
      
      // Create job in storage (starts in queued_for_pickup state)
      const job = await storage.createJob(validatedData);
      
      // NOTE: Emissions Service Log will be created at check-in time, not here
      // This prevents duplicate dispatches for pickup jobs
      console.log(`Job ${job.jobId} created in ${job.state} state (arrival path: ${arrivalPath})`);

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

  // Job Action Endpoints - Pickup and Delivery Workflow
  
  // Dispatch pickup for a job
  app.post("/api/jobs/:jobId/dispatch-pickup", requireAuth, async (req, res) => {
    try {
      const { jobId } = req.params;
      const { driverEmail, pickupNotes } = req.body;
      
      if (!driverEmail) {
        return res.status(400).json({ message: "Driver email is required" });
      }

      const updatedJob = await jobEventsService.dispatchPickup(
        jobId,
        {
          driverEmail,
          pickupNotes,
        }
      );
      
      res.json(updatedJob);
    } catch (error) {
      console.error("Error dispatching pickup:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to dispatch pickup" });
    }
  });

  // Mark job as picked up
  app.post("/api/jobs/:jobId/mark-picked-up", requireAuth, async (req, res) => {
    try {
      const { jobId } = req.params;
      const { itemCount } = req.body;

      const updatedJob = await jobEventsService.markPickedUp(jobId, itemCount);
      res.json(updatedJob);
    } catch (error) {
      console.error("Error marking job as picked up:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to mark job as picked up" });
    }
  });

  // Check in job at shop
  app.post("/api/jobs/:jobId/check-in", requireAuth, async (req, res) => {
    try {
      const { jobId } = req.params;
      
      // Validate request body with insertJobSchema (same as original form)
      const validationResult = insertJobSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validationResult.error.errors
        });
      }
      
      const jobData = validationResult.data;
      
      // Update the job with the validated data
      if (Object.keys(jobData).length > 0) {
        await storage.updateJob(jobId, jobData);
      }
      
      const updatedJob = await jobEventsService.checkInAtShop(jobId);
      
      // Create Emissions Service Log dispatch when job is checked in at shop
      try {
        const submissionId = await goCanvasService.createSubmission(updatedJob);
        
        if (submissionId && typeof submissionId === 'string' && !submissionId.startsWith('skip-')) {
          await storage.updateJob(updatedJob.id, {
            gocanvasSubmissionId: submissionId,
            gocanvasSynced: "true",
          });
          console.log(`Created Emissions Service Log ${submissionId} for job ${updatedJob.jobId} at check-in`);
        }
      } catch (gocanvasError) {
        console.error("Emissions Service Log creation failed at check-in:", gocanvasError);
        // Job is still checked in, but GoCanvas sync failed
      }
      
      res.json(updatedJob);
    } catch (error) {
      console.error("Error checking in job:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to check in job" });
    }
  });

  // Start service on job
  app.post("/api/jobs/:jobId/start-service", requireAuth, async (req, res) => {
    try {
      const { jobId } = req.params;
      const { technicianName } = req.body;
      
      if (!technicianName) {
        return res.status(400).json({ message: "Technician name is required" });
      }

      const updatedJob = await jobEventsService.startService(jobId, technicianName);
      res.json(updatedJob);
    } catch (error) {
      console.error("Error starting service:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to start service" });
    }
  });

  // Mark job as ready (for pickup or delivery)
  app.post("/api/jobs/:jobId/mark-ready", requireAuth, async (req, res) => {
    try {
      const { jobId } = req.params;
      const { deliveryMethod } = req.body;
      
      if (!deliveryMethod || !['pickup', 'delivery'].includes(deliveryMethod)) {
        return res.status(400).json({ message: "Valid delivery method (pickup or delivery) is required" });
      }

      const updatedJob = await jobEventsService.markReady(jobId, deliveryMethod);
      res.json(updatedJob);
    } catch (error) {
      console.error("Error marking job as ready:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to mark job as ready" });
    }
  });

  // Dispatch delivery for a job
  app.post("/api/jobs/:jobId/dispatch-delivery", requireAuth, async (req, res) => {
    try {
      const { jobId } = req.params;
      const { driverEmail, deliveryAddress, deliveryNotes } = req.body;
      
      if (!driverEmail || !deliveryAddress) {
        return res.status(400).json({ message: "Driver email and delivery address are required" });
      }

      const updatedJob = await jobEventsService.dispatchDelivery(jobId, {
        driverEmail,
        deliveryAddress,
        deliveryNotes,
      });
      
      res.json(updatedJob);
    } catch (error) {
      console.error("Error dispatching delivery:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to dispatch delivery" });
    }
  });

  // Mark job as delivered
  app.post("/api/jobs/:jobId/mark-delivered", requireAuth, async (req, res) => {
    try {
      const { jobId } = req.params;
      const updatedJob = await jobEventsService.markDelivered(jobId);
      res.json(updatedJob);
    } catch (error) {
      console.error("Error marking job as delivered:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to mark job as delivered" });
    }
  });

  // Cancel job
  app.post("/api/jobs/:jobId/cancel", requireAuth, async (req, res) => {
    try {
      const { jobId } = req.params;
      const { reason } = req.body;
      const updatedJob = await jobEventsService.cancelJob(jobId, reason);
      res.json(updatedJob);
    } catch (error) {
      console.error("Error cancelling job:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to cancel job" });
    }
  });

  // Get job events timeline
  app.get("/api/jobs/:jobId/events", requireAuth, async (req, res) => {
    try {
      const { jobId } = req.params;
      const events = await storage.getJobEvents(jobId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching job events:", error);
      res.status(500).json({ message: "Failed to fetch job events" });
    }
  });

  // Get all jobs
  app.get("/api/jobs", requireAuth, async (req, res) => {
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

  // Debug endpoint to manually check job status
  app.post("/api/debug/check-job-status", async (req, res) => {
    try {
      const { jobId, submissionGuid } = req.body;
      if (!jobId) {
        return res.status(400).json({ message: "Job ID required" });
      }

      console.log(`DEBUG: Manually checking status for job ${jobId}`);
      
      // If a specific submission GUID is provided, test that directly
      if (submissionGuid) {
        try {
          console.log(`DEBUG: Testing direct submission query for GUID: ${submissionGuid}`);
          const submissionResponse = await fetch(`http://localhost:5000/api/gocanvas/submissions/${submissionGuid}`);
          const submissionData = submissionResponse.ok ? await submissionResponse.json() : null;
          console.log(`DEBUG: Direct submission data:`, submissionData);
        } catch (err) {
          console.log(`DEBUG: Direct submission query failed:`, err);
        }
      }

      const gocanvasStatus = await goCanvasService.checkSubmissionStatus(jobId);
      console.log(`DEBUG: GoCanvas returned status: ${gocanvasStatus}`);
      
      // Get job from database
      const jobs = await storage.getAllJobs();
      const job = jobs.find(j => j.jobId === jobId);
      
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      console.log(`DEBUG: Database job status: ${job.status}`);
      console.log(`DEBUG: GoCanvas submission ID: ${job.gocanvasSubmissionId}`);

      res.json({
        jobId,
        databaseStatus: job.status,
        gocanvasStatus,
        gocanvasSubmissionId: job.gocanvasSubmissionId,
        initiated: job.initiatedAt
      });
    } catch (error) {
      console.error("Debug check failed:", error);
      res.status(500).json({ message: "Debug check failed", error: String(error) });
    }
  });

  // Force manual polling check
  app.post("/api/debug/force-poll", async (req, res) => {
    try {
      console.log("DEBUG: Forcing manual polling check...");
      // Note: checkPendingJobs is private, so we'll manually trigger the same logic
      res.json({ message: "Manual polling check not available - method is private" });
    } catch (error) {
      console.error("Manual polling failed:", error);
      res.status(500).json({ message: "Manual polling failed", error: String(error) });
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

  // Get specific submission by ID
  app.get("/api/gocanvas/submission/:id", async (req, res) => {
    try {
      console.log('=== GoCanvas Submission by ID API Called ===');
      const submissionId = req.params.id;
      console.log('Submission ID:', submissionId);
      
      const submission = await goCanvasService.getSubmissionById(submissionId);
      console.log('=== GoCanvas Service Response ===');
      console.log(JSON.stringify(submission, null, 2));
      
      // Ensure we're sending JSON
      res.setHeader('Content-Type', 'application/json');
      res.status(200).json(submission || { message: 'No submission data available' });
    } catch (error) {
      console.error("Error fetching submission by ID:", error);
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({ error: "Failed to fetch submission", details: error.message });
    }
  });

  // Get most recent submission with workflow data
  app.get("/api/gocanvas/recent-submission", async (req, res) => {
    try {
      console.log('=== GoCanvas Recent Submission API Called ===');
      console.log('Headers:', req.headers);
      console.log('URL:', req.url);
      
      const submission = await goCanvasService.getMostRecentSubmission();
      console.log('=== GoCanvas Service Response ===');
      console.log(JSON.stringify(submission, null, 2));
      
      // Ensure we're sending JSON
      res.setHeader('Content-Type', 'application/json');
      res.status(200).json(submission || { message: 'No submission data available' });
    } catch (error) {
      console.error("Error fetching recent submission:", error);
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({ error: "Failed to fetch recent submission", details: error.message });
    }
  });

  // Get all field labels for a specific job ID (debugging)
  app.get("/api/gocanvas/all-fields/:jobId", async (req, res) => {
    try {
      console.log('=== GoCanvas All Fields API Called ===');
      const jobId = req.params.jobId;
      
      // Get all submissions for the form
      const response = await fetch(`https://api.gocanvas.com/api/v3/submissions?form_id=${process.env.GOCANVAS_FORM_ID || '5594156'}`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${process.env.GOCANVAS_USERNAME}:${process.env.GOCANVAS_PASSWORD}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return res.status(500).json({ error: 'Failed to fetch submissions' });
      }

      const data = await response.json();
      const submissions = Array.isArray(data) ? data : (data.submissions || data.data || []);
      
      // Find the submission with matching job ID
      let targetSubmission = null;
      
      for (const submission of submissions) {
        try {
          const detailResponse = await fetch(`https://api.gocanvas.com/api/v3/submissions/${submission.id}`, {
            headers: {
              'Authorization': `Basic ${Buffer.from(`${process.env.GOCANVAS_USERNAME}:${process.env.GOCANVAS_PASSWORD}`).toString('base64')}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (detailResponse.ok) {
            const detailData = await detailResponse.json();
            
            // Search through form fields for our Job ID
            if (detailData.responses) {
              const jobIdField = detailData.responses.find((field: any) => 
                field.value === jobId && 
                field.label?.toLowerCase().includes('job')
              );
              
              if (jobIdField) {
                targetSubmission = detailData;
                break;
              }
            }
          }
        } catch (err) {
          // Continue searching
        }
      }
      
      if (!targetSubmission) {
        return res.status(404).json({ error: 'Job submission not found' });
      }

      // Return all field labels and search for exact matches
      const allLabels = targetSubmission.responses.map((r: any) => r.label);
      const handoffDateField = targetSubmission.responses.find((r: any) => r.label === 'Handoff Date');
      const handoffTimeField = targetSubmission.responses.find((r: any) => r.label === 'Handoff Time');
      
      res.json({
        jobId,
        totalFields: targetSubmission.responses.length,
        allFieldLabels: allLabels,
        handoffDateFound: !!handoffDateField,
        handoffTimeFound: !!handoffTimeField,
        handoffDateData: handoffDateField || null,
        handoffTimeData: handoffTimeField || null,
        // Include fields containing "handoff" in the name
        handoffFields: targetSubmission.responses.filter((r: any) => 
          r.label && r.label.toLowerCase().includes('handoff')
        )
      });
      
    } catch (error) {
      console.error("Error fetching all fields:", error);
      res.status(500).json({ error: "Failed to fetch all fields", details: error.message });
    }
  });

  // Test handoff data retrieval for debugging
  app.get("/api/test-handoff/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;
      console.log(`🧪 TESTING handoff data retrieval for job ${jobId}`);
      
      const handoffData = await goCanvasService.getHandoffTimeData(jobId);
      
      return res.json({
        jobId,
        handoffData,
        status: handoffData ? 'found' : 'not_found',
        hasHandoffFields: handoffData?.handoffFields ? handoffData.handoffFields.length : 0
      });
    } catch (error) {
      console.error('Error testing handoff data:', error);
      return res.status(500).json({ error: 'Failed to test handoff data', details: error.message });
    }
  });

  // Get handoff time data for a specific job ID
  app.get("/api/gocanvas/handoff-time/:jobId", async (req, res) => {
    try {
      console.log('=== GoCanvas Handoff Time API Called ===');
      const jobId = req.params.jobId;
      console.log('Job ID:', jobId);
      
      const handoffData = await goCanvasService.getHandoffTimeData(jobId);
      console.log('=== GoCanvas Handoff Service Response ===');
      console.log(JSON.stringify(handoffData, null, 2));
      
      // Ensure we're sending JSON
      res.setHeader('Content-Type', 'application/json');
      res.status(200).json(handoffData || { message: 'No handoff data available for this job' });
    } catch (error) {
      console.error("Error fetching handoff time data:", error);
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({ error: "Failed to fetch handoff time data", details: error.message });
    }
  });

  // Test direct submissions access
  app.get("/api/gocanvas/submissions", async (req, res) => {
    try {
      const formId = req.query.form_id || process.env.GOCANVAS_FORM_ID || '5594156';
      console.log(`Testing submissions API for form: ${formId}`);
      const response = await fetch(`https://api.gocanvas.com/api/v3/submissions?form_id=${formId}`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${process.env.GOCANVAS_USERNAME}:${process.env.GOCANVAS_PASSWORD}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log(`Submissions API response status: ${response.status}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`Submissions API error: ${errorText}`);
        return res.status(response.status).json({ error: errorText });
      }
      
      const xmlText = await response.text();
      console.log(`XML Response (first 500 chars):`, xmlText.substring(0, 500));
      console.log(`Total XML length: ${xmlText.length} characters`);
      
      // Try to parse basic structure
      const submissionElements = xmlText.match(/<[^>]*submission[^>]*>/g) || [];
      console.log(`Found ${submissionElements.length} submission-related elements`);
      
      res.json({ 
        xmlLength: xmlText.length,
        firstChars: xmlText.substring(0, 500),
        submissionElements: submissionElements.length,
        structure: submissionElements 
      });
    } catch (error) {
      console.error("Error testing submissions API:", error);
      res.status(500).json({ error: "Failed to test submissions API" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
