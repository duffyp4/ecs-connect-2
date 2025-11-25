import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertJobSchema, pickupJobSchema } from "@shared/schema";
import { goCanvasService } from "./services/gocanvas";
import { googleSheetsService } from "./services/googleSheets";
import { jobTrackerService } from "./services/jobTracker";
import { referenceDataService } from "./services/referenceData";
import { jobEventsService } from "./services/jobEvents";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { webhookService, webhookMetrics } from "./services/webhook";
import { updatePartsFromSubmission, handleAdditionalComments } from "./services/parts-update";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup Replit Auth
  await setupAuth(app);

  // Middleware to check if user is admin
  const isAdmin = async (req: any, res: any, next: any) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      next();
    } catch (error) {
      console.error("Error checking admin status:", error);
      res.status(500).json({ message: "Failed to verify admin status" });
    }
  };

  // Auth routes - get authenticated user info
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Update user timezone preference
  app.patch('/api/auth/user/timezone', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { timezone } = req.body;
      
      if (!timezone) {
        return res.status(400).json({ message: "Timezone is required" });
      }
      
      const user = await storage.updateUserTimezone(userId, timezone);
      res.json(user);
    } catch (error) {
      console.error("Error updating user timezone:", error);
      res.status(500).json({ message: "Failed to update timezone" });
    }
  });

  // Admin: Whitelist management routes
  app.get('/api/admin/whitelist', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const whitelistEntries = await storage.getAllWhitelist();
      res.json(whitelistEntries);
    } catch (error) {
      console.error("Error fetching whitelist:", error);
      res.status(500).json({ message: "Failed to fetch whitelist" });
    }
  });

  app.post('/api/admin/whitelist', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const userId = req.user.claims.sub;
      const entry = await storage.addToWhitelist({ email, addedBy: userId });
      res.json(entry);
    } catch (error: any) {
      console.error("Error adding to whitelist:", error);
      if (error.code === '23505') {
        return res.status(409).json({ message: "Email already whitelisted" });
      }
      res.status(500).json({ message: "Failed to add email to whitelist" });
    }
  });

  app.delete('/api/admin/whitelist/:email', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { email } = req.params;
      await storage.removeFromWhitelist(decodeURIComponent(email));
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing from whitelist:", error);
      res.status(500).json({ message: "Failed to remove email from whitelist" });
    }
  });

  // Admin: Make user an admin
  app.post('/api/admin/users/:userId/make-admin', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.updateUserRole(userId, 'admin');
      res.json(user);
    } catch (error) {
      console.error("Error making user admin:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  // Admin: GoCanvas integration metrics (read-only observability)
  app.get('/api/metrics/gocanvas', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { goCanvasMetrics } = await import('./services/gocanvas');
      res.json({
        now: new Date().toISOString(),
        ...goCanvasMetrics,
      });
    } catch (error) {
      console.error("Error fetching GoCanvas metrics:", error);
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

  // Admin: Webhook metrics
  app.get('/api/metrics/webhooks', isAuthenticated, isAdmin, async (req, res) => {
    try {
      res.json({
        now: new Date().toISOString(),
        ...webhookMetrics,
      });
    } catch (error) {
      console.error("Error fetching webhook metrics:", error);
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

  // GoCanvas Webhook (unauthenticated - called by GoCanvas)
  app.post('/api/gocanvas/webhook', async (req, res) => {
    try {
      // Return 200 immediately (GoCanvas requirement for retry logic)
      res.status(200).send('OK');
      
      // Process notification asynchronously
      const contentType = req.headers['content-type'] || '';
      const xmlBody = typeof req.body === 'string' ? req.body : '';
      
      console.log('📨 Webhook received from GoCanvas');
      console.log('Content-Type:', contentType);
      console.log('Body type:', typeof req.body);
      
      // Process in background (don't await)
      webhookService.processGoCanvasWebhook(xmlBody, contentType)
        .catch(error => {
          console.error('❌ Background webhook processing failed:', error);
        });
      
    } catch (error) {
      console.error("Error handling webhook:", error);
      // Already sent 200, so just log the error
    }
  });

  // Start job tracking polling
  jobTrackerService.startPolling();

  // Get all technicians - protected route
  app.get("/api/technicians", isAuthenticated, async (req, res) => {
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

  // Get parts from Parts reference data
  app.get("/api/reference/parts", async (req, res) => {
    try {
      const parts = await referenceDataService.getParts();
      res.json(parts);
    } catch (error) {
      console.error("Failed to get parts:", error);
      res.status(500).json({ error: "Failed to fetch parts" });
    }
  });

  // Get processes from Process reference data
  app.get("/api/reference/processes", async (req, res) => {
    try {
      const processes = await referenceDataService.getProcesses();
      res.json(processes);
    } catch (error) {
      console.error("Failed to get processes:", error);
      res.status(500).json({ error: "Failed to fetch processes" });
    }
  });

  // Get filter part numbers from Emission_pn_w kits reference data
  app.get("/api/reference/filter-part-numbers", async (req, res) => {
    try {
      const filterPartNumbers = await referenceDataService.getFilterPartNumbers();
      res.json(filterPartNumbers);
    } catch (error) {
      console.error("Failed to get filter part numbers:", error);
      res.status(500).json({ error: "Failed to fetch filter part numbers" });
    }
  });

  // Create new job
  app.post("/api/jobs", isAuthenticated, async (req, res) => {
    try {
      const { arrivalPath, pickupDriverEmail, pickupNotes, ...jobData } = req.body;
      const userId = req.user.claims.sub;
      
      // Validate using appropriate schema based on arrival path
      const schema = arrivalPath === 'pickup' ? pickupJobSchema : insertJobSchema;
      const validatedData = schema.parse(jobData);
      
      // Create job in storage (starts in queued_for_pickup state)
      const job = await storage.createJob(validatedData);
      
      console.log(`Job ${job.jobId} created in ${job.state} state (arrival path: ${arrivalPath})`);

      // For pickup jobs, dispatch immediately and rollback if it fails
      if (arrivalPath === 'pickup') {
        try {
          if (!pickupDriverEmail) {
            throw new Error("Driver email is required for pickup dispatch");
          }

          await jobEventsService.dispatchPickup(
            job.jobId,
            {
              driverEmail: pickupDriverEmail,
              pickupNotes,
            }
          );
          console.log(`Pickup dispatched successfully for job ${job.jobId}`);
          
          // If pickup notes were provided, add them as a job comment
          if (pickupNotes && pickupNotes.trim()) {
            await storage.createJobComment({
              jobId: job.jobId,
              userId,
              commentText: `[Pickup Notes] ${pickupNotes.trim()}`,
            });
          }
        } catch (dispatchError) {
          // Dispatch failed - rollback the job creation
          console.error(`Pickup dispatch failed for job ${job.jobId}, rolling back job creation:`, dispatchError);
          await storage.deleteJob(job.id);
          throw new Error(`Failed to dispatch pickup: ${dispatchError instanceof Error ? dispatchError.message : 'Unknown error'}`);
        }
      }

      const updatedJob = await storage.getJob(job.id);
      res.json(updatedJob);
    } catch (error) {
      console.error("Error creating job:", error);
      if (error instanceof Error && error.name === 'ZodError') {
        res.status(400).json({ message: "Invalid job data", errors: error });
      } else {
        res.status(500).json({ message: error instanceof Error ? error.message : "Failed to create job" });
      }
    }
  });

  // Job Action Endpoints - Pickup and Delivery Workflow
  
  // Dispatch pickup for a job
  app.post("/api/jobs/:jobId/dispatch-pickup", isAuthenticated, async (req, res) => {
    try {
      const { jobId } = req.params;
      const { driverEmail, pickupNotes } = req.body;
      const userId = req.user.claims.sub;
      
      if (!driverEmail) {
        return res.status(400).json({ message: "Driver email is required" });
      }

      // Get job to extract the ECS-formatted jobId
      const job = await storage.getJobByJobId(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const updatedJob = await jobEventsService.dispatchPickup(
        job.jobId,
        {
          driverEmail,
          pickupNotes,
        }
      );
      
      // If pickup notes were provided, add them as a job comment
      if (pickupNotes && pickupNotes.trim()) {
        await storage.createJobComment({
          jobId: job.jobId,
          userId,
          commentText: `[Pickup Notes] ${pickupNotes.trim()}`,
        });
      }
      
      res.json(updatedJob);
    } catch (error) {
      console.error("Error dispatching pickup:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to dispatch pickup" });
    }
  });

  // Mark job as picked up
  app.post("/api/jobs/:jobId/mark-picked-up", isAuthenticated, async (req, res) => {
    try {
      const { jobId } = req.params;
      const { itemCount } = req.body;

      const job = await storage.getJobByJobId(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const updatedJob = await jobEventsService.markPickedUp(job.jobId, itemCount);
      res.json(updatedJob);
    } catch (error) {
      console.error("Error marking job as picked up:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to mark job as picked up" });
    }
  });

  // Check in job at shop
  app.post("/api/jobs/:jobId/check-in", isAuthenticated, async (req, res) => {
    try {
      const { jobId } = req.params;
      
      // DEBUG: Log incoming request body
      console.log('=== CHECK-IN REQUEST DEBUG ===');
      console.log('Job ID:', jobId);
      console.log('Request body keys:', Object.keys(req.body));
      console.log('shopHandoff value:', req.body.shopHandoff);
      console.log('userId value:', req.body.userId);
      console.log('handoffEmailWorkflow value:', req.body.handoffEmailWorkflow);
      console.log('=============================');
      
      // Get job to extract the ECS-formatted jobId
      const job = await storage.getJobByJobId(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      // Validate all incoming data including userId and shopHandoff
      const validationResult = insertJobSchema.partial().safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validationResult.error.errors
        });
      }
      
      // Validate that shopHandoff is provided (required for GoCanvas dispatch)
      const shopHandoff = validationResult.data.shopHandoff || job.shopHandoff;
      if (!shopHandoff) {
        return res.status(400).json({
          message: "Technician assignment is required to check in at shop. Please select a technician from the 'Shop Handoff / Technician' field."
        });
      }
      
      // Update the job with all provided data FIRST (but don't change state yet)
      if (Object.keys(validationResult.data).length > 0) {
        await storage.updateJob(job.id, validationResult.data);
      }
      
      // Refresh job data after update
      const refreshedJob = await storage.getJobByJobId(jobId);
      if (!refreshedJob) {
        return res.status(404).json({ message: "Job not found after update" });
      }
      
      // STEP 1: Try to create GoCanvas dispatch FIRST
      // This ensures we only check in if GoCanvas accepts the dispatch
      let submissionId: string | null = null;
      try {
        console.log('🚀 Attempting GoCanvas dispatch BEFORE checking in...');
        submissionId = await goCanvasService.dispatchEmissionsForm(refreshedJob, storage);
        
        // Check if dispatch was actually successful
        // Handle both string and non-string return values safely
        const submissionIdStr = String(submissionId || '');
        if (!submissionId || submissionIdStr.startsWith('skip-')) {
          throw new Error('GoCanvas dispatch was skipped or failed - check GoCanvas credentials and configuration');
        }
        
        console.log(`✅ GoCanvas dispatch successful: ${submissionId}`);
      } catch (gocanvasError) {
        console.error("❌ GoCanvas dispatch failed:", gocanvasError);
        
        // Return error to user - do NOT check in the job
        const errorMessage = gocanvasError instanceof Error 
          ? gocanvasError.message 
          : "Failed to dispatch to GoCanvas";
        
        return res.status(500).json({
          message: `Cannot check in: GoCanvas dispatch failed. ${errorMessage}`,
          details: "The job has NOT been checked in. Please verify the technician email is valid in GoCanvas and try again."
        });
      }
      
      // STEP 2: Only if GoCanvas succeeded, update job status and create event
      const updatedJob = await jobEventsService.checkInAtShop(refreshedJob.jobId, {
        metadata: {
          userId: validationResult.data.userId || refreshedJob.userId,
          shopHandoff: shopHandoff,
        },
      });
      
      // STEP 3: Update GoCanvas sync status
      await storage.updateJob(updatedJob.id, {
        gocanvasDispatchId: submissionId,
        gocanvasSynced: "true",
      });
      
      console.log(`✅ Job ${updatedJob.jobId} checked in successfully with GoCanvas submission ${submissionId}`);
      
      // Extract "Note to Tech about Customer or service:" and add as job comment
      // Check both req.body (from form submission) and refreshedJob (from database)
      const noteToTech = req.body.noteToTechAboutCustomer || refreshedJob.noteToTechAboutCustomer;
      if (noteToTech && noteToTech.trim()) {
        try {
          const user = req.user as any;
          const userName = user?.firstName && user?.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user?.email || 'system';
          
          await storage.createJobComment({
            jobId: updatedJob.jobId,
            userId: userName,
            commentText: `[Note to Tech] ${noteToTech.trim()}`,
          });
          
          console.log(`✅ Added tech note as job comment for ${updatedJob.jobId} by ${userName}`);
        } catch (commentError) {
          console.error('Failed to create tech note comment:', commentError);
          // Don't fail the check-in if comment creation fails
        }
      }
      
      res.json(updatedJob);
    } catch (error) {
      console.error("Error checking in job:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to check in job" });
    }
  });

  // Start service on job
  app.post("/api/jobs/:jobId/start-service", isAuthenticated, async (req, res) => {
    try {
      const { jobId } = req.params;
      const { technicianName } = req.body;
      
      if (!technicianName) {
        return res.status(400).json({ message: "Technician name is required" });
      }

      const job = await storage.getJobByJobId(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const updatedJob = await jobEventsService.startService(job.jobId, technicianName);
      res.json(updatedJob);
    } catch (error) {
      console.error("Error starting service:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to start service" });
    }
  });

  // Mark job as ready (for pickup or delivery)
  app.post("/api/jobs/:jobId/mark-ready", isAuthenticated, async (req, res) => {
    try {
      const { jobId } = req.params;
      const { 
        deliveryMethod,
        orderNumber,
        orderNumber2,
        orderNumber3,
        orderNumber4,
        orderNumber5
      } = req.body;
      
      if (!deliveryMethod || !['pickup', 'delivery'].includes(deliveryMethod)) {
        return res.status(400).json({ message: "Valid delivery method (pickup or delivery) is required" });
      }

      const job = await storage.getJobByJobId(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const updatedJob = await jobEventsService.markReady(job.jobId, deliveryMethod, {
        orderNumber,
        orderNumber2,
        orderNumber3,
        orderNumber4,
        orderNumber5,
      });
      res.json(updatedJob);
    } catch (error) {
      console.error("Error marking job as ready:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to mark job as ready" });
    }
  });

  // Dispatch delivery for a job
  app.post("/api/jobs/:jobId/dispatch-delivery", isAuthenticated, async (req, res) => {
    try {
      const { jobId } = req.params;
      const { 
        driverEmail, 
        deliveryAddress, 
        deliveryNotes,
        orderNumber,
        orderNumber2,
        orderNumber3,
        orderNumber4,
        orderNumber5
      } = req.body;
      
      if (!driverEmail || !deliveryAddress) {
        return res.status(400).json({ message: "Driver email and delivery address are required" });
      }

      const job = await storage.getJobByJobId(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const updatedJob = await jobEventsService.dispatchDelivery(job.jobId, {
        driverEmail,
        deliveryAddress,
        deliveryNotes,
        orderNumber,
        orderNumber2,
        orderNumber3,
        orderNumber4,
        orderNumber5,
      });
      
      // Add delivery notes as a comment if provided
      const userId = req.user.claims.sub;
      if (deliveryNotes && deliveryNotes.trim()) {
        await storage.createJobComment({
          jobId: job.jobId,
          userId,
          commentText: `[Delivery Notes] ${deliveryNotes.trim()}`,
        });
      }
      
      res.json(updatedJob);
    } catch (error) {
      console.error("Error dispatching delivery:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to dispatch delivery" });
    }
  });

  // Mark job as delivered
  app.post("/api/jobs/:jobId/mark-delivered", isAuthenticated, async (req, res) => {
    try {
      const { jobId } = req.params;
      
      const job = await storage.getJobByJobId(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      const updatedJob = await jobEventsService.markDelivered(job.jobId);
      res.json(updatedJob);
    } catch (error) {
      console.error("Error marking job as delivered:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to mark job as delivered" });
    }
  });

  // Mark job as picked up from shop (post-completion tracking)
  app.post("/api/jobs/:jobId/mark-picked-up-from-shop", isAuthenticated, async (req, res) => {
    try {
      const { jobId } = req.params;
      
      const job = await storage.getJobByJobId(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      const updatedJob = await jobEventsService.markPickedUpFromShop(job.jobId);
      res.json(updatedJob);
    } catch (error) {
      console.error("Error marking job as picked up from shop:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to mark job as picked up from shop" });
    }
  });

  // Cancel job
  app.post("/api/jobs/:jobId/cancel", isAuthenticated, async (req, res) => {
    try {
      const { jobId } = req.params;
      const { reason } = req.body;
      
      const job = await storage.getJobByJobId(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      const updatedJob = await jobEventsService.cancelJob(job.jobId, reason);
      res.json(updatedJob);
    } catch (error) {
      console.error("Error cancelling job:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to cancel job" });
    }
  });

  // Get job events timeline
  app.get("/api/jobs/:jobId/events", isAuthenticated, async (req, res) => {
    try {
      const { jobId } = req.params;
      
      // Try to get job by UUID first, then by ECS-formatted jobId
      let job = await storage.getJob(jobId);
      if (!job) {
        job = await storage.getJobByJobId(jobId);
      }
      
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      const events = await storage.getJobEvents(job.jobId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching job events:", error);
      res.status(500).json({ message: "Failed to fetch job events" });
    }
  });

  // Get job comments
  app.get("/api/jobs/:jobId/comments", isAuthenticated, async (req, res) => {
    try {
      const { jobId } = req.params;
      
      // Try to get job by UUID first, then by ECS-formatted jobId
      let job = await storage.getJob(jobId);
      if (!job) {
        job = await storage.getJobByJobId(jobId);
      }
      
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      const comments = await storage.getJobComments(job.jobId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching job comments:", error);
      res.status(500).json({ message: "Failed to fetch job comments" });
    }
  });

  // Add job comment
  app.post("/api/jobs/:jobId/comments", isAuthenticated, async (req, res) => {
    try {
      const { jobId } = req.params;
      const { commentText } = req.body;
      const userId = req.user.claims.sub;
      
      if (!commentText || !commentText.trim()) {
        return res.status(400).json({ message: "Comment text is required" });
      }
      
      // Try to get job by UUID first, then by ECS-formatted jobId
      let job = await storage.getJob(jobId);
      if (!job) {
        job = await storage.getJobByJobId(jobId);
      }
      
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      const comment = await storage.createJobComment({
        jobId: job.jobId,
        userId,
        commentText: commentText.trim(),
      });
      
      res.json(comment);
    } catch (error) {
      console.error("Error adding job comment:", error);
      res.status(500).json({ message: "Failed to add comment" });
    }
  });

  // Job Parts API Endpoints
  
  // Get all parts for a job
  app.get("/api/jobs/:jobId/parts", isAuthenticated, async (req, res) => {
    try {
      const { jobId } = req.params;
      
      // Try to get job by UUID first, then by ECS-formatted jobId
      let job = await storage.getJob(jobId);
      if (!job) {
        job = await storage.getJobByJobId(jobId);
      }
      
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      const parts = await storage.getJobParts(job.jobId);
      res.json(parts);
    } catch (error) {
      console.error("Error fetching job parts:", error);
      res.status(500).json({ message: "Failed to fetch job parts" });
    }
  });

  // Add a new part to a job
  app.post("/api/jobs/:jobId/parts", isAuthenticated, async (req, res) => {
    try {
      const { jobId } = req.params;
      
      // Try to get job by UUID first, then by ECS-formatted jobId
      let job = await storage.getJob(jobId);
      if (!job) {
        job = await storage.getJobByJobId(jobId);
      }
      
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      // Validate part data using Zod schema
      const { insertJobPartSchema } = await import("@shared/schema");
      const partData = insertJobPartSchema.parse({
        ...req.body,
        jobId: job.jobId,
      });
      
      const part = await storage.createJobPart(partData);
      res.json(part);
    } catch (error: any) {
      console.error("Error creating job part:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create job part" });
    }
  });

  // Update a part (PATCH for partial updates, PUT for full updates)
  const updatePartHandler = async (req: any, res: any) => {
    try {
      const { jobId, partId } = req.params;
      const isPatch = req.method === 'PATCH';
      
      // Verify job exists
      let job = await storage.getJob(jobId);
      if (!job) {
        job = await storage.getJobByJobId(jobId);
      }
      
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      // For PATCH requests, allow partial updates (don't require all fields)
      // For PUT requests, require all fields
      const { insertJobPartSchema } = await import("@shared/schema");
      const schema = isPatch ? insertJobPartSchema.partial() : insertJobPartSchema;
      
      const partData = schema.parse({
        ...req.body,
        jobId: job.jobId,
      });
      
      const updatedPart = await storage.updateJobPart(partId, partData);
      
      if (!updatedPart) {
        return res.status(404).json({ message: "Part not found" });
      }
      
      res.json(updatedPart);
    } catch (error: any) {
      console.error("Error updating job part:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update job part" });
    }
  };
  
  app.patch("/api/jobs/:jobId/parts/:partId", isAuthenticated, updatePartHandler);
  app.put("/api/jobs/:jobId/parts/:partId", isAuthenticated, updatePartHandler);

  // Delete a part
  app.delete("/api/jobs/:jobId/parts/:partId", isAuthenticated, async (req, res) => {
    try {
      const { jobId, partId } = req.params;
      
      // Verify job exists
      let job = await storage.getJob(jobId);
      if (!job) {
        job = await storage.getJobByJobId(jobId);
      }
      
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      await storage.deleteJobPart(partId);
      res.json({ message: "Part deleted successfully" });
    } catch (error) {
      console.error("Error deleting job part:", error);
      res.status(500).json({ message: "Failed to delete job part" });
    }
  });

  // Get all jobs
  app.get("/api/jobs", isAuthenticated, async (req, res) => {
    try {
      const { status, search, dateFrom, dateTo, sortBy, sortOrder, page, pageSize } = req.query;
      
      let jobs = await storage.getAllJobs();
      
      // Filter by status (supports comma-separated values for multi-select)
      if (status && typeof status === 'string' && status.trim()) {
        const statuses = status.split(',').map(s => s.trim()).filter(s => s);
        if (statuses.length > 0) {
          jobs = jobs.filter(job => statuses.includes(job.state));
        }
      }
      
      // Filter by search query (Job ID or Customer Name)
      if (search && typeof search === 'string' && search.trim()) {
        const searchLower = search.toLowerCase().trim();
        jobs = jobs.filter(job => 
          String(job.jobId ?? '').toLowerCase().includes(searchLower) ||
          String(job.customerName ?? '').toLowerCase().includes(searchLower)
        );
      }
      
      // Filter by date range (initiated date)
      if (dateFrom && typeof dateFrom === 'string' && dateFrom.trim()) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        jobs = jobs.filter(job => {
          if (!job.initiatedAt) return false;
          const jobDate = new Date(job.initiatedAt);
          return jobDate >= fromDate;
        });
      }
      
      if (dateTo && typeof dateTo === 'string' && dateTo.trim()) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        jobs = jobs.filter(job => {
          if (!job.initiatedAt) return false;
          const jobDate = new Date(job.initiatedAt);
          return jobDate <= toDate;
        });
      }
      
      // Sort jobs
      if (sortBy && typeof sortBy === 'string') {
        const order = sortOrder === 'asc' ? 1 : -1;
        jobs.sort((a, b) => {
          let aVal: any = a[sortBy as keyof typeof a];
          let bVal: any = b[sortBy as keyof typeof b];
          
          // Handle null/undefined values - push them to the end
          if (aVal == null && bVal == null) return 0;
          if (aVal == null) return 1;
          if (bVal == null) return -1;
          
          // Handle dates
          if (sortBy.includes('At')) {
            aVal = new Date(aVal).getTime();
            bVal = new Date(bVal).getTime();
          }
          
          // Handle strings
          if (typeof aVal === 'string' && typeof bVal === 'string') {
            return order * aVal.localeCompare(bVal);
          }
          
          // Handle numbers
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return order * (aVal - bVal);
          }
          
          // Fallback: convert to strings and compare
          return order * String(aVal).localeCompare(String(bVal));
        });
      }
      
      // Calculate total before pagination
      const total = jobs.length;
      
      // Apply pagination
      const currentPage = page ? parseInt(page as string) : 1;
      const itemsPerPage = pageSize ? parseInt(pageSize as string) : 25;
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      
      const paginatedJobs = jobs.slice(startIndex, endIndex);
      
      // Return paginated response
      res.json({
        data: paginatedJobs,
        total,
        page: currentPage,
        pageSize: itemsPerPage,
      });
    } catch (error) {
      console.error("Error fetching jobs:", error);
      res.status(500).json({ message: "Failed to fetch jobs" });
    }
  });

  // Get job by ID
  app.get("/api/jobs/:id", async (req, res) => {
    try {
      const job = await storage.getJobByJobId(req.params.id);
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

  // Delete job by ID (for rollback on failed operations)
  app.delete("/api/jobs/:jobId", isAuthenticated, async (req, res) => {
    try {
      const { jobId } = req.params;
      
      const job = await storage.getJobByJobId(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      await storage.deleteJob(job.id);
      res.json({ message: "Job deleted successfully", jobId });
    } catch (error) {
      console.error("Error deleting job:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to delete job" });
    }
  });

  // Peek at next ECS serial number for a given shop code and date (doesn't reserve it)
  app.post("/api/serial/generate", isAuthenticated, async (req, res) => {
    try {
      const { shopCode, date } = req.body;
      
      if (!shopCode || !date) {
        return res.status(400).json({ message: "shopCode and date are required" });
      }
      
      // Validate format: shopCode should be 2 chars, date should be MMDDYYYY
      if (shopCode.length !== 2 || !/^\d{8}$/.test(date)) {
        return res.status(400).json({ message: "Invalid format. shopCode must be 2 characters, date must be MMDDYYYY" });
      }
      
      // Peek at next serial without reserving it
      const serialNumber = await storage.peekNextSerialNumber(shopCode, date);
      res.json({ serialNumber });
    } catch (error) {
      console.error("Error generating serial number:", error);
      res.status(500).json({ message: "Failed to generate serial number" });
    }
  });

  // Check if a serial number is valid and available
  app.get("/api/serial/check/:serialNumber", isAuthenticated, async (req, res) => {
    try {
      const { serialNumber } = req.params;
      const { jobId, partId } = req.query;
      
      // Validate format: XX.MMDDYYYY.ZZ (e.g., 01.11242025.01)
      const serialPattern = /^\d{2}\.\d{8}\.\d{2}$/;
      if (!serialPattern.test(serialNumber)) {
        return res.json({
          valid: false,
          available: false,
          error: "Invalid format. Expected: XX.MMDDYYYY.ZZ (e.g., 01.11242025.01)"
        });
      }
      
      // Check if serial number is already in use (excluding current part if editing)
      const isAvailable = await storage.isSerialNumberAvailable(
        serialNumber,
        jobId as string | undefined,
        partId as string | undefined
      );
      
      res.json({
        valid: true,
        available: isAvailable,
        serialNumber
      });
    } catch (error) {
      console.error("Error checking serial number:", error);
      res.status(500).json({ message: "Failed to check serial number" });
    }
  });
  
  // Validate and reserve a manually-entered serial number
  app.post("/api/serial/validate", isAuthenticated, async (req, res) => {
    try {
      const { serialNumber } = req.body;
      
      if (!serialNumber) {
        return res.status(400).json({ message: "serialNumber is required" });
      }
      
      // Validate format: XX.MMDDYYYY.ZZ
      const serialPattern = /^(\d{2})\.(\d{8})\.(\d{2})$/;
      const match = serialNumber.match(serialPattern);
      
      if (!match) {
        return res.status(400).json({ 
          valid: false, 
          message: "Invalid format. Must be XX.MMDDYYYY.ZZ (e.g., 01.11232025.03)" 
        });
      }
      
      const [, shopCode, date, sequence] = match;
      
      // Check if this serial number is already used
      const isAvailable = await storage.isSerialNumberAvailable(serialNumber);
      
      if (!isAvailable) {
        return res.status(400).json({ 
          valid: false, 
          message: "This serial number is already in use" 
        });
      }
      
      // Reserve this serial number
      await storage.reserveSerialNumber(shopCode, date, parseInt(sequence, 10), serialNumber);
      
      res.json({ 
        valid: true, 
        serialNumber,
        message: "Serial number is valid and reserved" 
      });
    } catch (error) {
      console.error("Error validating serial number:", error);
      res.status(500).json({ message: "Failed to validate serial number" });
    }
  });

  // Get all parts with job information
  app.get("/api/parts", isAuthenticated, async (req, res) => {
    try {
      const { status, diagnosis, partStatus, search, dateFrom, dateTo, sortBy, sortOrder, page, pageSize } = req.query;
      
      let parts = await storage.getAllJobParts();
      
      // Filter by job status
      if (status && typeof status === 'string' && status.trim()) {
        const statuses = status.split(',').map(s => s.trim()).filter(s => s);
        if (statuses.length > 0) {
          parts = parts.filter(part => part.job && statuses.includes(part.job.state));
        }
      }
      
      // Filter by part diagnosis
      if (diagnosis && typeof diagnosis === 'string' && diagnosis.trim()) {
        const diagnoses = diagnosis.split(',').map(s => s.trim()).filter(s => s);
        if (diagnoses.length > 0) {
          parts = parts.filter(part => part.diagnosis && diagnoses.includes(part.diagnosis));
        }
      }
      
      // Filter by part status
      if (partStatus && typeof partStatus === 'string' && partStatus.trim()) {
        const statuses = partStatus.split(',').map(s => s.trim()).filter(s => s);
        if (statuses.length > 0) {
          parts = parts.filter(part => part.status && statuses.includes(part.status));
        }
      }
      
      // Filter by search query (Part Name, Job ID, or Customer Name)
      if (search && typeof search === 'string' && search.trim()) {
        const searchLower = search.toLowerCase().trim();
        parts = parts.filter(part => 
          String(part.part ?? '').toLowerCase().includes(searchLower) ||
          String(part.job?.jobId ?? '').toLowerCase().includes(searchLower) ||
          String(part.job?.customerName ?? '').toLowerCase().includes(searchLower)
        );
      }
      
      // Filter by date range (part created date)
      if (dateFrom && typeof dateFrom === 'string' && dateFrom.trim()) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        parts = parts.filter(part => {
          if (!part.createdAt) return false;
          const partDate = new Date(part.createdAt);
          return partDate >= fromDate;
        });
      }
      
      if (dateTo && typeof dateTo === 'string' && dateTo.trim()) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        parts = parts.filter(part => {
          if (!part.createdAt) return false;
          const partDate = new Date(part.createdAt);
          return partDate <= toDate;
        });
      }
      
      // Sort parts
      if (sortBy && typeof sortBy === 'string') {
        const order = sortOrder === 'asc' ? 1 : -1;
        parts.sort((a, b) => {
          let aVal: any;
          let bVal: any;
          
          // Handle nested job properties
          if (sortBy.startsWith('job.')) {
            const jobField = sortBy.substring(4);
            aVal = a.job?.[jobField as keyof typeof a.job];
            bVal = b.job?.[jobField as keyof typeof b.job];
          } else {
            aVal = a[sortBy as keyof typeof a];
            bVal = b[sortBy as keyof typeof b];
          }
          
          // Handle null/undefined values
          if (aVal == null && bVal == null) return 0;
          if (aVal == null) return 1;
          if (bVal == null) return -1;
          
          // Handle dates
          if (sortBy.includes('At')) {
            aVal = new Date(aVal).getTime();
            bVal = new Date(bVal).getTime();
          }
          
          // Handle strings
          if (typeof aVal === 'string' && typeof bVal === 'string') {
            return order * aVal.localeCompare(bVal);
          }
          
          // Handle numbers
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return order * (aVal - bVal);
          }
          
          // Fallback
          return order * String(aVal).localeCompare(String(bVal));
        });
      }
      
      // Calculate total before pagination
      const total = parts.length;
      
      // Apply pagination
      const currentPage = page ? parseInt(page as string) : 1;
      const itemsPerPage = pageSize ? parseInt(pageSize as string) : 25;
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      
      const paginatedParts = parts.slice(startIndex, endIndex);
      
      res.json({
        data: paginatedParts,
        total,
        page: currentPage,
        pageSize: itemsPerPage,
      });
    } catch (error) {
      console.error("Error fetching parts:", error);
      res.status(500).json({ message: "Failed to fetch parts" });
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
      console.log(`DEBUG: GoCanvas dispatch ID: ${job.gocanvasDispatchId}`);

      res.json({
        jobId,
        databaseStatus: job.status,
        gocanvasStatus,
        gocanvasDispatchId: job.gocanvasDispatchId,
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

  // Manual check for updates - state-aware dispatch/submission query
  app.post("/api/jobs/:jobId/check-updates", isAuthenticated, async (req, res) => {
    try {
      const { jobId } = req.params;
      console.log(`🔍 Manual update check requested for job ${jobId}`);
      
      const job = await storage.getJobByJobId(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      console.log(`   Current state: ${job.state}`);
      
      // Determine which dispatch to check based on current state
      // All forms (pickup, emissions, delivery) create dispatches, so we always check dispatch status
      let dispatchToCheck: string | null = null;
      let expectedTransition: string | null = null;
      let formIdToCheck: string | null = null;
      
      switch (job.state) {
        case 'queued_for_pickup':
          dispatchToCheck = job.pickupDispatchId;
          expectedTransition = 'picked_up';
          formIdToCheck = process.env.GOCANVAS_PICKUP_FORM_ID || '5631022';
          console.log(`   Looking for pickup completion (dispatch ${dispatchToCheck})`);
          break;
          
        case 'picked_up':
        case 'at_shop':
          // Check emissions dispatch (created during check-in)
          dispatchToCheck = job.gocanvasDispatchId;
          expectedTransition = 'in_service';
          formIdToCheck = process.env.GOCANVAS_FORM_ID || '5692359';
          console.log(`   Looking for emissions service completion (dispatch ${dispatchToCheck})`);
          break;
          
        case 'ready_for_pickup':
        case 'ready_for_delivery':
        case 'queued_for_delivery':
          dispatchToCheck = job.deliveryDispatchId;
          expectedTransition = 'delivered';
          formIdToCheck = process.env.GOCANVAS_DELIVERY_FORM_ID || '5632656';
          console.log(`   Looking for delivery completion (dispatch ${dispatchToCheck})`);
          break;
          
        default:
          return res.json({
            message: `Job is in ${job.state} state - no active dispatch to check`,
            currentState: job.state,
            hasUpdate: false
          });
      }
      
      // Must have a dispatch ID to check
      if (!dispatchToCheck) {
        return res.json({
          message: "No dispatch ID found for current state - job may not have been dispatched yet",
          currentState: job.state,
          hasUpdate: false
        });
      }

      let updateFound = false;
      let submissionData = null;
      let dispatchInfo: any = null;
      let submissionIdToFetch: string | null = null;
      
      // Check the dispatch to see if it has been completed
      console.log(`   Checking dispatch ${dispatchToCheck}...`);
      dispatchInfo = await goCanvasService.getDispatchById(dispatchToCheck);
      console.log(`   Dispatch status: ${dispatchInfo.status}`);
      console.log(`   Submission ID: ${dispatchInfo.submission_id || 'none'}`);
      
      // If dispatch has a submission_id, it's been completed by the technician
      if (dispatchInfo.submission_id) {
        submissionIdToFetch = dispatchInfo.submission_id;
      }
      
      // Fetch submission data if we have a submission ID
      if (submissionIdToFetch) {
        console.log(`✅ Fetching submission ${submissionIdToFetch} details...`);
        submissionData = await goCanvasService.getSubmissionById(submissionIdToFetch);
        
        // Trigger the appropriate state transition
        if (expectedTransition && formIdToCheck) {
          console.log(`🔄 Triggering state transition to: ${expectedTransition}`);
          console.log(`   formIdToCheck: ${formIdToCheck}`);
          
          const submittedAt = submissionData.submitted_at ? new Date(submissionData.submitted_at) : new Date();
          
          // Use fallback form IDs if env vars not set
          const pickupFormId = process.env.GOCANVAS_PICKUP_FORM_ID || '5631022';
          const emissionsFormId = process.env.GOCANVAS_FORM_ID || '5692359';
          const deliveryFormId = process.env.GOCANVAS_DELIVERY_FORM_ID || '5632656';
          
          console.log(`   pickupFormId: ${pickupFormId} (env: ${process.env.GOCANVAS_PICKUP_FORM_ID || 'not set'})`);
          console.log(`   emissionsFormId: ${emissionsFormId} (env: ${process.env.GOCANVAS_FORM_ID || 'not set'})`);
          console.log(`   deliveryFormId: ${deliveryFormId} (env: ${process.env.GOCANVAS_DELIVERY_FORM_ID || 'not set'})`);
          
          // Call the appropriate transition handler based on form type
          if (formIdToCheck === pickupFormId) {
            // Pickup completion
            console.log(`🎯 About to call markPickedUp for job ${jobId}...`);
            try {
              const result = await jobEventsService.markPickedUp(
                jobId,
                1, // Default item count (not available from form)
                {
                  metadata: {
                    submittedAt,
                    autoDetected: true,
                    source: 'manual_check',
                  },
                }
              );
              console.log(`✅ Successfully marked job ${jobId} as picked up. New state:`, result.state);
              
              // Extract driver notes from submission and add as job comment
              if (submissionData?.rawData?.responses && Array.isArray(submissionData.rawData.responses)) {
                const driverNotesField = submissionData.rawData.responses.find((r: any) => 
                  r.label === 'Driver Notes'
                );
                
                if (driverNotesField?.value && driverNotesField.value.trim()) {
                  // Get driver name from GoCanvas user API
                  let submitterName = 'Driver';
                  if (submissionData.rawData.user_id) {
                    try {
                      const userData = await goCanvasService.getGoCanvasUserById(submissionData.rawData.user_id);
                      const firstName = userData.first_name || '';
                      const lastName = userData.last_name || '';
                      submitterName = `${firstName} ${lastName}`.trim() || `User ${submissionData.rawData.user_id}`;
                      submitterName += ' (Driver)';
                    } catch (error) {
                      console.warn(`Could not fetch GoCanvas user ${submissionData.rawData.user_id}:`, error);
                      submitterName = `Driver (ID: ${submissionData.rawData.user_id})`;
                    }
                  }
                  
                  await storage.createJobComment({
                    jobId,
                    userId: submitterName,
                    commentText: `[Driver Notes] ${driverNotesField.value.trim()}`,
                  });
                  
                  console.log(`✅ Added driver notes as job comment for ${jobId} by ${submitterName}`);
                }
              }
            } catch (err) {
              console.error(`❌ Error marking job ${jobId} as picked up:`, err);
              throw err;
            }
          } else if (formIdToCheck === emissionsFormId) {
            // Emissions service completion - check current state
            const currentJob = await storage.getJobByJobId(jobId);
            
            // Extract GPS handoff time for accurate "Service Started" timestamp
            let handoffTime: Date | null = null;
            
            try {
              // Extract GPS field directly from submission data
              const gpsField = submissionData.rawData?.responses?.find((f: any) => f.label === 'New GPS');
              
              if (gpsField?.value) {
                const timeMatch = gpsField.value.match(/Time:(\d+\.?\d*)/);
                
                if (timeMatch && timeMatch[1]) {
                  const unixTimestamp = parseFloat(timeMatch[1]);
                  const timestampMs = unixTimestamp > 10000000000 ? unixTimestamp : unixTimestamp * 1000;
                  handoffTime = new Date(timestampMs);
                  
                  if (isNaN(handoffTime.getTime()) || 
                      handoffTime.getFullYear() < 2020 || 
                      handoffTime.getFullYear() > 2100) {
                    console.warn(`Invalid GPS timestamp parsed: "${timeMatch[1]}" → year ${handoffTime.getFullYear()}`);
                    handoffTime = null;
                  } else {
                    console.log(`✅ Found handoff time from GPS field: ${handoffTime.toISOString()}`);
                  }
                }
              }
            } catch (error) {
              console.warn(`Could not retrieve handoff time from GPS: ${error}`);
            }
            
            if (currentJob?.state === 'at_shop') {
              // Transition through in_service to service_complete
              await jobEventsService.transitionJobState(jobId, 'in_service', {
                actor: 'Technician',
                timestamp: handoffTime || undefined,
                metadata: {
                  autoDetected: true,
                  source: 'manual_check',
                  handoffTime: handoffTime?.toISOString(),
                },
              });
              
              await jobEventsService.transitionJobState(jobId, 'service_complete', {
                actor: 'System',
                timestamp: submittedAt,
                metadata: {
                  completedAt: submittedAt,
                  autoDetected: true,
                  source: 'manual_check',
                },
              });
            } else if (currentJob?.state === 'in_service') {
              // Just transition to service_complete
              await jobEventsService.transitionJobState(jobId, 'service_complete', {
                actor: 'System',
                timestamp: submittedAt,
                metadata: {
                  completedAt: submittedAt,
                  autoDetected: true,
                  source: 'manual_check',
                },
              });
            }
            
            // After emissions completion, extract and save parts data from submission (using shared service)
            if (submissionData?.rawData?.responses) {
              console.log('📦 Extracting parts data from GoCanvas submission...');
              await updatePartsFromSubmission(jobId, submissionData.rawData.responses, storage);
            } else {
              console.log('⚠️ No response data found in submission for parts extraction');
            }
            
            // Extract "Additional Comments" and add as job comment (using shared service)
            if (submissionData?.rawData?.responses && Array.isArray(submissionData.rawData.responses)) {
              await handleAdditionalComments(jobId, submissionData.rawData.responses, submissionData.rawData.user_id, storage);
            }
          } else if (formIdToCheck === deliveryFormId) {
            // Delivery completion
            await jobEventsService.markDelivered(jobId, {
              timestamp: submittedAt,
              metadata: {
                submittedAt,
                autoDetected: true,
                source: 'manual_check',
              },
            });
            
            // Extract driver notes from delivery submission and add as job comment
            if (submissionData?.rawData?.responses && Array.isArray(submissionData.rawData.responses)) {
              const driverNotesField = submissionData.rawData.responses.find((r: any) => 
                r.label === 'Driver Notes'
              );
              
              if (driverNotesField?.value && driverNotesField.value.trim()) {
                // Get driver name from GoCanvas user API
                let submitterName = 'Driver';
                if (submissionData.rawData.user_id) {
                  try {
                    const userData = await goCanvasService.getGoCanvasUserById(submissionData.rawData.user_id);
                    const firstName = userData.first_name || '';
                    const lastName = userData.last_name || '';
                    submitterName = `${firstName} ${lastName}`.trim() || `User ${submissionData.rawData.user_id}`;
                  } catch (error) {
                    console.warn(`Could not fetch GoCanvas user ${submissionData.rawData.user_id}:`, error);
                    submitterName = `Driver (ID: ${submissionData.rawData.user_id})`;
                  }
                }
                
                await storage.createJobComment({
                  jobId,
                  userId: submitterName,
                  commentText: `[Driver Notes] ${driverNotesField.value.trim()}`,
                });
                
                console.log(`✅ Added delivery driver notes as job comment for ${jobId} by ${submitterName}`);
              }
            }
          }
          
          updateFound = true;
        }
      }
      
      const updatedJob = await storage.getJobByJobId(jobId);
      
      res.json({
        message: updateFound ? "Update found and applied" : "No updates found",
        currentState: updatedJob?.state || job.state,
        previousState: job.state,
        hasUpdate: updateFound,
        dispatchId: dispatchToCheck,
        dispatchStatus: dispatchInfo?.status || null,
        submissionId: submissionIdToFetch,
        submissionData: submissionData ? {
          id: submissionData.id,
          submitted_at: submissionData.submitted_at,
          status: submissionData.status
        } : null
      });
      
    } catch (error) {
      console.error("Manual update check failed:", error);
      res.status(500).json({ message: "Failed to check for updates", error: String(error) });
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
      const response = await fetch(`https://api.gocanvas.com/api/v3/submissions?form_id=${process.env.GOCANVAS_FORM_ID || '5628226'}`, {
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
      const formId = req.query.form_id || process.env.GOCANVAS_FORM_ID || '5628226';
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
