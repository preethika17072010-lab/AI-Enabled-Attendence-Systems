import React, { useState, useEffect } from 'react';
import { Download, PlusCircle, Filter, RotateCcw, X, Edit3, Trash2 } from 'lucide-react';
import { api } from '../services/api';

export default function AttendanceLogs({ showToast }) {
  const [logs, setLogs] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([
    "Class 1-A", "Class 2-A", "Class 3-A", "Class 4-A",
    "Class 5-A", "Class 6-A", "Class 7-A", "Class 8-A",
    "Class 9-A", "Class 9-B", "Class 10-A", "Class 10-B",
    "Class 11-Science", "Class 11-Commerce",
    "Class 12-Science", "Class 12-Commerce"
  ]);

  // Filters
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterClass, setFilterClass] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterSearch, setFilterSearch] = useState('');

  // Manual Punch / Time Adjust Modal
  const [showModal, setShowModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    studentId: '',
    date: new Date().toISOString().split('T')[0],
    punchInTime: '07:55:00',
    punchOutTime: '14:30:00',
    status: 'Present',
    notes: ''
  });

  const loadData = async () => {
    try {
      const params = {};
      if (filterDate) params.date = filterDate;
      if (filterClass !== 'All') params.className = filterClass;
      if (filterStatus !== 'All') params.status = filterStatus;
      if (filterSearch) params.search = filterSearch;

      const [logData, userData] = await Promise.all([
        api.getAttendance(params),
        api.getUsers()
      ]);

      if (logData.success) setLogs(logData.attendance);
      if (userData.success) setStudents(userData.students || userData.users || []);
    } catch (e) {
      console.warn('Error loading logs:', e);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterDate, filterClass, filterStatus, filterSearch]);

  const handleExportCsv = () => {
    const query = filterDate ? `?date=${filterDate}` : '';
    window.open(`/api/export/csv${query}`, '_blank');
  };

  // Open modal pre-filled for editing a specific record
  const openEditModal = (log) => {
    setManualForm({
      studentId: log.studentId || log.userId,
      date: log.date || new Date().toISOString().split('T')[0],
      punchInTime: log.punchInTime || '07:55:00',
      punchOutTime: log.punchOutTime || '14:30:00',
      status: log.status || 'Present',
      notes: log.notes || 'Time manually verified by teacher'
    });
    setShowModal(true);
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualForm.studentId) {
      showToast('Please select a student', 'warning');
      return;
    }

    try {
      const res = await api.manualPunch(manualForm);
      if (res.success) {
        showToast('Student attendance and timing successfully updated!', 'success');
        setShowModal(false);
        loadData();
      }
    } catch (e) {
      showToast('Failed to save manual attendance', 'error');
    }
  };

  const handleDeleteRecord = async (record) => {
    const studentName = record.studentName || record.userName || 'Student';
    if (!window.confirm(`Delete attendance record for ${studentName} on ${record.date}?`)) {
      return;
    }

    try {
      const res = await api.deleteAttendance(record.id);
      if (res.success) {
        showToast(`Attendance record for ${studentName} deleted.`, 'info');
        loadData();
      } else {
        showToast(res.message || 'Failed to delete record', 'error');
      }
    } catch (e) {
      showToast('Error deleting attendance record', 'error');
    }
  };

  const handleClearAttendance = async () => {
    const promptMsg = filterDate 
      ? `Clear all attendance records for ${filterDate}?`
      : 'Clear all attendance records across all dates?';

    if (!window.confirm(promptMsg)) {
      return;
    }

    try {
      const res = await api.clearAttendance(filterDate || null);
      if (res.success) {
        showToast(res.message, 'info');
        loadData();
      }
    } catch (e) {
      showToast('Error clearing attendance records', 'error');
    }
  };

  const resetFilters = () => {
    setFilterDate('');
    setFilterClass('All');
    setFilterStatus('All');
    setFilterSearch('');
  };

  return (
    <div className="tab-pane">
      
      {/* Header & Filter Card */}
      <div className="logs-header-card">
        <div className="logs-title-row">
          <div>
            <h2>School Attendance Ledger & Timings</h2>
            <p className="card-subtitle">Daily morning entry and afternoon dispersal records. Adjust timings manually or export to CSV.</p>
          </div>
          <div className="logs-actions">
            <button className="btn btn-outline" onClick={() => {
              setManualForm({
                studentId: '',
                date: new Date().toISOString().split('T')[0],
                punchInTime: '07:55:00',
                punchOutTime: '',
                status: 'Present',
                notes: ''
              });
              setShowModal(true);
            }}>
              <PlusCircle size={16} />
              Manual Time Entry / Override
            </button>
            <button className="btn btn-outline text-rose" onClick={handleClearAttendance} title="Clear attendance records">
              <Trash2 size={16} />
              Clear Records
            </button>
            <button className="btn btn-primary" onClick={handleExportCsv}>
              <Download size={16} />
              Export School CSV
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="logs-filter-toolbar">
          <div className="filter-group">
            <label>Date</label>
            <input 
              type="date" 
              className="form-input"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Class & Section</label>
            <select 
              className="form-select"
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
            >
              <option value="All">All Classes</option>
              {classes.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Attendance Status</label>
            <select 
              className="form-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Present">Present (On Time)</option>
              <option value="Late">Late Entry</option>
              <option value="Departed">Departed (Out)</option>
            </select>
          </div>

          <div className="filter-group flex-1">
            <label>Search Student</label>
            <input 
              type="text" 
              placeholder="Search by student name or roll no..." 
              className="form-input"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
            />
          </div>

          <div className="filter-group align-end">
            <button className="btn btn-outline" onClick={resetFilters}>
              <RotateCcw size={14} />
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="ledger-table-card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Gate Photo</th>
                <th>Student Name</th>
                <th>Roll No</th>
                <th>Class</th>
                <th>Date</th>
                <th>Morning In-Time</th>
                <th>Dispersal Out-Time</th>
                <th>Status</th>
                <th>AI Confidence</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center text-muted">
                    No attendance logs found matching current filter criteria.
                  </td>
                </tr>
              ) : (
                logs.map(item => (
                  <tr key={item.id}>
                    <td>
                      <img 
                        src={item.snapshotUrl || '/assets/default-avatar.svg'} 
                        className="table-avatar" 
                        alt="" 
                      />
                    </td>
                    <td><strong>{item.studentName || item.userName}</strong></td>
                    <td><span className="result-id">{item.rollNumber || item.idNumber}</span></td>
                    <td><span className="status-badge present">{item.className || item.department}</span></td>
                    <td><span className="text-muted text-sm">{item.date}</span></td>
                    <td><strong>{item.punchInTime || '-'}</strong></td>
                    <td><strong>{item.punchOutTime || '-'}</strong></td>
                    <td>
                      <span className={`status-badge ${item.status === 'Late' ? 'late' : (item.status === 'Departed' ? 'out' : 'present')}`}>
                        {item.status}
                      </span>
                    </td>
                    <td><span className="confidence-tag">{item.confidence}%</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button 
                          className="btn btn-sm btn-outline" 
                          onClick={() => openEditModal(item)}
                          title="Edit Student In/Out Timings"
                        >
                          <Edit3 size={13} /> Edit
                        </button>
                        <button 
                          className="btn btn-sm btn-outline text-rose" 
                          onClick={() => handleDeleteRecord(item)}
                          title="Delete this attendance record"
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual In/Out Time Override Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>Manual Student Timing Override</h3>
              <button className="modal-close-btn" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleManualSubmit} className="modal-body">
              <div className="form-group">
                <label>Select Student *</label>
                <select 
                  required 
                  className="form-select"
                  value={manualForm.studentId}
                  onChange={(e) => setManualForm({ ...manualForm, studentId: e.target.value })}
                >
                  <option value="">Choose a student...</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.rollNumber || s.idNumber} — {s.className || s.department})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Attendance Date *</label>
                  <input 
                    type="date" 
                    required 
                    className="form-input"
                    value={manualForm.date}
                    onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Status *</label>
                  <select 
                    className="form-select"
                    value={manualForm.status}
                    onChange={(e) => setManualForm({ ...manualForm, status: e.target.value })}
                  >
                    <option value="Present">Present (On Time)</option>
                    <option value="Late">Late Entry</option>
                    <option value="Departed">Departed (Out)</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Morning Entry Time (In-Time)</label>
                  <input 
                    type="time" 
                    step="1"
                    className="form-input"
                    value={manualForm.punchInTime}
                    onChange={(e) => setManualForm({ ...manualForm, punchInTime: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Dispersal Exit Time (Out-Time)</label>
                  <input 
                    type="time" 
                    step="1"
                    className="form-input"
                    value={manualForm.punchOutTime}
                    onChange={(e) => setManualForm({ ...manualForm, punchOutTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Teacher Override Reason / Notes</label>
                <input 
                  type="text" 
                  placeholder="e.g. Bus delayed / Medical appointment / Early departure permitted" 
                  className="form-input"
                  value={manualForm.notes}
                  onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Student Timing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
