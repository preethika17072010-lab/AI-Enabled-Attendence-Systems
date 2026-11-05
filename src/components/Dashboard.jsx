import React, { useState, useEffect, useRef } from 'react';
import { GraduationCap, CheckCircle, Clock, AlertTriangle, Play, Database, ArrowRight } from 'lucide-react';
import { api } from '../services/api';

export default function Dashboard({ onNavigate, showToast }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef(null);

  const loadStats = async () => {
    try {
      const data = await api.getStats();
      if (data.success) {
        setStats(data);
      }
    } catch (e) {
      console.warn('Dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  // Draw Canvas Hourly Entry Chart
  useEffect(() => {
    if (!stats || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { labels, data } = stats.hourlyStats;

    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = 220 * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = 220;
    const maxVal = Math.max(...data, 5);

    ctx.clearRect(0, 0, w, h);

    const padLeft = 35;
    const padRight = 15;
    const padBottom = 30;
    const padTop = 20;

    const chartW = w - padLeft - padRight;
    const chartH = h - padBottom - padTop;
    const barWidth = Math.max(14, (chartW / labels.length) - 14);

    // Grid lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padTop + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(w - padRight, y);
      ctx.stroke();

      const val = Math.round(maxVal - (maxVal / 4) * i);
      ctx.fillStyle = '#64748b';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(val, padLeft - 8, y + 3);
    }

    // Bars
    labels.forEach((label, i) => {
      const val = data[i];
      const barH = (val / maxVal) * chartH;
      const x = padLeft + (i * (chartW / labels.length)) + ((chartW / labels.length - barWidth) / 2);
      const y = padTop + chartH - barH;

      const grad = ctx.createLinearGradient(0, y, 0, padTop + chartH);
      grad.addColorStop(0, '#38bdf8');
      grad.addColorStop(1, '#6366f1');

      ctx.fillStyle = grad;
      ctx.beginPath();
      const r = Math.min(4, barWidth / 2);
      ctx.moveTo(x, padTop + chartH);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.lineTo(x + barWidth - r, y);
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + r);
      ctx.lineTo(x + barWidth, padTop + chartH);
      ctx.closePath();
      ctx.fill();

      if (val > 0) {
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(val, x + barWidth / 2, y - 5);
      }

      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px Plus Jakarta Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x + barWidth / 2, h - 8);
    });
  }, [stats]);

  const handleSeed = async () => {
    try {
      const res = await api.seedDemoData();
      if (res.success) {
        showToast(res.message, 'success');
        loadStats();
      }
    } catch (e) {
      showToast('Failed to seed school data', 'error');
    }
  };

  const metrics = stats?.metrics || {
    totalStudents: 0,
    presentCount: 0,
    lateCount: 0,
    absentCount: 0,
    attendanceRate: 0
  };

  const classStats = stats?.classStats || stats?.departmentStats || {};
  const recentActivities = stats?.recentActivities || [];

  return (
    <div className="tab-pane">
      
      {/* Banner */}
      <div className="dashboard-banner">
        <div>
          <h2>School Attendance Dashboard</h2>
          <p className="text-muted">Real-time student arrival stats, class-wise presence rates, and entry velocity.</p>
        </div>
        <div className="banner-actions">
          <button className="btn btn-outline" onClick={handleSeed}>
            <Database size={16} />
            Load Sample School Data
          </button>
          <button className="btn btn-primary" onClick={() => onNavigate('kiosk')}>
            <Play size={16} />
            Open Gate Scanner
          </button>
        </div>
      </div>

      {/* 4 KPI Metrics */}
      <div className="stats-grid">
        
        <div className="stat-card">
          <div className="stat-icon bg-indigo">
            <GraduationCap size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Students</span>
            <h2 className="stat-value">{metrics.totalStudents || metrics.totalUsers || 0}</h2>
            <span className="stat-hint">Active enrolled students</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon bg-emerald">
            <CheckCircle size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Present Today</span>
            <h2 className="stat-value">{metrics.presentCount}</h2>
            <span className="stat-hint text-emerald">{metrics.attendanceRate}% School Attendance</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon bg-amber">
            <Clock size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Late Arrivals</span>
            <h2 className="stat-value">{metrics.lateCount}</h2>
            <span className="stat-hint text-amber">Arrived after morning grace cutoff</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon bg-rose">
            <AlertTriangle size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Absent / Pending</span>
            <h2 className="stat-value">{metrics.absentCount}</h2>
            <span className="stat-hint text-rose">Not yet clocked in at gate</span>
          </div>
        </div>

      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        
        {/* Hourly Distribution */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Morning Gate Arrival Velocity</h3>
            <span className="text-muted text-sm">7:00 AM — 3:00 PM</span>
          </div>
          <div className="chart-body">
            <canvas ref={canvasRef} height="220" />
          </div>
        </div>

        {/* Class Breakdown */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Class-Wise Attendance Coverage</h3>
            <span className="text-muted text-sm">Present vs Enrolled</span>
          </div>
          <div className="chart-body">
            {Object.keys(classStats).length === 0 ? (
              <div className="empty-state-sm">No class attendance data available yet</div>
            ) : (
              Object.keys(classStats).map(cls => {
                const stat = classStats[cls];
                if (stat.total === 0) return null; // hide empty classes for clean view
                const pct = stat.total > 0 ? Math.round((stat.present / stat.total) * 100) : 0;
                return (
                  <div key={cls} className="dept-bar-item">
                    <div className="dept-bar-label">
                      <strong>{cls}</strong>
                      <span className="text-muted">{stat.present} / {stat.total} ({pct}%)</span>
                    </div>
                    <div className="dept-bar-track">
                      <div className="dept-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Recent Table */}
      <div className="recent-table-card">
        <div className="table-card-header">
          <h3>Recent Student Verifications</h3>
          <button className="btn btn-sm btn-outline" onClick={() => onNavigate('logs')}>
            View Full Ledger <ArrowRight size={14} />
          </button>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Roll No</th>
                <th>Class</th>
                <th>Morning In-Time</th>
                <th>Dispersal Out-Time</th>
                <th>Status</th>
                <th>AI Confidence</th>
                <th>Parent Notification</th>
              </tr>
            </thead>
            <tbody>
              {recentActivities.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center text-muted">
                    No student attendance recorded today yet.
                  </td>
                </tr>
              ) : (
                recentActivities.map(item => (
                  <tr key={item.id}>
                    <td>
                      <div className="member-cell">
                        <img 
                          src={item.snapshotUrl || '/assets/default-avatar.svg'} 
                          className="table-avatar" 
                          alt="" 
                        />
                        <strong>{item.studentName || item.userName}</strong>
                      </div>
                    </td>
                    <td><span className="result-id">{item.rollNumber || item.idNumber}</span></td>
                    <td><span className="status-badge present">{item.className || item.department}</span></td>
                    <td>{item.punchInTime || '-'}</td>
                    <td>{item.punchOutTime || '-'}</td>
                    <td>
                      <span className={`status-badge ${item.status === 'Late' ? 'late' : (item.status === 'Departed' ? 'out' : 'present')}`}>
                        {item.status}
                      </span>
                    </td>
                    <td><span className="confidence-tag">{item.confidence}%</span></td>
                    <td>
                      <span className="text-emerald text-sm">
                        SMS/WhatsApp Alert Sent ✅
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
