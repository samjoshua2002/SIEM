Good. Below is a clean, professional build prompt you can paste into Antigravity.

It clearly explains behavior, architecture, constraints, and expected output.

No code. Only structured instructions.

⸻

Prompt: Build Real-Time macOS Log Monitoring + Alert Dashboard (Port 3000)

Objective

Build a real-time log monitoring system that:
	•	Tracks macOS Unified Logs.
	•	Detects:
	1.	Failed sudo authentication attempts.
	2.	Privilege escalation (sudo su).
	•	Sends structured events to a Node.js backend.
	•	Displays real-time alerts on a web dashboard running on http://localhost:3000.

System must work when user opens a new terminal and runs sudo commands.

⸻

Architecture

macOS Unified Logs
↓
C Agent (Log Collector + Parser)
↓ HTTP POST
Node.js Backend (Port 3000)
↓
MongoDB (Store events + alerts)
↓
Dashboard UI (Same Node server or Next.js frontend on port 3000)

⸻

Functional Requirements

1. C Agent (Endpoint Collector)

Responsibilities:
	1.	Continuously monitor logs using:
	•	log stream --info
OR
	•	log show --last 1m --info (poll every 30 seconds)
	2.	Filter logs for:
	•	sudo authentication failures
	•	sudo privilege escalation events
	3.	Extract:
	•	Username
	•	Command executed
	•	TTY
	•	Timestamp
	•	Attempt count (if available)
	4.	Convert extracted data into structured JSON:

{
event_type: “auth_failure” | “privilege_escalation”,
user: string,
command: string,
tty: string,
hostname: string,
timestamp: ISODate
}
	5.	Send event to:

POST http://localhost:3000/events

Content-Type: application/json

Agent must run continuously in background.

⸻

2. Node.js Backend (Port 3000)

Use:
	•	Express
	•	MongoDB (localhost)
	•	WebSocket or polling for real-time UI update

Server must run on:

http://localhost:3000

⸻

3. API Endpoints

POST /events
→ Receive JSON event from C agent
→ Store in MongoDB
→ Trigger detection logic

GET /events
→ Return recent events

GET /alerts
→ Return active alerts

⸻

Detection Rules

Rule 1 – Brute Force Detection

If:

Count of auth_failure events
For same user
Within last 2 minutes ≥ 3

Then:

Create alert:

{
alert_type: “Brute Force Detected”,
severity: “Medium”,
user: string,
timestamp: now
}

If failures ≥ 6 within 5 minutes:
Severity = “High”

⸻

Rule 2 – Privilege Escalation

If event_type = “privilege_escalation”

Create alert:

{
alert_type: “Privilege Escalation”,
severity: “Medium”,
user: string
}

⸻

Rule 3 – Correlated Attack

If:

Brute force detected
AND
Privilege escalation within 5 minutes

Then:

Create alert:

{
alert_type: “Confirmed Compromise Pattern”,
severity: “High”
}

⸻

Dashboard Requirements (Port 3000)

When user runs:

sudo ls
sudo su
wrong password attempts

System must:

✔ Capture logs
✔ Send to backend
✔ Apply detection rules
✔ Immediately display alert in UI

⸻

Dashboard Layout

Section 1 – Summary Cards
	•	Total Events (last 24h)
	•	Total Alerts
	•	High Severity Alerts

⸻

Section 2 – Live Events Table

Columns:
	•	Timestamp
	•	User
	•	Event Type
	•	Command
	•	Hostname

Auto-refresh every 3 seconds or use WebSocket.

⸻

Section 3 – Alerts Table

Columns:
	•	Alert Type
	•	Severity (color coded)
	•	User
	•	Time
	•	Status (Open/Closed)

Color coding:
	•	Green → Low
	•	Yellow → Medium
	•	Red → High

⸻

Real-Time Requirement

When a user opens a new terminal and runs:

sudo su
or triggers 3 incorrect passwords

The dashboard must reflect alert within a few seconds.

⸻

Non-Functional Requirements
	•	Must work on macOS.
	•	MongoDB runs locally.
	•	No external cloud services.
	•	Modular structure:
	•	/agent
	•	/backend
	•	/dashboard
	•	Avoid duplicate alerts for same threshold window.
	•	Log raw events for debugging.

⸻

Optional Enhancement (If Supported)
	•	Use WebSocket for instant alert push.
	•	Add alert acknowledgment button.
	•	Add agent ID field for multi-host support.

⸻

Expected Outcome

A working mini-SIEM prototype where:
	•	Running sudo commands generates events.
	•	Failed authentication generates brute-force alerts.
	•	Privilege escalation generates security alerts.
	•	Alerts appear live at http://localhost:3000.

⸻

If you want, I can now give you:

• A shorter minimal MVP prompt
• A more advanced “production-grade” architecture prompt
• Or a version that includes simulated auto-kill (basic EDR mode)