import React, { useState, useEffect } from 'react';
import { Sliders, Clock, Volume2, ShieldCheck, Database, Save, School, Sun, Moon } from 'lucide-react';
import { api } from '../services/api';

export default function SystemSettings({ settings, onSettingsUpdated, showToast }) {
  const [localSettings, setLocalSettings] = useState({
    schoolName: "Greenwood International School",
    schoolStartTime: "08:00",
    lateGraceMinutes: 15,
    schoolEndTime: "14:30",
    gateMode: "MANUAL_IN",
    distanceThreshold: 0.56,
    requireLiveness: false,
    cooldownMinutes: 1,
    voiceGreetings: true,
    soundEffects: true,
    ...settings
  });

  useEffect(() => {
    if (settings) {
      setLocalSettings(prev => ({ ...prev, ...settings }));
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      const res = await api.updateSettings(localSettings);
      if (res.success) {
        showToast('School timings and gate parameters saved successfully!', 'success');
        if (onSettingsUpdated) onSettingsUpdated(res.settings);
      }
    } catch (e) {
      showToast('Failed to save settings', 'error');
    }
  };

  const handleSeed = async () => {
    try {
      const res = await api.seedDemoData();
      if (res.success) {
        showToast(res.message, 'success');
      }
    } catch (e) {
      showToast('Failed to seed school data', 'error');
    }
  };

  return (
    <div className="tab-pane">
      <div className="settings-grid">
        
        {/* Card 1: School Shift & Manual Timings */}
        <div className="settings-card">
          <div className="card-header">
            <h3>Manual School Schedule & Timings</h3>
            <p className="card-subtitle">Set exact hours for morning assembly entry and afternoon dispersal</p>
          </div>
          <div className="settings-body">
            
            <div className="form-group">
              <label>School Institution Name</label>
              <input 
                type="text" 
                className="form-input"
                value={localSettings.schoolName}
                onChange={(e) => setLocalSettings({ ...localSettings, schoolName: e.target.value })}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Morning Entry Time (School Starts)</label>
                <input 
                  type="time" 
                  className="form-input"
                  value={localSettings.schoolStartTime}
                  onChange={(e) => setLocalSettings({ ...localSettings, schoolStartTime: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Late Grace Period (Minutes)</label>
                <input 
                  type="number" 
                  min="0" 
                  max="120"
                  className="form-input"
                  value={localSettings.lateGraceMinutes}
                  onChange={(e) => setLocalSettings({ ...localSettings, lateGraceMinutes: parseInt(e.target.value, 10) })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Afternoon Dispersal Time (School Over / Exit)</label>
              <input 
                type="time" 
                className="form-input"
                value={localSettings.schoolEndTime}
                onChange={(e) => setLocalSettings({ ...localSettings, schoolEndTime: e.target.value })}
              />
            </div>

            <p className="text-muted text-sm">
              ℹ️ Students scanning after <strong>{localSettings.schoolStartTime} + {localSettings.lateGraceMinutes} mins</strong> are automatically classified as <strong>Late Entry</strong>.
            </p>

          </div>
        </div>

        {/* Card 2: Gate Mode & Kiosk Policy */}
        <div className="settings-card">
          <div className="card-header">
            <h3>Gate Scanner Operation Mode</h3>
            <p className="card-subtitle">Control default In/Out behavior at school gate cameras</p>
          </div>
          <div className="settings-body">
            
            <div className="form-group">
              <label>Default Gate Mode</label>
              <select 
                className="form-select"
                value={localSettings.gateMode}
                onChange={(e) => setLocalSettings({ ...localSettings, gateMode: e.target.value })}
              >
                <option value="MANUAL_IN">Morning Entry (Punches are IN by default)</option>
                <option value="MANUAL_OUT">Afternoon Dispersal (Punches are OUT by default)</option>
                <option value="SCHEDULED">Automatic Window (In before 12:00 PM, Out after 12:00 PM)</option>
              </select>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <span className="setting-title">Gate Rapid Re-Scan Cooldown</span>
                <p className="setting-desc">Prevents duplicate scans when students line up in front of the lens.</p>
              </div>
              <select 
                className="form-select"
                style={{ width: 'auto' }}
                value={localSettings.cooldownMinutes}
                onChange={(e) => setLocalSettings({ ...localSettings, cooldownMinutes: parseInt(e.target.value, 10) })}
              >
                <option value={1}>1 Minute</option>
                <option value={2}>2 Minutes</option>
                <option value={5}>5 Minutes</option>
              </select>
            </div>

          </div>
        </div>

        {/* Card 3: AI Speed & Sensitivity */}
        <div className="settings-card">
          <div className="card-header">
            <h3>AI Recognition Tuning & Speed</h3>
            <p className="card-subtitle">Calibrate facial vector tolerance for student age groups</p>
          </div>
          <div className="settings-body">
            
            <div className="setting-item">
              <div className="setting-info">
                <span className="setting-title">Face Match Tolerance Threshold</span>
                <p className="setting-desc">0.56 provides fast, reliable recognition for students even with changing hairstyles or expressions.</p>
              </div>
              <div className="slider-wrap">
                <input 
                  type="range" 
                  min="0.45" 
                  max="0.65" 
                  step="0.01" 
                  className="form-range"
                  value={localSettings.distanceThreshold}
                  onChange={(e) => setLocalSettings({ ...localSettings, distanceThreshold: parseFloat(e.target.value) })}
                />
                <span className="slider-val">{localSettings.distanceThreshold}</span>
              </div>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <span className="setting-title">Anti-Spoofing Check</span>
                <p className="setting-desc">Keep disabled during rush hours so students can pass the gate quickly without waiting.</p>
              </div>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={localSettings.requireLiveness}
                  onChange={(e) => setLocalSettings({ ...localSettings, requireLiveness: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

          </div>
        </div>

        {/* Card 4: Audio & Speech Announcements */}
        <div className="settings-card">
          <div className="card-header">
            <h3>Voice Greetings & Sound Effects</h3>
            <p className="card-subtitle">Auditory feedback when a student is successfully verified</p>
          </div>
          <div className="settings-body">
            
            <div className="setting-item">
              <div className="setting-info">
                <span className="setting-title">Voice Announcement</span>
                <p className="setting-desc">Speaks: "Good morning, Aarav! Attendance recorded."</p>
              </div>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={localSettings.voiceGreetings}
                  onChange={(e) => setLocalSettings({ ...localSettings, voiceGreetings: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <span className="setting-title">Gate Confirmation Chime</span>
                <p className="setting-desc">Harmonic school chime upon valid biometric match.</p>
              </div>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={localSettings.soundEffects}
                  onChange={(e) => setLocalSettings({ ...localSettings, soundEffects: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="admin-actions-list" style={{ marginTop: '1.25rem' }}>
              <div className="admin-action-row">
                <div>
                  <strong>Seed Sample School Profiles & Attendance</strong>
                  <p className="text-muted text-sm">Populates realistic student records across classes 9-12.</p>
                </div>
                <button className="btn btn-outline" onClick={handleSeed}>
                  <Database size={16} />
                  Seed School Data
                </button>
              </div>

              <div className="admin-action-row">
                <div>
                  <strong>Save Configuration</strong>
                  <p className="text-muted text-sm">Commit all schedule and gate adjustments to database.</p>
                </div>
                <button className="btn btn-primary" onClick={handleSave}>
                  <Save size={16} />
                  Save Settings
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
