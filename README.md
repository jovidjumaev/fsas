# FSAS – Furman Smart Attendance System

FSAS is a QR-driven attendance platform for universities that combines a real-time student portal with a classroom management dashboard for faculty.

## Core Capabilities
- Generates tamper-resistant QR codes for every live class session and pins them to the lecture location through geofencing.
- Validates student check-ins against time windows, GPS radius, and Supabase-authenticated identities before persisting attendance.
- Streams updates over WebSockets so professors see live rosters, late arrivals, and session analytics without refreshing.
- Syncs student schedules, classes, and notifications so learners can review history, download reports, and receive alerts on status changes.

## How It Works
1. **Frontend (Next.js 14 + Tailwind)** renders the responsive professor dashboard and student portal, handling QR scans, analytics, and PWA offline fallbacks.
2. **Backend (Express + Socket.io)** issues signed QR payloads, enforces rate limits and encryption, and relays attendance events to connected clients.
3. **Supabase (PostgreSQL + Auth)** stores class metadata, session records, and notification queues while issuing role-aware access tokens.
4. **Worker utilities** manage backfills, reporting exports, and diagnostics for production monitoring and data integrity.
