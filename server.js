const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Directories
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const DIST_DIR = path.join(__dirname, 'dist');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Static Assets
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
}
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/models', express.static(path.join(__dirname, 'node_modules/@vladmandic/face-api/model')));

// Default School Database Schema
const DEFAULT_DB = {
  settings: {
    schoolName: "Greenwood International School",
    schoolStartTime: "08:00",     // Official school start time
    lateGraceMinutes: 15,          // Late cutoff after 08:15 AM
    schoolEndTime: "14:30",       // Dispersal / School Over time
    gateMode: "MANUAL_IN",        // 'MANUAL_IN' | 'MANUAL_OUT' | 'SCHEDULED'
    distanceThreshold: 0.56,      // 0.56 is optimal for fast, reliable student recognition
    requireLiveness: false,       // Disabled by default to prevent student queue lag at gate
    cooldownMinutes: 1,           // 1 min cooldown to avoid duplicate scans
    voiceGreetings: true,         // Speaks greeting: "Good morning, Aarav! Marked present."
    soundEffects: true
  },
  classes: [
    "Class 1-A", "Class 2-A", "Class 3-A", "Class 4-A",
    "Class 5-A", "Class 6-A", "Class 7-A", "Class 8-A",
    "Class 9-A", "Class 9-B", "Class 10-A", "Class 10-B",
    "Class 11-Science", "Class 11-Commerce",
    "Class 12-Science", "Class 12-Commerce"
  ],
  students: [],
  attendance: []
};

// Database Helpers
function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2));
      return DEFAULT_DB;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const db = JSON.parse(raw);

    let needsWrite = false;

    // Migrate settings
    if (!db.settings.schoolStartTime || !db.settings.schoolName) {
      db.settings = {
        ...DEFAULT_DB.settings,
        ...db.settings,
        schoolName: db.settings.schoolName || DEFAULT_DB.settings.schoolName,
        schoolStartTime: db.settings.schoolStartTime || db.settings.shiftStartTime || "08:00",
        lateGraceMinutes: db.settings.lateGraceMinutes || db.settings.gracePeriodMinutes || 15,
        schoolEndTime: db.settings.schoolEndTime || "14:30",
        gateMode: db.settings.gateMode || "MANUAL_IN",
        distanceThreshold: db.settings.distanceThreshold || 0.56,
        requireLiveness: false
      };
      needsWrite = true;
    }

    if (!db.classes || db.classes.length === 0) {
      db.classes = DEFAULT_DB.classes;
      needsWrite = true;
    }

    // Preserve and migrate enrolled students (e.g. hashwanth)
    const existingList = (db.students && db.students.length > 0) ? db.students : (db.users || []);
    db.students = existingList.map(s => ({
      ...s,
      rollNumber: s.rollNumber || s.idNumber || 'ROLL-1',
      className: s.className || (s.department && s.department.startsWith('Class') ? s.department : 'Class 10-A'),
      parentName: s.parentName || 'Parent / Guardian',
      parentPhone: s.parentPhone || ''
    }));

    if (!db.users || db.users.length !== db.students.length) {
      db.users = db.students;
      needsWrite = true;
    }

    if (needsWrite) {
      writeDb(db);
    }

    return db;
  } catch (err) {
    console.error('Error reading DB:', err);
    return DEFAULT_DB;
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error('Error writing DB:', err);
    return false;
  }
}

function getTodayString() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

function getTimeString(date = new Date()) {
  return date.toTimeString().split(' ')[0];
}

function saveBase64Image(base64Data, prefix = 'student') {
  if (!base64Data || !base64Data.includes(',')) return null;
  try {
    const parts = base64Data.split(',');
    const ext = parts[0].includes('png') ? 'png' : 'jpg';
    const buffer = Buffer.from(parts[1], 'base64');
    const filename = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filePath, buffer);
    return `/uploads/${filename}`;
  } catch (err) {
    console.error('Failed to save image:', err);
    return null;
  }
}

// ======================== API ROUTES ========================

// 1. Settings (School Timings & Gate Policy)
app.get('/api/settings', (req, res) => {
  const db = readDb();
  res.json({ 
    success: true, 
    settings: db.settings, 
    classes: db.classes,
    departments: db.classes // alias for backwards compatibility
  });
});

