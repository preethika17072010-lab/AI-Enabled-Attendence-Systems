# EduPass AI — School Biometric Attendance System (React.js + Express)

A real-time, privacy-first facial recognition attendance kiosk designed specifically for **Schools, Academies, and Educational Institutions**. Built with **React.js**, **Vite**, **Express**, and **TensorFlow.js / Face-API**.

---

## 🏫 Key Features for Schools

- **⚡ Ultra-Fast Gate Scanner (Kiosk Mode)**
  - **Zero-Lag WebGL Engine**: Throttled inference loop (100ms interval) running lightweight 224px neural network tensors for instant recognition (~200ms per student).
  - **Manual Entry & Dispersal Modes**:
    - 🔔 **Morning Entry (PUNCH IN)**: Marks students as *Present* or *Late Entry* based on school gate start time and grace period.
    - 🏠 **Dispersal / School Over (PUNCH OUT)**: Records student departure at the end of the school day.
    - ⏰ **Auto Schedule Mode**: Automatically switches from Morning Entry before 12:00 PM to Afternoon Dispersal after 12:00 PM.
  - **Calibrated Student Biometrics**: Optimized match threshold (0.56) for student age groups, glasses, and natural variations.
  - **Automated Alerts**: Simulates parent SMS / WhatsApp notification on student entry and dispersal.
  - **Auditory & Speech Greetings**: *"Good morning, Aarav! Attendance recorded."* with cheerful school bell chords.

- **📊 School Intelligence Dashboard**
  - Live KPI cards: Total Students, Present Today (with % attendance), Late Arrivals, and Absent / Not Arrived.
  - **Morning Gate Arrival Velocity**: Canvas bar chart tracking hourly arrival volumes (7:00 AM – 3:00 PM).
  - **Class-Wise Attendance Coverage**: Visual progress bars tracking presence across sections (Class 10-A, Class 9-B, Class 11-Science, etc.).

- **🎓 Student Admission & Biometrics Studio**
  - Register students with Full Name, Roll Number, Class & Section dropdown, and Parent Contact details.
  - **Fast Multi-Angle Face Capture** (Front View, Left View, Right View) from webcam or photo file upload.
  - Searchable student directory with instant search by name or roll number.

- **📋 Attendance & Timings Ledger**
  - Full history table displaying student roll numbers, classes, morning in-times, and dispersal out-times.
  - **Manual Time Override**: Teachers and gatekeepers can manually edit or adjust the exact In-Time and Out-Time for any student with reason notes.
  - **Export School CSV**: Download complete attendance sheets for administrative records.

- **⚙️ Manual School Schedule & Settings**
  - **School Start Time** (e.g. 08:00 AM).
  - **Late Grace Period** (e.g. 15 minutes — arrivals after 08:15 AM marked Late).
  - **Dispersal / School Over Time** (e.g. 02:30 PM).
  - Default Gate Mode selection (Manual IN, Manual OUT, or Scheduled Window).
  - One-click **Seed School Data** button to load sample student profiles across classes 9-12.

---

## 🚀 How to Run the School System

### 1. Launch the Server
In PowerShell, start the development environment:

```powershell
npm run dev
```

Or run the production build directly:
```powershell
npm start
```

### 2. Open in Browser
- Navigate to: **[http://localhost:3000](http://localhost:3000)** (or [http://localhost:5000](http://localhost:5000))
- Allow webcam permissions.
- In **Gate Scanner**, select **"Morning Entry (IN)"** or **"Dispersal Exit (OUT)"** using the prominent top buttons.
- To adjust school hours, navigate to **School Timings** in the top navigation bar.
- To manually edit a student's in/out timestamps, go to **Attendance & Timings** and click **Edit Timing**.

---

## 📁 Project Structure

```
├── server.js                        # Express REST API, model & uploads static server
├── data/
│   ├── database.json                # School JSON database (students, logs, timings)
│   └── uploads/                     # Student photo captures & gate verification snapshots
├── src/
│   ├── main.jsx                     # React entry point
│   ├── App.jsx                      # School navigation header, clock & toast controller
│   ├── index.css                    # Responsive dark theme & school kiosk HUD styling
│   ├── services/
│   │   ├── aiEngine.js              # Ultra-fast 224px student biometrics & WebGL inference
│   │   └── api.js                   # REST API client
│   └── components/
│       ├── ScannerKiosk.jsx         # Lag-free gate scanner with Manual In/Out switcher
│       ├── Dashboard.jsx            # Class-wise presence rates & hourly arrival chart
│       ├── EnrollmentStudio.jsx     # Student registration with roll numbers & parent contacts
│       ├── AttendanceLogs.jsx       # Attendance ledger with manual timing override modal
│       └── SystemSettings.jsx       # Manual school hours, grace period, and gate mode tuning
├── dist/                            # Production React build bundle (0 errors)
├── index.html                       # Root HTML template
├── vite.config.mjs                  # Clean Vite configuration
└── package.json
```
