import { storage } from "../storage";
import { jobEventsService } from "./jobEvents";
import { notificationService } from "./notificationService";
import type { FormSubmissionType, InsertFormSubmission, FormSubmission, Job, JobPart } from "@shared/schema";

/**
 * FormDispatchService handles creating and processing native form submissions,
 * replacing the GoCanvas dispatch/webhook round-trip.
 *
 * Data flow:
 * 1. CSR dispatches form -> createDispatch() creates form_submission row
 * 2. Tech/driver receives notification (WebSocket or poll)
 * 3. Tech/driver fills form on mobile -> startSubmission() marks in_progress
 * 4. Tech/driver submits form -> completeSubmission() processes data + updates job
 */
class FormDispatchService {
  /**
   * Create a new form dispatch (CSR side).
   * Pre-fills job data into the form and assigns it to a tech/driver.
   */
  async createDispatch(
    formType: FormSubmissionType,
    jobId: string,
    assignedTo: string,
    assignedBy: string,
  ): Promise<FormSubmission> {
    // Load job and parts data for prefill
    const job = await storage.getJobByJobId(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const parts = await storage.getJobParts(jobId);
    const prefilledData = this.buildPrefilledData(formType, job, parts);

    const submission = await storage.createFormSubmission({
      jobId,
      formType,
      assignedTo,
      assignedBy,
      prefilledData,
    });

    // Record event
    await storage.createJobEvent({
      jobId,
      eventType: `${formType}_dispatched`,
      description: `${formType} form dispatched to ${assignedTo}`,
      actor: "CSR",
      actorEmail: assignedBy,
      metadata: { formSubmissionId: submission.id },
    });

    // Send real-time notification to the assigned tech/driver
    notificationService.notifyFormAssigned(
      assignedTo,
      String(submission.id),
      jobId,
      formType,
    );

    return submission;
  }

  /**
   * Mark a form submission as in progress (tech/driver has opened it).
   */
  async startSubmission(submissionId: string): Promise<FormSubmission> {
    const submission = await storage.updateFormSubmission(submissionId, {
      status: "in_progress",
      startedAt: new Date(),
    });
    if (!submission) {
      throw new Error(`Submission ${submissionId} not found`);
    }
    return submission;
  }

  /**
   * Complete a form submission and process the results.
   * This is the equivalent of the GoCanvas webhook handler.
   */
  async completeSubmission(
    submissionId: string,
    responseData: Record<string, unknown>,
    gps?: { latitude: string; longitude: string; accuracy: string },
    deviceInfo?: Record<string, unknown>,
    offline?: boolean,
  ): Promise<FormSubmission> {
    const submission = await storage.getFormSubmission(submissionId);
    if (!submission) {
      throw new Error(`Submission ${submissionId} not found`);
    }
    if (submission.status === "completed") {
      throw new Error(`Submission ${submissionId} already completed`);
    }

    // Update submission with response data
    const updated = await storage.updateFormSubmission(submissionId, {
      status: "completed",
      responseData,
      completedAt: new Date(),
      gpsLatitude: gps?.latitude,
      gpsLongitude: gps?.longitude,
      gpsAccuracy: gps?.accuracy,
      gpsTimestamp: gps ? new Date() : undefined,
      deviceInfo,
      offlineSubmission: offline ? "true" : "false",
      syncedAt: offline ? new Date() : undefined,
    });

    if (!updated) {
      throw new Error(`Failed to update submission ${submissionId}`);
    }

    // Process by form type - reuse existing jobEventsService logic
    await this.processCompletedForm(updated);

    return updated;
  }

  /**
   * Process a completed form submission, updating job state and parts.
   */
  private async processCompletedForm(submission: FormSubmission): Promise<void> {
    const job = await storage.getJobByJobId(submission.jobId);
    if (!job) {
      console.error(`[FormDispatch] Job ${submission.jobId} not found for submission ${submission.id}`);
      return;
    }

    const responseData = (submission.responseData ?? {}) as Record<string, unknown>;

    switch (submission.formType) {
      case "pickup":
        await this.processPickup(job, submission, responseData);
        break;
      case "delivery":
        await this.processDelivery(job, submission, responseData);
        break;
      case "emissions":
        await this.processEmissions(job, submission, responseData);
        break;
    }
  }

  private async processPickup(
    job: Job,
    submission: FormSubmission,
    responseData: Record<string, unknown>,
  ): Promise<void> {
    const itemCount = (responseData.itemCount as number) || 1;

    // Mark job as picked up (uses jobId format, not UUID)
    await jobEventsService.markPickedUp(job.jobId, itemCount, {
      actor: "Driver",
      actorEmail: submission.assignedTo,
    });

    // Add driver notes as comment if provided
    const notes = responseData.driverNotes as string | undefined;
    if (notes?.trim()) {
      await storage.createJobComment({
        jobId: job.jobId,
        userId: submission.assignedTo,
        commentText: `[Pickup Notes] ${notes}`,
      });
    }
  }

  private async processDelivery(
    job: Job,
    submission: FormSubmission,
    responseData: Record<string, unknown>,
  ): Promise<void> {
    // Mark job as delivered (uses jobId format, not UUID)
    await jobEventsService.markDelivered(job.jobId, {
      actor: "Driver",
      actorEmail: submission.assignedTo,
    });

    // Add delivery notes as comment if provided
    const notes = responseData.deliveryNotes as string | undefined;
    if (notes?.trim()) {
      await storage.createJobComment({
        jobId: job.jobId,
        userId: submission.assignedTo,
        commentText: `[Delivery Notes] ${notes}`,
      });
    }
  }

  private async processEmissions(
    job: Job,
    submission: FormSubmission,
    responseData: Record<string, unknown>,
  ): Promise<void> {
    const opts = {
      actor: "Technician",
      actorEmail: submission.assignedTo,
    };

    // Transition: at_shop -> in_service -> service_complete
    if (job.state === "at_shop") {
      await jobEventsService.transitionJobState(job.jobId, "in_service", opts);
    }

    // Update parts from submission response
    const partsData = responseData.parts as Array<Record<string, unknown>> | undefined;
    if (partsData?.length) {
      await this.updatePartsFromResponse(job.jobId, partsData);
    }

    // Mark service complete
    const updatedJob = await storage.getJobByJobId(job.jobId);
    if (updatedJob && updatedJob.state === "in_service") {
      await jobEventsService.transitionJobState(job.jobId, "service_complete", opts);
    }

    // Add technician comments
    const comments = responseData.additionalComments as string | undefined;
    if (comments?.trim()) {
      await storage.createJobComment({
        jobId: job.jobId,
        userId: submission.assignedTo,
        commentText: `[Tech Comments] ${comments}`,
      });
    }
  }

  /**
   * Update job parts from the emissions form response data.
   * Matches parts by ECS serial number.
   */
  private async updatePartsFromResponse(
    jobId: string,
    partsData: Array<Record<string, unknown>>,
  ): Promise<void> {
    const existingParts = await storage.getJobParts(jobId);

    for (const partResponse of partsData) {
      const ecsSerial = partResponse.ecsSerial as string | undefined;
      if (!ecsSerial) continue;

      // Find matching part by ECS serial
      const matchingPart = existingParts.find((p) => p.ecsSerial === ecsSerial);
      if (!matchingPart) {
        console.warn(`[FormDispatch] No matching part found for ECS serial ${ecsSerial} on job ${jobId}`);
        continue;
      }

      // Update tech-filled fields
      await storage.updateJobPart(matchingPart.id, {
        ecsPartNumber: (partResponse.ecsPartNumber as string) || undefined,
        passOrFail: (partResponse.passOrFail as string) || undefined,
        requireRepairs: (partResponse.requireRepairs as string) || undefined,
        failedReason: (partResponse.failedReason as string) || undefined,
        repairsPerformed: (partResponse.repairsPerformed as string) || undefined,
        updatedAt: new Date(),
      });
    }
  }

  /**
   * Build pre-filled data for a form based on the form type, job, and parts.
   */
  private buildPrefilledData(
    formType: FormSubmissionType,
    job: Job,
    parts: JobPart[],
  ): Record<string, unknown> {
    const base = {
      jobId: job.jobId,
      shopName: job.shopName,
      customerName: job.customerName,
      customerShipTo: job.customerShipTo,
      contactName: job.contactName,
      contactNumber: job.contactNumber,
    };

    const now = new Date();
    const dispatchDate = now.toLocaleDateString("en-US");
    const dispatchTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

    switch (formType) {
      case "pickup":
        return {
          ...base,
          dispatchDate,
          dispatchTime,
          poNumber: job.poNumber,
          notesToDriver: job.pickupNotes,
          pickupAddress: job.pickupAddress,
          pickupNotes: job.pickupNotes,
          itemCount: job.itemCount,
        };

      case "delivery":
        return {
          ...base,
          dispatchDate,
          dispatchTime,
          orderNumber: job.orderNumber,
          orderNumber2: job.orderNumber2,
          orderNumber3: job.orderNumber3,
          orderNumber4: job.orderNumber4,
          orderNumber5: job.orderNumber5,
          notesToDriver: job.deliveryNotes,
          deliveryAddress: job.deliveryAddress,
          deliveryNotes: job.deliveryNotes,
          itemCount: job.itemCount,
        };

      case "emissions":
        return {
          ...base,
          p21OrderNumber: job.p21OrderNumber,
          userId: job.userId,
          permissionToStart: job.permissionToStart,
          customerSpecificInstructions: job.customerSpecificInstructions,
          sendClampsGaskets: job.sendClampsGaskets,
          preferredProcess: job.preferredProcess,
          anyOtherSpecificInstructions: job.anyOtherSpecificInstructions,
          anyCommentsForTech: job.anyCommentsForTech,
          noteToTechAboutCustomer: job.noteToTechAboutCustomer,
          poNumber: job.poNumber,
          serialNumbers: job.serialNumbers,
          parts: parts.map((p) => ({
            id: p.id,
            part: p.part,
            process: p.process,
            ecsSerial: p.ecsSerial,
            filterPn: p.filterPn,
            poNumber: p.poNumber,
            mileage: p.mileage,
            unitVin: p.unitVin,
            gasketClamps: p.gasketClamps,
            ec: p.ec,
            eg: p.eg,
            ek: p.ek,
            // partDescription not on jobParts table yet
          })),
        };
    }
  }
}

export const formDispatchService = new FormDispatchService();
