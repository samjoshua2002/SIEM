import React, { useState, useEffect } from 'react';
import {
  Shield,
  AlertTriangle,
  Terminal,
  Activity,
  Bell,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  Zap,
  ChevronDown,
  ChevronUp,
  Info,
  ShieldAlert
} from 'lucide-react';
import { format } from 'date-fns';

const API_BASE = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000';

const AlertAccordionItem = ({ group, getSeverityColor, allEvents }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Filter events that belong to this alert type
  const relevantEvents = allEvents.filter(e => {
    if (group.type.includes("Root") || group.type.includes("Activity")) {
      return e.event_type === "privilege_escalation";
    }
    return e.event_type === "auth_failure";
  }).slice(0, 10);

  return (
    <div className={`glass-card overflow-hidden transition-all duration-500 ${isOpen ? 'ring-1 ring-white/20' : 'border-white/5'}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center p-6">
          {/* Column 1: Type */}
          <div className="w-1/3 flex items-center gap-5">
            <div className={`p-3 rounded-2xl ${group.severity === 'High' ? 'bg-red-500/20 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'bg-yellow-500/20 text-yellow-500'}`}>
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="font-black text-white/90 text-xl tracking-tight">{group.type}</div>
              <div className="text-[10px] text-white/20 uppercase tracking-[0.2em] font-black mt-0.5">Threat Category</div>
            </div>
          </div>

          {/* Column 2: Status */}
          <div className="w-1/3 flex flex-col justify-center px-4">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${getSeverityColor(group.severity)}`}>
                {group.severity}
              </span>
              <span className="text-white/40 text-xs font-bold font-mono">
                {group.items.length} {group.items.length === 1 ? 'TRIGGER' : 'TRIGGERS'}
              </span>
            </div>
            <div className="text-[10px] text-white/10 uppercase tracking-[0.1em] font-black mt-2">Active State Analysis</div>
          </div>

          {/* Column 3: Time & Toggle */}
          <div className="w-1/3 flex items-center justify-end gap-10">
            <div className="text-right">
              <div className="text-white/90 font-mono font-black text-2xl tracking-tighter">{format(new Date(group.latestTime), 'HH:mm:ss')}</div>
              <div className="text-[10px] text-white/20 uppercase tracking-[0.2em] font-black">Latest Visibility</div>
            </div>
            <div className={`p-2.5 rounded-xl transition-all duration-300 ${isOpen ? 'bg-red-500/10 text-red-500' : 'bg-white/5 text-white/20'}`}>
              {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-white/5 bg-black/20 animate-in slide-in-from-top-6 duration-500">
          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <h5 className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Associated Raw Log Stream</h5>
              <div className="h-px flex-1 mx-6 bg-gradient-to-r from-white/10 to-transparent" />
            </div>
            <div className="space-y-3">
              {relevantEvents.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-5 rounded-[1.25rem] bg-white/[0.02] border border-white/5 group hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300">
                  <div className="flex items-center gap-5">
                    <div className="w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center border border-white/5">
                      <Terminal className="w-4 h-4 text-blue-400/50" />
                    </div>
                    <div>
                      <div className="text-sm font-black text-white/80 tracking-wide">{item.user}@{item.hostname}</div>
                      <code className="text-[10px] text-white/30 font-mono mt-1 block px-2 py-0.5 bg-black/40 rounded border border-white/5">
                        {item.command || 'EXEC_BINARY_UNKNOWN'}
                      </code>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <div className="text-xs text-white/50 font-mono font-bold tracking-tighter">{format(new Date(item.timestamp), 'HH:mm:ss.SSS')}</div>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded-md">
                      <span className="w-1 h-1 rounded-full bg-green-500" />
                      <span className="text-[8px] text-green-500 font-black uppercase">Verified Log</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function App() {
  const [events, setEvents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({ totalEvents: 0, totalAlerts: 0, highAlerts: 0 });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchStats, 5000);

    const ws = new WebSocket(WS_URL);
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      const { type, data } = JSON.parse(event.data);
      if (type === 'new_event') {
        setEvents(prev => {
          if (prev.length > 0 && prev[0]._id === data._id) return prev;
          return [data, ...prev].slice(0, 100);
        });
        fetchStats();
      } else if (type === 'new_alert') {
        setAlerts(prev => {
          if (prev.length > 0 && prev[0]._id === data._id) return prev;
          return [data, ...prev].slice(0, 50);
        });
        fetchStats();
      } else if (type === 'reset') {
        setEvents([]);
        setAlerts([]);
        setStats({ totalEvents: 0, totalAlerts: 0, highAlerts: 0 });
      }
    };

    return () => {
      ws.close();
      clearInterval(timer);
    };
  }, []);

  const fetchData = async () => {
    try {
      const [eventsRes, alertsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/events`),
        fetch(`${API_BASE}/alerts`),
        fetch(`${API_BASE}/stats`)
      ]);
      setEvents(await eventsRes.json());
      setAlerts(await alertsRes.json());
      setStats(await statsRes.json());
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/stats`);
      setStats(await res.json());
    } catch (err) { }
  };

  const groupedAlerts = React.useMemo(() => {
    const groups = {};
    alerts.forEach(alert => {
      if (!groups[alert.alert_type]) {
        groups[alert.alert_type] = {
          type: alert.alert_type,
          severity: alert.severity,
          latestTime: alert.timestamp,
          items: []
        };
      }
      groups[alert.alert_type].items.push(alert);
      if (new Date(alert.timestamp) > new Date(groups[alert.alert_type].latestTime)) {
        groups[alert.alert_type].latestTime = alert.timestamp;
      }
    });
    return Object.values(groups).sort((a, b) => new Date(b.latestTime) - new Date(a.latestTime));
  }, [alerts]);

  const getSeverityColor = (sev) => {
    switch (sev?.toLowerCase()) {
      case 'high': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      default: return 'text-green-500 bg-green-500/10 border-green-500/20';
    }
  };

  return (
    <div className="min-h-screen p-8 max-w-[1400px] mx-auto space-y-12">
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-red-500 rounded-2xl shadow-[0_0_30px_rgba(239,68,68,0.3)]">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white/90">SIEM <span className="text-red-500 underline decoration-red-500/30 underline-offset-8">CORE</span></h1>
            <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 mt-1">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
              Subsystem {connected ? 'Operational' : 'Disconnected'}
            </p>
          </div>
        </div>
        <div className="glass-card px-5 py-2.5 rounded-2xl border-white/10 flex items-center gap-3">
          <Clock className="w-4 h-4 text-red-500" />
          <span className="text-sm font-bold font-mono text-white/80">{format(new Date(), 'HH:mm:ss')}</span>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { label: 'Activity Logs', value: stats.totalEvents, icon: Activity, color: 'text-blue-500' },
          { label: 'Threat Incidents', value: stats.totalAlerts, icon: Bell, color: 'text-yellow-500' },
          { label: 'Critical Breaches', value: stats.highAlerts, icon: AlertTriangle, color: 'text-red-500', pulse: stats.highAlerts > 0 }
        ].map((s, i) => (
          <div key={i} className={`glass-card p-8 rounded-3xl flex items-center justify-between transition-all duration-500 hover:border-white/20 ${s.pulse ? 'alert-pulse border-red-500/40' : 'border-white/5'}`}>
            <div>
              <p className="text-white/30 text-[10px] font-black uppercase tracking-widest leading-none">{s.label}</p>
              <h2 className="text-5xl font-black mt-3 font-mono text-white/90">{s.value}</h2>
            </div>
            <div className={`p-5 rounded-2xl bg-white/5 ${s.color}`}>
              <s.icon className="w-10 h-10" />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-white/5 pb-6">
          <div className="flex items-center gap-4">
            <h3 className="text-2xl font-black text-white/90 tracking-tight">SECURITY INTELLIGENCE</h3>
            <div className="h-1 w-12 bg-red-500 rounded-full" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Live Telemetry</span>
            <div className="px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full">
              <span className="text-[10px] font-black text-red-500 uppercase">{alerts.length} Detected</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {groupedAlerts.length > 0 ? (
            groupedAlerts.map((group, i) => (
              <AlertAccordionItem
                key={group.type || i}
                group={group}
                getSeverityColor={getSeverityColor}
                allEvents={events}
              />
            ))
          ) : (
            <div className="glass-card p-24 text-center rounded-[2.5rem] border-dashed border-2 border-white/5 bg-white/[0.01]">
              <div className="bg-green-500/10 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 transform rotate-3">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <h4 className="text-2xl font-bold text-white/90">Zone Secure</h4>
              <p className="text-white/30 mt-2 text-sm max-w-md mx-auto">No unauthorized access or brute force patterns identified in the current session logs.</p>
            </div>
          )}
        </div>
      </div>

      <footer className="pt-12 pb-4 text-center">
        <p className="text-[10px] font-black text-white/10 uppercase tracking-[0.5em]">Sentinel SIEM Core v4.0 // Security Enabled</p>
      </footer>
    </div>
  );
}

export default App;
