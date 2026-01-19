# Google Sheets ↔ MySQL Two-Way Sync

This project implements a production-style, two-way synchronization system between a Google Sheet and a MySQL database. Any change made in one system is reflected in the other in near real time, while avoiding infinite update loops.

The system is designed with clear separation of concerns, explicit change logging, and scalability in mind.

---

## Architecture Overview

The system is event-driven and consists of three main components:

1. Google Apps Script  
   Listens to edits in the Google Sheet and sends structured change events to the backend.

2. Node.js API Server  
   Receives sheet events, upserts rows into MySQL, and records every change in a change_log table.

3. Background Worker  
   Polls unprocessed database-originated changes from change_log and applies them back to the Google Sheet using the Google Sheets API and a service account.

Change propagation always flows through the change_log table, which prevents circular updates and enables reliable syncing.

---

## Data Flow

### Sheet → Database
- User edits Google Sheet
- Apps Script trigger fires
- Change is sent to the Node.js API
- Data is upserted into MySQL
- Change is recorded in change_log with source = sheet

### Database → Sheet
- Database-originated changes are inserted into change_log with source = db
- Worker process detects unprocessed changes
- Worker writes data to Google Sheet
- Change is marked as processed

---

## Tech Stack

- Node.js
- Express
- MySQL
- Google Apps Script
- Google Sheets API
- Service Account authentication
- ngrok for local development

---

## Setup Instructions

1. Create MySQL tables using `create_tables.sql`
2. Create a Google Cloud service account and enable Google Sheets API
3. Share the target Google Sheet with the service account email
4. Create a `.env` file using `.env.example`
5. Install dependencies inside `server/`
6. Start the API server and worker in separate terminals

---

## Notes on Design Choices

- An explicit change_log table is used instead of triggers for clarity, debuggability, and scalability
- Source-based change tracking prevents infinite sync loops
- Service account authentication avoids embedding credentials in Apps Script
- The architecture can be extended to support multiple tables and sheets

---

## Edge Cases and Design Considerations

- **Infinite sync loops**  
  Prevented by tagging every change with a source field (`sheet` or `db`) and ensuring the worker only processes database-originated changes.

- **Concurrent edits in Google Sheets**  
  Each edit is treated as an independent event. Idempotent upserts using a stable primary key (`__id`) ensure consistency even when updates overlap.

- **Partial or missing data**  
  The system dynamically maps columns based on headers and safely handles empty or missing values without breaking the sync.

- **Schema drift protection**  
  Removed columns are explicitly filtered out at the backend layer to avoid silent database failures.

- **Failure isolation**  
  Changes are written to a `change_log` table before processing. If the worker crashes, unprocessed changes remain and are retried.

- **Idempotency**  
  Database writes use upserts to ensure repeated events do not corrupt the state.

- **Scalability considerations**  
  The change log model allows horizontal scaling of workers and can be extended to multiple tables or sheets without architectural changes.

- **Security**  
  Secrets are stored in environment variables. Google Sheets users employ a service account, thereby avoiding credential leakage into client-side scripts.

```
