const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(cors());

// MongoDB connection
mongoose.connect('mongodb://127.0.0.1:27017/macos_siem', {
    // Configs
}).then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

const eventSchema = new mongoose.Schema({
    event_type: String, // "auth_failure" | "privilege_escalation"
    user: String,
    command: String,
    tty: String,
    hostname: String,
    timestamp: Date
});

const alertSchema = new mongoose.Schema({
    alert_type: String, // "Brute Force Detected" | "Privilege Escalation" | "Confirmed Compromise Pattern"
    severity: String, // "Low" | "Medium" | "High"
    user: String,
    timestamp: { type: Date, default: Date.now },
    status: { type: String, default: 'Open' }
});

const Event = mongoose.model('Event', eventSchema);
const Alert = mongoose.model('Alert', alertSchema);

let clients = [];
wss.on('connection', ws => {
    clients.push(ws);
    ws.on('close', () => clients = clients.filter(client => client !== ws));
});

function broadcast(data) {
    clients.forEach(client => {
        if (client.readyState === 1) client.send(JSON.stringify(data));
    });
}

// Detection Rules V3
async function processDetectionRules(event) {
    if (event.event_type === "auth_failure") {
        const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);

        // Count total auth failures for this user in the last 5 mins
        const count = await Event.countDocuments({
            user: event.user,
            event_type: "auth_failure",
            timestamp: { $gte: fiveMinsAgo }
        });

        let severity = null;
        let alertType = null;

        if (count >= 6) {
            severity = "High";
            alertType = "Brute Force Risk";
        } else if (count >= 2) {
            severity = "Medium";
            alertType = "Multiple Auth Failures";
        }

        if (severity) {
            // Check if we already alerted for this specific severity recently to avoid spam
            const oneMinAgo = new Date(Date.now() - 60 * 1000);
            const existing = await Alert.findOne({
                user: event.user,
                alert_type: alertType,
                severity: severity,
                timestamp: { $gte: oneMinAgo }
            });

            if (!existing) {
                const newAlert = new Alert({
                    alert_type: alertType,
                    severity,
                    user: event.user
                });
                await newAlert.save();
                broadcast({ type: 'new_alert', data: newAlert });
            }
        }
    } else if (event.event_type === "privilege_escalation") {
        const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);

        // Count total root escalations for this user in the last 5 mins
        const count = await Event.countDocuments({
            user: event.user,
            event_type: "privilege_escalation",
            timestamp: { $gte: fiveMinsAgo }
        });

        let severity = "Medium";
        let alertType = "Elevated Root Access";

        if (count >= 3) {
            severity = "High";
            alertType = "Critical Root Activity";
        }

        // De-duplicate: Don't spam same alert type if created in last 30 seconds
        const thirtySecsAgo = new Date(Date.now() - 30 * 1000);
        const existing = await Alert.findOne({
            user: event.user,
            alert_type: alertType,
            severity,
            timestamp: { $gte: thirtySecsAgo }
        });

        if (!existing) {
            const newAlert = new Alert({
                alert_type: alertType,
                severity,
                user: event.user
            });
            await newAlert.save();
            broadcast({ type: 'new_alert', data: newAlert });
        }
    }
}

app.post('/events', async (req, res) => {
    try {
        const eventData = req.body;
        if (!eventData.timestamp) {
            eventData.timestamp = new Date();
        }
        const event = new Event(eventData);
        await event.save();

        broadcast({ type: 'new_event', data: event });

        await processDetectionRules(event);

        res.status(201).json({ message: "Event received" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get('/events', async (req, res) => {
    try {
        const events = await Event.find().sort({ timestamp: -1 }).limit(100);
        res.json(events);
    } catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get('/alerts', async (req, res) => {
    try {
        const alerts = await Alert.find().sort({ timestamp: -1 }).limit(100);
        res.json(alerts);
    } catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get('/stats', async (req, res) => {
    try {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const totalEvents = await Event.countDocuments({ timestamp: { $gte: oneDayAgo } });
        const totalAlerts = await Alert.countDocuments();
        const highAlerts = await Alert.countDocuments({ severity: "High" });
        res.json({ totalEvents, totalAlerts, highAlerts });
    } catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get('/reset', async (req, res) => {
    try {
        await Event.deleteMany({});
        await Alert.deleteMany({});
        broadcast({ type: 'reset', data: null });
        res.json({ message: "System logs and alerts cleared successfully" });
    } catch (err) {
        res.status(500).json({ error: "Failed to reset" });
    }
});

server.listen(3000, () => {
    console.log('Backend listening on port 3000');
});
