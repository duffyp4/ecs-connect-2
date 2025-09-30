import { storage } from '../storage';
import { type Job, type InsertJobEvent } from '@shared/schema';
import { goCanvasService, type FormType } from './gocanvas';

// Job state type definition
export type JobState = 
  | 'queued_for_pickup'
  | 'picked_up'
  | 'at_shop'
  | 'in_service'
  | 'ready_for_pickup'
  | 'ready_for_delivery'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

// State machine definition for job lifecycle
const STATE_MACHINE = {
  // State transitions map: current_state -> allowed_next_states[]
  transitions: {
    'queued_for_pickup': ['picked_up', 'cancelled'],
    'picked_up': ['at_shop', 'cancelled'],
    'at_shop': ['in_service', 'cancelled'],
    'in_service': ['ready_for_pickup', 'ready_for_delivery', 'cancelled'],
    'ready_for_pickup': ['delivered', 'cancelled'],
    'ready_for_delivery': ['out_for_delivery', 'cancelled'],
    'out_for_delivery': ['delivered', 'cancelled'],
    'delivered': [], // Terminal state
    'cancelled': [], // Terminal state
  } as Record<JobState, JobState[]>,
  
  // Initial states that jobs can start in
  initialStates: ['queued_for_pickup', 'at_shop'] as JobState[],
  
  // Terminal states (no further transitions)
  terminalStates: ['delivered', 'cancelled'] as JobState[],
};

// Event types for different state transitions
export type JobEventType = 
  | 'state_change'
  | 'pickup_dispatched'
  | 'pickup_completed'
  | 'shop_checkin'
  | 'service_started'
  | 'service_completed'
  | 'ready_marked'
  | 'delivery_dispatched'
  | 'delivery_completed'
  | 'cancelled'
  | 'note_added';