app.post('/api/settings', (req, res) => {
  const db = readDb();
  db.settings = { ...db.settings, ...req.body };
  writeDb(db);
  res.json({ success: true, settings: db.settings });
});

// 2. Students Enrollment & Management
app.get(['/api/students', '/api/users'], (req, res) => {
  const db = readDb();
  res.json({ success: true, students: db.students, users: db.students });
});

app.post(['/api/students', '/api/users'], (req, res) => {
  const { 
    name, 
    rollNumber, 
    idNumber, 
    className, 
    department, 
    parentName, 
    parentPhone, 
    email, 
    descriptors, 
    photoBase64 
  } = req.body;

  const studentName = name?.trim();
  const studentRoll = (rollNumber || idNumber || '').trim().toUpperCase();
  const studentClass = className || department || 'Class 10-A';

  if (!studentName || !studentRoll) {
    return res.status(400).json({ success: false, message: 'Student Name and Roll Number are required.' });
  }

  const db = readDb();
  const existing = db.students.find(s => s.rollNumber.toLowerCase() === studentRoll.toLowerCase());
  if (existing) {
    return res.status(400).json({ success: false, message: `Student with Roll Number ${studentRoll} already exists.` });
  }

  let photoUrl = '/assets/default-avatar.svg';
  if (photoBase64) {
    const saved = saveBase64Image(photoBase64, `stu_${studentRoll}`);
    if (saved) photoUrl = saved;
  }

  const newStudent = {
    id: `stu_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    name: studentName,
    rollNumber: studentRoll,
    idNumber: studentRoll, // backwards compatibility
    className: studentClass,
    department: studentClass, // backwards compatibility
    parentName: parentName || 'Parent / Guardian',
    parentPhone: parentPhone || '',
    email: email || '',
    photoUrl: photoUrl,
    descriptors: Array.isArray(descriptors) ? descriptors : [],
    createdAt: new Date().toISOString()
  };

  db.students.push(newStudent);
  writeDb(db);
  res.json({ success: true, student: newStudent, user: newStudent });
});

app.delete(['/api/students/:id', '/api/users/:id'], (req, res) => {
  const db = readDb();
  const student = db.students.find(s => s.id === req.params.id);
  if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

  if (student.photoUrl && student.photoUrl.startsWith('/uploads/')) {
    const fullPath = path.join(DATA_DIR, student.photoUrl);
    if (fs.existsSync(fullPath)) {
      try { fs.unlinkSync(fullPath); } catch (e) {}
    }
  }

  db.students = db.students.filter(s => s.id !== req.params.id);
  db.users = (db.users || []).filter(u => u.id !== req.params.id);
  // Cascade delete attendance history for this student
  db.attendance = db.attendance.filter(a => a.studentId !== req.params.id && a.userId !== req.params.id);

  writeDb(db);
  res.json({ success: true, message: `Student ${student.name} and attendance history removed.` });
});

// Delete individual attendance record
app.delete('/api/attendance/:id', (req, res) => {
  const db = readDb();
  const record = db.attendance.find(a => a.id === req.params.id);
  if (!record) return res.status(404).json({ success: false, message: 'Attendance record not found' });

  if (record.snapshotUrl && record.snapshotUrl.startsWith('/uploads/')) {
    const fullPath = path.join(DATA_DIR, record.snapshotUrl);
    if (fs.existsSync(fullPath)) {
      try { fs.unlinkSync(fullPath); } catch (e) {}
    }
  }

  db.attendance = db.attendance.filter(a => a.id !== req.params.id);
  writeDb(db);
  res.json({ success: true, message: 'Attendance record deleted successfully.' });
});

// Bulk clear attendance records (by date or all)
app.delete('/api/attendance', (req, res) => {
  const { date, all } = req.query;
  const db = readDb();

  if (all === 'true' || !date) {
    db.attendance = [];
  } else {
    db.attendance = db.attendance.filter(a => a.date !== date);
  }

  writeDb(db);
  res.json({ 
    success: true, 
    message: date ? `Attendance records for ${date} cleared.` : 'All attendance records cleared.' 
  });
});

// 3. Fast Biometric Punch (Manual In / Manual Out / Scheduled)
app.post('/api/attendance/punch', (req, res) => {
  const { userId, confidence, snapshotBase64, mode } = req.body;
  const db = readDb();

  const student = db.students.find(s => s.id === userId);
  if (!student) {
    return res.status(404).json({ success: false, message: 'Unrecognized student profile.' });
  }

  const today = getTodayString();
  const now = new Date();
  const timeStr = getTimeString(now);

  // Rapid Scan Cooldown (default 1 min)
  const cooldownMs = (db.settings.cooldownMinutes || 1) * 60 * 1000;
  const todayPunch = db.attendance.find(a => (a.studentId === student.id || a.userId === student.id) && a.date === today);

  if (todayPunch) {
    const elapsed = now - new Date(todayPunch.timestamp);
    if (elapsed < cooldownMs) {
      const waitSeconds = Math.ceil((cooldownMs - elapsed) / 1000);
      return res.json({
        success: false,
        cooldown: true,
        message: `${student.name} was already punched ${waitSeconds}s ago.`,
        record: todayPunch,
        student
      });
    }
  }

  // Determine Punch Type:
  // Mode priority:
  // 1. Explicit request mode ('in' | 'out')
  // 2. Setting gateMode ('MANUAL_IN' | 'MANUAL_OUT' | 'SCHEDULED')
  let punchType = 'IN';

  if (mode === 'in') {
    punchType = 'IN';
  } else if (mode === 'out') {
    punchType = 'OUT';
  } else if (db.settings.gateMode === 'MANUAL_OUT') {
    punchType = 'OUT';
  } else if (db.settings.gateMode === 'MANUAL_IN') {
    punchType = 'IN';
  } else {
    // SCHEDULED mode: Before 12:00 PM is Entry (IN), 12:00 PM and later is Dispersal (OUT)
    const hour = now.getHours();
    if (hour < 12) {
      punchType = 'IN';
    } else {
      punchType = 'OUT';
    }
  }

  // Calculate Late Arrival status
  const [startH, startM] = (db.settings.schoolStartTime || "08:00").split(':').map(Number);
  const cutoffTime = new Date(now);
  cutoffTime.setHours(startH, startM + (db.settings.lateGraceMinutes || 15), 0, 0);

  const isLate = now > cutoffTime;

  let snapshotUrl = null;
  if (snapshotBase64) {
    snapshotUrl = saveBase64Image(snapshotBase64, `att_${student.rollNumber}`);
  }

  let attendanceRecord = db.attendance.find(a => (a.studentId === student.id || a.userId === student.id) && a.date === today);

  if (punchType === 'IN') {
    if (!attendanceRecord) {
      attendanceRecord = {
        id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        studentId: student.id,
        userId: student.id,
        studentName: student.name,
        userName: student.name,
        rollNumber: student.rollNumber,
        idNumber: student.rollNumber,
        className: student.className,
        department: student.className,
        date: today,
        punchInTime: timeStr,
        punchOutTime: null,
        timestamp: now.toISOString(),
        status: isLate ? 'Late' : 'Present',
        confidence: Number(confidence || 96).toFixed(1),
        snapshotUrl: snapshotUrl || student.photoUrl,
        verifiedBy: 'AI School Gate Scanner',
        parentNotified: true
      };
      db.attendance.unshift(attendanceRecord);
    } else {
      // Update in-time
      attendanceRecord.punchInTime = timeStr;
      attendanceRecord.timestamp = now.toISOString();
      if (snapshotUrl) attendanceRecord.snapshotUrl = snapshotUrl;
      attendanceRecord.confidence = Number(confidence || 96).toFixed(1);
    }
  } else {
    // Punch OUT (School Departure / Dispersal)
    if (!attendanceRecord) {
      attendanceRecord = {
        id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        studentId: student.id,
        userId: student.id,
        studentName: student.name,
        userName: student.name,
        rollNumber: student.rollNumber,
        idNumber: student.rollNumber,
        className: student.className,
        department: student.className,
        date: today,
        punchInTime: null,
        punchOutTime: timeStr,
        timestamp: now.toISOString(),
        status: 'Departed',
        confidence: Number(confidence || 96).toFixed(1),
        snapshotUrl: snapshotUrl || student.photoUrl,
        verifiedBy: 'AI School Gate Scanner',
        parentNotified: true
      };
      db.attendance.unshift(attendanceRecord);
    } else {
      attendanceRecord.punchOutTime = timeStr;
      attendanceRecord.timestamp = now.toISOString();
      if (snapshotUrl) attendanceRecord.snapshotUrl = snapshotUrl;
    }
  }

  writeDb(db);

  const statusText = punchType === 'IN' 
    ? (attendanceRecord.status === 'Late' ? 'LATE ENTRY' : 'PRESENT')
    : 'DISPERSAL (OUT)';

  return res.json({
    success: true,
    punchType,
    record: attendanceRecord,
    student: {
      id: student.id,
      name: student.name,
      rollNumber: student.rollNumber,
      className: student.className,
      photoUrl: student.photoUrl,
      parentPhone: student.parentPhone
    },
    user: {
      id: student.id,
      name: student.name,
      idNumber: student.rollNumber,
      department: student.className,
      photoUrl: student.photoUrl
    },
    message: punchType === 'IN'
      ? `Good morning, ${student.name}! Entry recorded at ${timeStr} (${statusText}).`
      : `Goodbye, ${student.name}! Dispersal recorded at ${timeStr}.`
  });
});

// 4. Manual Attendance Edit (Teacher / Admin can set exact in/out times manually)
app.post('/api/attendance/manual', (req, res) => {
  const { studentId, userId, date, punchInTime, punchOutTime, status, notes } = req.body;
  const db = readDb();
  const idToFind = studentId || userId;
  const student = db.students.find(s => s.id === idToFind);

  if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

  const recordDate = date || getTodayString();
  let existing = db.attendance.find(a => (a.studentId === student.id || a.userId === student.id) && a.date === recordDate);

  if (existing) {
    if (punchInTime !== undefined) existing.punchInTime = punchInTime || null;
    if (punchOutTime !== undefined) existing.punchOutTime = punchOutTime || null;
    if (status) existing.status = status;
    existing.verifiedBy = 'Manual Override (Teacher/Admin)';
    existing.notes = notes || '';
  } else {
    existing = {
      id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      studentId: student.id,
      userId: student.id,
      studentName: student.name,
      userName: student.name,
      rollNumber: student.rollNumber,
      idNumber: student.rollNumber,
      className: student.className,
      department: student.className,
      date: recordDate,
      punchInTime: punchInTime || '08:00:00',
      punchOutTime: punchOutTime || null,
      timestamp: new Date().toISOString(),
      status: status || 'Present',
      confidence: '100.0',
      snapshotUrl: student.photoUrl,
      verifiedBy: 'Manual Override (Teacher/Admin)',
      notes: notes || '',
      parentNotified: true
    };
    db.attendance.unshift(existing);
  }

  writeDb(db);
  res.json({ success: true, record: existing });
});

// 5. Attendance Ledger Logs
app.get('/api/attendance', (req, res) => {
  const { date, className, department, search, status } = req.query;
  const db = readDb();

  let list = db.attendance;
  if (date) list = list.filter(a => a.date === date);
  const targetClass = className || department;
  if (targetClass && targetClass !== 'All') {
    list = list.filter(a => (a.className === targetClass || a.department === targetClass));
  }
  if (status && status !== 'All') list = list.filter(a => a.status === status);
  if (search) {
    const s = search.toLowerCase();
    list = list.filter(a => 
      (a.studentName && a.studentName.toLowerCase().includes(s)) ||
      (a.userName && a.userName.toLowerCase().includes(s)) ||
      (a.rollNumber && a.rollNumber.toLowerCase().includes(s)) ||
      (a.idNumber && a.idNumber.toLowerCase().includes(s))
    );
  }

  res.json({ success: true, count: list.length, attendance: list });
});

// 6. School Attendance Stats
app.get('/api/stats', (req, res) => {
  const db = readDb();
  const today = getTodayString();
  const todayRecords = db.attendance.filter(a => a.date === today);

  const totalStudents = db.students.length;
  const presentCount = todayRecords.filter(a => a.punchInTime !== null).length;
  const lateCount = todayRecords.filter(a => a.status === 'Late').length;
  const absentCount = Math.max(0, totalStudents - presentCount);
  const attendanceRate = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

  // Class-wise attendance stats
  const classStats = {};
  db.classes.forEach(c => {
    classStats[c] = { total: 0, present: 0 };
  });

  db.students.forEach(s => {
    const cls = s.className || s.department || 'Other';
    if (!classStats[cls]) classStats[cls] = { total: 0, present: 0 };
    classStats[cls].total++;
  });

  todayRecords.forEach(a => {
    const cls = a.className || a.department || 'Other';
    if (classStats[cls]) classStats[cls].present++;
  });

  // Hourly check-in timeline (7 AM to 3 PM)
  const hourly = Array(9).fill(0); // 7, 8, 9, 10, 11, 12, 13, 14, 15
  todayRecords.forEach(a => {
    if (a.punchInTime) {
      const hour = parseInt(a.punchInTime.split(':')[0], 10);
      if (hour >= 7 && hour <= 15) {
        hourly[hour - 7]++;
      }
    }
  });

  res.json({
    success: true,
    today,
    metrics: {
      totalUsers: totalStudents,
      totalStudents,
      presentCount,
      lateCount,
      absentCount,
      attendanceRate
    },
    departmentStats: classStats, // alias
    classStats,
    hourlyStats: {
      labels: ["7 AM", "8 AM", "9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM"],
      data: hourly
    },
    recentActivities: todayRecords.slice(0, 10)
  });
});

// 7. CSV Export
app.get('/api/export/csv', (req, res) => {
  const db = readDb();
  const date = req.query.date || getTodayString();
  const records = db.attendance.filter(a => !req.query.date || a.date === date);

  let csv = 'Record ID,Date,Roll Number,Student Name,Class,Morning In-Time,Dispersal Out-Time,Status,AI Confidence,Verified By\n';
  records.forEach(r => {
    csv += `"${r.id}","${r.date}","${r.rollNumber || r.idNumber}","${r.studentName || r.userName}","${r.className || r.department}","${r.punchInTime || '-'}","${r.punchOutTime || '-'}","${r.status}","${r.confidence}%","${r.verifiedBy}"\n`;
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=school_attendance_${date}.csv`);
  res.send(csv);
});

