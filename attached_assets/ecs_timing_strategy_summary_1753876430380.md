# Product Requirements Document (PRD)

## Project: ECS Turnaround Time Tracking Layer

### Owner: PJ Duffy

### Stakeholder: Emissions and Cooling Solutions (ECS)

### Goal: Create a minimal, non-disruptive overlay system to enable accurate end-to-end job turnaround time tracking, integrating seamlessly with the existing GoCanvas workflow.

---

## 1. Purpose

The purpose of this project is to:
- Provide a simple, reliable way to track job turnaround time across ECS’s existing workflows.
- Generate unique Job IDs for all jobs.
- Automatically log timestamps for critical events.
- Integrate with existing GoCanvas forms without changing technicians' existing workflows.
- Store and display accurate tracking data centrally and sync to Google Sheets.

---

## 2. Users and Roles

| Role       | Description                                             |
|------------|---------------------------------------------------------|
| CSR        | Initiates jobs and records initial customer/job details |
| Technician | Completes service using GoCanvas                        |
| Admin      | Reviews and manages job turnaround reporting            |

---

## 3. Workflow

### Job Initiation (Web App - CSR)
- CSR fills out a web form replicating existing GoCanvas CSR fields exactly.
- Web form generates a unique Job ID (`ECS-YYYYMMDDHHMMSS-XXXX`).
- Web form automatically captures initiation timestamp.
- Job details (including Job ID) stored in backend database (Supabase).

### API Submission to GoCanvas
- Upon submission of the CSR web form, backend API immediately creates a new submission in GoCanvas:
  - All form fields populated exactly as provided by CSR, including the Job ID.
  - Submission assigned directly to technician’s email address (from CSR form).

### Technician Workflow
- Technician receives notification (current GoCanvas workflow remains unchanged).
- Technician completes service as usual in GoCanvas.
- Upon submission completion, backend system detects completion (via polling or webhook).

### Turnaround Time Calculation
- Technician submission timestamp is logged.
- Turnaround time calculated: technician submission timestamp minus CSR initiation timestamp.

---

## 4. Technical Specifications

### Frontend
- Web form (React or plain HTML/CSS/JS) matching existing GoCanvas CSR form.
- Simple admin dashboard displaying recent jobs and statuses.

### Backend
- Node.js backend using Express.js.
- Supabase for secure real-time data storage.
- OAuth2 authentication for GoCanvas API.
- Google Sheets API integration for logging and visibility.

---

## 5. Job ID Format
- `ECS-YYYYMMDDHHMMSS-XXXX`
  - ECS prefix
  - YYYYMMDDHHMMSS (UTC timestamp)
  - 4-digit random number to prevent collisions

---

## 6. Data Integrity
- Job ID explicitly included in GoCanvas form submissions for easy tracking.
- Automatic synchronization between backend database, GoCanvas, and Google Sheets.

---

## 7. Success Criteria
- CSR experience minimally impacted (simple form submission).
- Technician experience unchanged (uses current GoCanvas workflow).
- Accurate, automated turnaround time tracking from initiation to technician completion.
- Centralized data stored reliably with consistent synchronization to Google Sheets.

---

## 8. Next Steps
- Finalize and add the Job ID field explicitly in GoCanvas.
- Clarify exact technician notification method upon job assignment.
- Develop initial MVP prototype for testing and validation.

---

**In short:**
This PRD outlines a lightweight, reliable system to track turnaround time using existing GoCanvas workflows, a new Job ID system, automatic timestamps, minimal CSR workflow disruption, and zero technician workflow disruption.