interface StateChangeOptions {
  actor?: string; // CSR, Driver, System, Technician
  actorEmail?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export class JobEventsService {
  /**
   * Validate if a state transition is allowed
   */
  canTransitionTo(currentState: JobState, nextState: JobState): boolean {
    const allowedStates = STATE_MACHINE.transitions[currentState] || [];
    return allowedStates.includes(nextState);
  }

  /**
   * Get allowed next states for a job
   */
  getAllowedNextStates(currentState: JobState): JobState[] {
    return STATE_MACHINE.transitions[currentState] || [];
  }

  /**
   * Check if a state is a terminal state
   */
  isTerminalState(state: JobState): boolean {
    return STATE_MACHINE.terminalStates.includes(state);
  }

  /**
   * Record a job event to the timeline
   */
  private async recordEvent(
    jobId: string,
    eventType: JobEventType,
    description: string,
    options: StateChangeOptions = {}
  ): Promise<void> {
    const eventData: InsertJobEvent = {
      jobId,
      eventType,
      description, // ✅ Now persisting the description!
      actor: options.actor || 'System',
      actorEmail: options.actorEmail,
      metadata: options.metadata ? options.metadata : null,
    };
    
    await storage.createJobEvent(eventData);
  }

  /**
   * Transition a job to a new state with validation and event recording
   */
  async transitionJobState(
    jobId: string,
    newState: JobState,
    options: StateChangeOptions = {}
  ): Promise<Job> {
    // Get current job
    const job = await storage.getJob(jobId);
    
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Validate transition
    if (!this.canTransitionTo(job.state as JobState, newState)) {
      throw new Error(
        `Invalid state transition: cannot go from ${job.state} to ${newState}. ` +
        `Allowed transitions: ${this.getAllowedNextStates(job.state as JobState).join(', ')}`
      );
    }

    // Prepare update data
    const updateData: any = {
      state: newState,
      updatedAt: new Date(),
    };

    // Set timestamps based on state
    switch (newState) {
      case 'picked_up':
        updateData.pickedUpAt = new Date();
        break;
      case 'at_shop':
        updateData.atShopAt = new Date();
        break;
      case 'in_service':
        updateData.inServiceAt = new Date();
        break;
      case 'ready_for_pickup':
      case 'ready_for_delivery':
        updateData.readyAt = new Date();
        break;
      case 'out_for_delivery':
        updateData.outForDeliveryAt = new Date();
        break;
      case 'delivered':
        updateData.deliveredAt = new Date();
        break;
    }

    // Update job state
    const updatedJob = await storage.updateJob(jobId, updateData);
    
    if (!updatedJob) {
      throw new Error(`Failed to update job ${jobId}`);
    }

    // Record event
    await this.recordEvent(
      jobId,
      'state_change',
      `State changed from ${job.state} to ${newState}`,
      {
        ...options,
        metadata: {
          ...options.metadata,
          previousState: job.state,
          newState,
        },
      }
    );

    return updatedJob;
  }

  /**
   * Dispatch pickup for a job
   */
  async dispatchPickup(
    jobId: string,
    params: {
      driverEmail: string;
      pickupNotes?: string;
    },
    options: StateChangeOptions = {}
  ): Promise<Job> {
    // Get job
    const job = await storage.getJob(jobId);
    
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Validate state (must be in queued_for_pickup)
    if (job.state !== 'queued_for_pickup') {
      throw new Error(`Cannot dispatch pickup: job is in ${job.state} state, must be in queued_for_pickup`);
    }

    // Create GoCanvas pickup dispatch using the driver email for assignment
    const dispatchId = await goCanvasService.createDispatchForForm(
      'PICKUP',
      {
        jobId: job.jobId,
        customerName: job.customerName,
        shopName: job.shopName,
        contactName: job.contactName,
        contactNumber: job.contactNumber,
        pickupNotes: params.pickupNotes || '',
      },
      params.driverEmail // Use the actual driver email for GoCanvas assignment
    );

    // Update job with dispatch info
    await storage.updateJob(jobId, {
      pickupDispatchId: dispatchId,
      pickupDriverEmail: params.driverEmail,
      pickupNotes: params.pickupNotes || '',
      updatedAt: new Date(),
    });

    // Record event
    await this.recordEvent(
      jobId,
      'pickup_dispatched',
      `Pickup dispatched to ${params.driverEmail}`,
      {
        ...options,
        metadata: {
          ...options.metadata,
          driverEmail: params.driverEmail,
          pickupNotes: params.pickupNotes,
          dispatchId,
          formType: 'PICKUP',
        },
      }
    );

    // Get updated job
    const updatedJob = await storage.getJob(jobId);
    
    if (!updatedJob) {
      throw new Error(`Failed to get updated job ${jobId}`);
    }
    
    return updatedJob;
  }

  /**
   * Mark items as picked up (driver completes pickup form)
   */
  async markPickedUp(
    jobId: string,
    itemCount: number,
    options: StateChangeOptions = {}
  ): Promise<Job> {
    // Update job with pickup data
    await storage.updateJob(jobId, {
      itemCount,
      updatedAt: new Date(),
    });

    // Transition to picked_up state
    const updatedJob = await this.transitionJobState(jobId, 'picked_up', {
      ...options,
      metadata: {
        ...options.metadata,
        itemCount,
      },
    });

    // Record additional event
    await this.recordEvent(
      jobId,
      'pickup_completed',
      `Items picked up (count: ${itemCount})`,
      options
    );

    return updatedJob;
  }

  /**
   * Check in job at shop
   */
  async checkInAtShop(
    jobId: string,
    options: StateChangeOptions = {}
  ): Promise<Job> {
    const job = await storage.getJob(jobId);
    
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Validate state (must be picked_up or queued_for_pickup for direct check-in)
    if (job.state !== 'picked_up' && job.state !== 'queued_for_pickup') {
      throw new Error(`Cannot check in: job is in ${job.state} state`);
    }

    // If coming from queued_for_pickup, this is a direct shop check-in (no pickup)
    // So we skip pickup state and go directly to at_shop
    let updatedJob: Job;
    
    if (job.state === 'queued_for_pickup') {
      // Direct shop check-in - mark as picked up first, then at shop
      await this.transitionJobState(jobId, 'picked_up', {
        ...options,
        metadata: {
          ...options.metadata,
          directCheckIn: true,
        },
      });
    }

    // Transition to at_shop
    updatedJob = await this.transitionJobState(jobId, 'at_shop', options);

    // Record event
    await this.recordEvent(
      jobId,
      'shop_checkin',
      'Job checked in at shop',
      options
    );

    return updatedJob;
  }

  /**
   * Start service on job
   */
  async startService(
    jobId: string,
    technicianName: string,
    options: StateChangeOptions = {}
  ): Promise<Job> {
    // Update technician info
    await storage.updateJob(jobId, {
      assignedTechnician: technicianName,
      updatedAt: new Date(),
    });

    // Transition state
    const updatedJob = await this.transitionJobState(jobId, 'in_service', {
      ...options,
      actor: 'Technician',
      actorEmail: technicianName,
      metadata: {
        ...options.metadata,
        technicianName,
      },
    });

    // Record event
    await this.recordEvent(
      jobId,
      'service_started',
      `Service started by ${technicianName}`,
      {
        ...options,
        actor: 'Technician',
        actorEmail: technicianName,
      }
    );

    return updatedJob;
  }

  /**
   * Mark job as ready (for pickup or delivery)
   */
  async markReady(
    jobId: string,
    deliveryMethod: 'pickup' | 'delivery',
    options: StateChangeOptions = {}
  ): Promise<Job> {
    const targetState: JobState = deliveryMethod === 'pickup' ? 'ready_for_pickup' : 'ready_for_delivery';
    
    // Update delivery method
    await storage.updateJob(jobId, {
      deliveryMethod,
      updatedAt: new Date(),
    });

    // Transition state
    const updatedJob = await this.transitionJobState(jobId, targetState, {
      ...options,
      metadata: {
        ...options.metadata,
        deliveryMethod,
      },
    });

    // Record event
    await this.recordEvent(
      jobId,
      'service_completed',
      `Job marked as ready for ${deliveryMethod}`,
      options
    );

    return updatedJob;
  }

  /**
   * Dispatch delivery for a job
   */
  async dispatchDelivery(
    jobId: string,
    driverEmail: string,
    options: StateChangeOptions = {}
  ): Promise<{ job: Job; dispatchId: string }> {
    // Get job
    const job = await storage.getJob(jobId);
    
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Validate state (must be in ready_for_delivery)
    if (job.state !== 'ready_for_delivery') {
      throw new Error(`Cannot dispatch delivery: job is in ${job.state} state, must be in ready_for_delivery`);
    }

    // Create GoCanvas delivery dispatch
    const dispatchId = await goCanvasService.createDispatchForForm(
      'DELIVERY',
      {
        jobId: job.jobId,
        customerName: job.customerName,
        shopName: job.shopName,
        contactName: job.contactName,
        contactNumber: job.contactNumber,
        deliveryAddress: job.deliveryAddress,
        deliveryNotes: job.deliveryNotes,
        itemCount: job.itemCount,
      },
      driverEmail
    );

    // Update job with dispatch info
    await storage.updateJob(jobId, {
      deliveryDispatchId: dispatchId,
      deliveryDriverEmail: driverEmail,
      updatedAt: new Date(),
    });

    // Transition to out_for_delivery
    const updatedJob = await this.transitionJobState(jobId, 'out_for_delivery', {
      ...options,
      metadata: {
        ...options.metadata,
        driverEmail,
        dispatchId,
        formType: 'DELIVERY',
      },
    });

    // Record event
    await this.recordEvent(
      jobId,
      'delivery_dispatched',
      `Delivery dispatched to ${driverEmail}`,
      options
    );

    return { job: updatedJob, dispatchId };
  }

  /**
   * Mark job as delivered
   */
  async markDelivered(
    jobId: string,
    options: StateChangeOptions = {}
  ): Promise<Job> {
    // Transition state
    const updatedJob = await this.transitionJobState(jobId, 'delivered', options);

    // Record event
    await this.recordEvent(
      jobId,
      'delivery_completed',
      'Job delivered to customer',
      options
    );

    return updatedJob;
  }

  /**
   * Cancel a job
   */
  async cancelJob(
    jobId: string,
    reason: string,
    options: StateChangeOptions = {}
  ): Promise<Job> {
    // Transition state
    const updatedJob = await this.transitionJobState(jobId, 'cancelled', {
      ...options,
      notes: reason,
    });

    // Record event
    await this.recordEvent(
      jobId,
      'cancelled',
      `Job cancelled: ${reason}`,
      {
        ...options,
        notes: reason,
      }
    );

    return updatedJob;
  }

  /**
   * Add a note to a job
   */
  async addNote(
    jobId: string,
    note: string,
    options: StateChangeOptions = {}
  ): Promise<void> {
    await this.recordEvent(
      jobId,
      'note_added',
      note,
      options
    );
  }

  /**
   * Get job event timeline
   */
  async getJobTimeline(jobId: string) {
    const events = await storage.getJobEvents(jobId);
    return events;
  }

  /**
   * Get state machine info for debugging/display
   */
  getStateMachineInfo() {
    return {
      states: Object.keys(STATE_MACHINE.transitions),
      transitions: STATE_MACHINE.transitions,
      initialStates: STATE_MACHINE.initialStates,
      terminalStates: STATE_MACHINE.terminalStates,
    };
  }
}

export const jobEventsService = new JobEventsService();