// 8. Seed Realistic School Students & Records
app.post('/api/seed', (req, res) => {
  const schoolStudents = [
    {
      id: "stu_seed_1",
      name: "Aarav Sharma",
      rollNumber: "ROLL-101",
      idNumber: "ROLL-101",
      className: "Class 10-A",
      department: "Class 10-A",
      parentName: "Vikram Sharma",
      parentPhone: "+91 98765 43210",
      photoUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&h=200&fit=crop&crop=faces",
      descriptors: [],
      createdAt: new Date().toISOString()
    },
    {
      id: "stu_seed_2",
      name: "Sophia Chen",
      rollNumber: "ROLL-102",
      idNumber: "ROLL-102",
      className: "Class 10-A",
      parentName: "David Chen",
      parentPhone: "+91 98765 43211",
      photoUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop&crop=faces",
      descriptors: [],
      createdAt: new Date().toISOString()
    },
    {
      id: "stu_seed_3",
      name: "Liam Patel",
      rollNumber: "ROLL-103",
      idNumber: "ROLL-103",
      className: "Class 9-B",
      parentName: "Meera Patel",
      parentPhone: "+91 98765 43212",
      photoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=faces",
      descriptors: [],
      createdAt: new Date().toISOString()
    },
    {
      id: "stu_seed_4",
      name: "Maya Johnson",
      rollNumber: "ROLL-104",
      idNumber: "ROLL-104",
      className: "Class 9-B",
      parentName: "Robert Johnson",
      parentPhone: "+91 98765 43213",
      photoUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&h=200&fit=crop&crop=faces",
      descriptors: [],
      createdAt: new Date().toISOString()
    },
    {
      id: "stu_seed_5",
      name: "Rohan Verma",
      rollNumber: "ROLL-105",
      idNumber: "ROLL-105",
      className: "Class 11-Science",
      parentName: "Sanjay Verma",
      parentPhone: "+91 98765 43214",
      photoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=faces",
      descriptors: [],
      createdAt: new Date().toISOString()
    },
    {
      id: "stu_seed_6",
      name: "Emily Davis",
      rollNumber: "ROLL-106",
      idNumber: "ROLL-106",
      className: "Class 12-Commerce",
      parentName: "Sarah Davis",
      parentPhone: "+91 98765 43215",
      photoUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=faces",
      descriptors: [],
      createdAt: new Date().toISOString()
    }
  ];

  const today = getTodayString();
  const seedAttendance = [
    {
      id: "att_s1",
      studentId: "stu_seed_1",
      userId: "stu_seed_1",
      studentName: "Aarav Sharma",
      userName: "Aarav Sharma",
      rollNumber: "ROLL-101",
      idNumber: "ROLL-101",
      className: "Class 10-A",
      department: "Class 10-A",
      date: today,
      punchInTime: "07:52:10",
      punchOutTime: null,
      timestamp: new Date().toISOString(),
      status: "Present",
      confidence: "98.2",
      snapshotUrl: schoolStudents[0].photoUrl,
      verifiedBy: "AI School Gate Scanner",
      parentNotified: true
    },
    {
      id: "att_s2",
      studentId: "stu_seed_2",
      userId: "stu_seed_2",
      studentName: "Sophia Chen",
      userName: "Sophia Chen",
      rollNumber: "ROLL-102",
      idNumber: "ROLL-102",
      className: "Class 10-A",
      department: "Class 10-A",
      date: today,
      punchInTime: "07:58:45",
      punchOutTime: null,
      timestamp: new Date().toISOString(),
      status: "Present",
      confidence: "97.5",
      snapshotUrl: schoolStudents[1].photoUrl,
      verifiedBy: "AI School Gate Scanner",
      parentNotified: true
    },
    {
      id: "att_s3",
      studentId: "stu_seed_3",
      userId: "stu_seed_3",
      studentName: "Liam Patel",
      userName: "Liam Patel",
      rollNumber: "ROLL-103",
      idNumber: "ROLL-103",
      className: "Class 9-B",
      department: "Class 9-B",
      date: today,
      punchInTime: "08:18:22",
      punchOutTime: null,
      timestamp: new Date().toISOString(),
      status: "Late",
      confidence: "96.4",
      snapshotUrl: schoolStudents[2].photoUrl,
      verifiedBy: "AI School Gate Scanner",
      parentNotified: true
    },
    {
      id: "att_s4",
      studentId: "stu_seed_4",
      userId: "stu_seed_4",
      studentName: "Maya Johnson",
      userName: "Maya Johnson",
      rollNumber: "ROLL-104",
      idNumber: "ROLL-104",
      className: "Class 9-B",
      department: "Class 9-B",
      date: today,
      punchInTime: "07:45:00",
      punchOutTime: "14:32:15",
      timestamp: new Date().toISOString(),
      status: "Departed",
      confidence: "98.9",
      snapshotUrl: schoolStudents[3].photoUrl,
      verifiedBy: "AI School Gate Scanner",
      parentNotified: true
    }
  ];

  const db = readDb();
  schoolStudents.forEach(stu => {
    if (!db.students.some(s => s.rollNumber === stu.rollNumber)) {
      db.students.push(stu);
    }
  });

  seedAttendance.forEach(att => {
    if (!db.attendance.some(a => (a.rollNumber === att.rollNumber || a.idNumber === att.rollNumber) && a.date === today)) {
      db.attendance.push(att);
    }
  });

  writeDb(db);
  res.json({ success: true, message: 'Loaded 6 school student profiles across grades with attendance logs.' });
});

// Fallback SPA routing
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api') || req.path.startsWith('/models') || req.path.startsWith('/uploads')) {
    return next();
  }
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  next();
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🏫 VisionPass AI — School Attendance Server running at:`);
  console.log(`   👉 http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
