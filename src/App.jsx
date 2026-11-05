import React, { useState, useEffect, useCallback } from 'react';
import { Camera, LayoutDashboard, GraduationCap, FileSpreadsheet, Settings, School } from 'lucide-react';
import ScannerKiosk from './components/ScannerKiosk';
import Dashboard from './components/Dashboard';
import EnrollmentStudio from './components/EnrollmentStudio';
import AttendanceLogs from './components/AttendanceLogs';
import SystemSettings from './components/SystemSettings';
import { aiEngine } from './services/aiEngine';
import { api } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('kiosk');
  const [settings, setSettings] = useState({
    schoolName: "Greenwood International School",
    schoolStartTime: "08:00",
    lateGraceMinutes: 15,
    schoolEndTime: "14:30",
    gateMode: "MANUAL_IN",
    distanceThreshold: 0.56,
    requireLiveness: false,
    cooldownMinutes: 1,
    voiceGreetings: true,
    soundEffects: true
  });

  const [aiStatus, setAiStatus] = useState({ loaded: false, text: 'AI Neural Model: Initializing...' });
  const [currentTime, setCurrentTime] = useState({ time: '00:00:00', date: '' });
  const [toasts, setToasts] = useState([]);

  // Toast Notification Dispatcher
  const showToast = useCallback((msg, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  // Clock Ticker
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime({
        time: now.toLocaleTimeString('en-US', { hour12: false }),
        date: now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
      });
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load Settings and Initialize AI Engine on start
  useEffect(() => {
    const initApp = async () => {
      try {
        const [settingsRes, usersRes] = await Promise.all([
          api.getSettings(),
          api.getUsers()
        ]);

        if (settingsRes.success) {
          setSettings(settingsRes.settings);
        }

        // Initialize Neural Network Models
        await aiEngine.loadModels((msg) => {
          setAiStatus({ loaded: false, text: msg });
        });

        if (usersRes.success) {
          const list = usersRes.students || usersRes.users || [];
          aiEngine.updateMatcher(list, settingsRes.settings?.distanceThreshold || 0.56);
        }

        setAiStatus({ loaded: true, text: 'Gate AI Scanner: Active & Lag-Free' });
      } catch (err) {
        console.error('Initialization error:', err);
        setAiStatus({ loaded: false, text: 'AI Model: Cloud Fallback Active' });
      }
    };

    initApp();
  }, []);

  const refreshEnrolledStudents = async () => {
    try {
      const res = await api.getUsers();
      if (res.success) {
        const list = res.students || res.users || [];
        aiEngine.updateMatcher(list, settings.distanceThreshold);
      }
    } catch (e) {
      console.warn('Could not refresh students:', e);
    }
  };

  return (
    <div className="app-layout">

      {/* Global School Navbar */}
      <header className="navbar">
        <div className="nav-brand" onClick={() => setActiveTab('kiosk')}>
          <div className="brand-icon">
            <School size={24} />
          </div>
          <div className="brand-text">
            <span className="brand-title">EduPass <span className="highlight">AI</span></span>
            <span className="brand-sub">{settings.schoolName || 'School Biometric Attendance'}</span>
          </div>
        </div>

        {/* Center Clock & AI Status */}
        <div className="header-center">
          <div className="status-pill">
            <span className={`pulse-dot ${aiStatus.loaded ? 'success' : 'warning'}`}></span>
            <span>{aiStatus.text}</span>
          </div>
          <div className="clock-display">
            <span className="clock-time">{currentTime.time}</span>
            <span className="clock-date">{currentTime.date}</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="nav-links">
          <button
            className={`nav-tab ${activeTab === 'kiosk' ? 'active' : ''}`}
            onClick={() => setActiveTab('kiosk')}
          >
            <Camera size={18} />
            Gate Scanner
          </button>
          <button
            className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={18} />
            Dashboard
          </button>
          <button
            className={`nav-tab ${activeTab === 'enroll' ? 'active' : ''}`}
            onClick={() => setActiveTab('enroll')}
          >
            <GraduationCap size={18} />
            Enroll Students
          </button>
          <button
            className={`nav-tab ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            <FileSpreadsheet size={18} />
            Attendance & Timings
          </button>
          <button
            className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={18} />
            School Timings
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        {activeTab === 'kiosk' && (
          <ScannerKiosk
            settings={settings}
            onAttendanceMarked={() => { }}
            showToast={showToast}
          />
        )}

        {activeTab === 'dashboard' && (
          <Dashboard
            onNavigate={(tab) => setActiveTab(tab)}
            showToast={showToast}
          />
        )}

        {activeTab === 'enroll' && (
          <EnrollmentStudio
            onUsersUpdated={refreshEnrolledStudents}
            showToast={showToast}
          />
        )}

        {activeTab === 'logs' && (
          <AttendanceLogs
            showToast={showToast}
          />
        )}

        {activeTab === 'settings' && (
          <SystemSettings
            settings={settings}
            onSettingsUpdated={(newSettings) => {
              setSettings(newSettings);
              refreshEnrolledStudents();
            }}
            showToast={showToast}
          />
        )}
      </main>

      {/* Floating Toast Notification Container */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}</span>
            <span>{toast.msg}</span>
          </div>
        ))}
      </div>

    </div>
  );
}
