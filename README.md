# 🛡️ SIEM Core

![ SIEM Dashboard](./image.png)

A lightweight, real-time Security Information and Event Management (SIEM) system built specifically for macOS. It monitors system authentication patterns in real-time, detecting and mitigating potential security threats like brute-force attacks and unauthorized privilege escalation.

## 🌟 Key Features

- **Real-time Log Monitoring**: Streams and parses macOS Unified Logs instantly.
- **Intelligent Threat Detection**: Analyzes authentication events to identify brute-force patterns and unwanted root privilege escalations.
- **Glassmorphic Dashboard**: A stunning, modern React-based UI that visualizes raw log feeds, telemetry data, and critical alerts.
- **Lightweight C-Agent**: A minimal impact background service that hooks into local process streams dynamically without slowing down the OS.

---

## 🏗️ Architecture

The system is broken down into three resilient layers:

### 1. The Collector: `agent` (C Language)
A high-performance log-parsing binary compiled in C. 
It uses `log stream` to track `sudo` and `su` command flows securely and cleanly directly from the macOS core. 
- Filters out noise and correctly formats the payload.
- Uses `libcurl` to dispatch normalized JSON events to the backend securely.

### 2. The Engine: `backend` (Node.js & Express)
The SIEM brain that processes inbound events securely and stores them in MongoDB. 
- **WebSocket Streaming**: Broadcasts live data seamlessly to the dashboard.
- **Rule Engine**: Computes statistical thresholds dynamically to raise incident alerts.

### 3. The Interface: `dashboard` (React & Vite & TailwindCSS)
The command center. 
It consumes WebSockets for real-time live events and interfaces with backend REST APIs to build an engaging, futuristic UI.

---

## 🧠 Threat Detection Logic

**1. Brute Force Detection (Medium / High)**
- Tracks `auth_failure` events specifically tied to `sudo`.
- **Medium Severity**: Triggers immediately if **2 or more** failures occur within a 5-minute rolling window.
- **High Severity (Brute Force Risk)**: Triggers if the failure count reaches **6 or more**.

**2. Privilege Escalation (Medium)**
- Tracks successful transitions to the root shell via `su` or `sudo su`.
- Raises an **Elevated Root Access** alert whenever authenticated access jumps privileges without explicit, isolated clearance.

**3. Correlated Threat Intelligence**
- Correlates independent events to derive intent and highlight the severity dynamically based on historical actions.

---

## 🚀 Getting Started

### Prerequisites
- macOS (Core dependency for the `log stream` structure)
- Node.js (v18+)
- MongoDB (Running locally on default port `27017`)
- GCC compiler to build the agent

### Installation

#### 1. Setup the Backend
```bash
cd backend
npm install
node server.js
```

#### 2. Compile and Start the Agent
*(Open a new terminal window)*
```bash
cd agent
gcc main.c -lcurl -o agent
./agent
```

#### 3. Launch the Dashboard
*(Open a third terminal window)*
```bash
cd dashboard
npm install
npm run dev
```

---

## 🧪 How to Test Threats

Once the system is running, open a fresh terminal and run the following tests to watch the dashboard light up:

- **Trigger Brute Force (Medium):** Clear your auth timestamp with `sudo -k`, run `sudo ls`, and purposely type the wrong password **2 times**.
- **Trigger Brute Force (High):** Fail the password **6 times** consecutively.
- **Trigger Privilege Escalation (Medium):** Run `sudo su` and correctly log in.

---

> Built with system performance, core security principles, and aesthetic frontend precision in mind.
