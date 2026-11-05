/**
 * API Service for VisionPass AI Backend
 */

export const api = {
  // Settings & Configuration
  async getSettings() {
    const res = await fetch('/api/settings');
    return res.json();
  },

  async updateSettings(settings) {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    return res.json();
  },

  // Users / Members
  async getUsers() {
    const res = await fetch('/api/users');
    return res.json();
  },

  async enrollUser(userData) {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    return res.json();
  },

  async deleteUser(userId) {
    const res = await fetch(`/api/students/${userId}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  async deleteStudent(studentId) {
    return this.deleteUser(studentId);
  },

  // Attendance Punch
  async submitPunch(punchData) {
    const res = await fetch('/api/attendance/punch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(punchData)
    });
    return res.json();
  },

  async manualPunch(punchData) {
    const res = await fetch('/api/attendance/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(punchData)
    });
    return res.json();
  },

  // Delete Attendance Record
  async deleteAttendance(recordId) {
    const res = await fetch(`/api/attendance/${recordId}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  async clearAttendance(date = null) {
    const url = date ? `/api/attendance?date=${date}` : '/api/attendance?all=true';
    const res = await fetch(url, {
      method: 'DELETE'
    });
    return res.json();
  },

  // History Logs
  async getAttendance(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`/api/attendance${query ? `?${query}` : ''}`);
    return res.json();
  },

  // Dashboard Stats
  async getStats() {
    const res = await fetch('/api/stats');
    return res.json();
  },

  // Demo Seed
  async seedDemoData() {
    const res = await fetch('/api/seed', { method: 'POST' });
    return res.json();
  }
};

