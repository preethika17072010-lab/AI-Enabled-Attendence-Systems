import React, { useState, useEffect, useRef } from 'react';
import { Camera, CameraOff, Upload, Trash2, UserPlus, Search, Phone, User, GraduationCap } from 'lucide-react';
import { aiEngine } from '../services/aiEngine';
import { api } from '../services/api';

export default function EnrollmentStudio({ onUsersUpdated, showToast }) {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([
    "Class 1-A", "Class 2-A", "Class 3-A", "Class 4-A",
    "Class 5-A", "Class 6-A", "Class 7-A", "Class 8-A",
    "Class 9-A", "Class 9-B", "Class 10-A", "Class 10-B",
    "Class 11-Science", "Class 11-Commerce",
    "Class 12-Science", "Class 12-Commerce"
  ]);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    rollNumber: '',
    className: 'Class 10-A',
    parentName: '',
    parentPhone: '',
    email: ''
  });

  // Captured Face Embeddings
  const [descriptors, setDescriptors] = useState([]);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [capturedAngles, setCapturedAngles] = useState({ front: false, left: false, right: false });
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [directorySearch, setDirectorySearch] = useState('');
  const [directoryClass, setDirectoryClass] = useState('All');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const activeStream = useRef(null);

  // Load Students
  const loadStudents = async () => {
    try {
      const res = await api.getUsers();
      if (res.success) {
        const list = res.students || res.users || [];
        setStudents(list);
        aiEngine.updateMatcher(list);
      }
    } catch (e) {
      console.warn('Could not load students:', e);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  // Start Enrollment Camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      activeStream.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsCameraActive(true);
      }
    } catch (err) {
      console.warn('Enrollment camera error:', err);
      setIsCameraActive(false);
      showToast('Could not access camera', 'warning');
    }
  };

  const stopCamera = () => {
    if (activeStream.current) {
      activeStream.current.getTracks().forEach(t => t.stop());
      activeStream.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  // Capture Live Student Face from Webcam
  const handleCaptureLive = async () => {
    if (!videoRef.current || !aiEngine.isReady()) {
      showToast('AI engine initializing or camera inactive', 'warning');
      return;
    }

    setIsCapturing(true);

    try {
      const detection = await aiEngine.detectSingle(videoRef.current);
      if (!detection) {
        showToast('No face clearly detected. Please look straight into the camera.', 'warning');
        setIsCapturing(false);
        return;
      }

      // Capture photo snapshot
      const snapCanvas = document.createElement('canvas');
      snapCanvas.width = 320;
      snapCanvas.height = 240;
      const sCtx = snapCanvas.getContext('2d');
      sCtx.translate(snapCanvas.width, 0);
      sCtx.scale(-1, 1);
      sCtx.drawImage(videoRef.current, 0, 0, snapCanvas.width, snapCanvas.height);
      const dataUrl = snapCanvas.toDataURL('image/jpeg', 0.9);

      const descArr = Array.from(detection.descriptor);
      setDescriptors(prev => [...prev, descArr]);
      setPhotoBase64(dataUrl);

      // Multi-angle step guidance
      if (!capturedAngles.front) {
        setCapturedAngles(prev => ({ ...prev, front: true }));
        showToast('Frontal photo captured! Optional: tilt head slightly left for higher accuracy.', 'info');
      } else if (!capturedAngles.left) {
        setCapturedAngles(prev => ({ ...prev, left: true }));
        showToast('Left angle captured! Optional: tilt head slightly right.', 'info');
      } else {
        setCapturedAngles(prev => ({ ...prev, right: true }));
        showToast('All 3 face angles calibrated successfully for this student!', 'success');
      }

    } catch (e) {
      console.error('Capture error:', e);
      showToast('Failed to extract face embedding', 'error');
    } finally {
      setIsCapturing(false);
    }
  };

  // Upload Student Photo File
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const img = new Image();
      img.onload = async () => {
        try {
          const result = await aiEngine.extractDescriptorFromImg(img);
          if (!result) {
            showToast('Could not detect a clear student face in this photo.', 'error');
            return;
          }

          setDescriptors([result.descriptor]);
          setPhotoBase64(reader.result);
          setCapturedAngles({ front: true, left: true, right: true });
          showToast('Student facial biometrics extracted from photo file!', 'success');
        } catch (err) {
          showToast('Error processing uploaded image', 'error');
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  // Submit Enrollment
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.rollNumber) {
      showToast('Student Name and Roll Number are required.', 'warning');
      return;
    }

    if (descriptors.length === 0) {
      showToast('Please capture or upload student face photo before saving.', 'warning');
      return;
    }

    try {
      const payload = {
        name: formData.name,
        rollNumber: formData.rollNumber,
        className: formData.className,
        parentName: formData.parentName,
        parentPhone: formData.parentPhone,
        email: formData.email,
        descriptors: descriptors,
        photoBase64: photoBase64
      };

      const res = await api.enrollUser(payload);
      if (res.success) {
        showToast(`Successfully enrolled student ${res.student?.name || res.user?.name}!`, 'success');
        // Reset form
        setFormData({
          name: '',
          rollNumber: '',
          className: 'Class 10-A',
          parentName: '',
          parentPhone: '',
          email: ''
        });
        setDescriptors([]);
        setPhotoBase64(null);
        setCapturedAngles({ front: false, left: false, right: false });

        await loadStudents();
        if (onUsersUpdated) onUsersUpdated();
      } else {
        showToast(res.message || 'Enrollment failed', 'error');
      }
    } catch (err) {
      showToast('Server error while saving student', 'error');
    }
  };

  // Delete Student Record
  const handleDeleteStudent = async (student) => {
    if (!window.confirm(`Delete record for student: ${student.name} (${student.rollNumber || student.idNumber})?`)) {
      return;
    }

    try {
      const res = await api.deleteUser(student.id);
      if (res.success) {
        showToast(`Deleted ${student.name}`, 'info');
        await loadStudents();
        if (onUsersUpdated) onUsersUpdated();
      }
    } catch (e) {
      showToast('Failed to delete student', 'error');
    }
  };

  // Filter Directory
  const filteredStudents = students.filter(s => {
    const sName = (s.name || '').toLowerCase();
    const sRoll = (s.rollNumber || s.idNumber || '').toLowerCase();
    const query = directorySearch.toLowerCase();
    const matchSearch = sName.includes(query) || sRoll.includes(query);
    const sClass = s.className || s.department;
    const matchClass = directoryClass === 'All' || sClass === directoryClass;
    return matchSearch && matchClass;
  });

  return (
    <div className="tab-pane">
      <div className="enroll-grid">
        
        {/* Left: Registration Form */}
        <div className="enroll-form-card">
          <div className="card-header">
            <h3>Student Admission & Biometrics</h3>
            <p className="card-subtitle">Register a school student and calibrate their face biometrics for gate attendance</p>
          </div>

          <form onSubmit={handleSubmit} className="form-body">
            <div className="form-row">
              <div className="form-group">
                <label>Student Full Name *</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Aarav Sharma" 
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Roll Number / Student ID *</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. ROLL-101 or 2026-A12" 
                  className="form-input"
                  value={formData.rollNumber}
                  onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Class & Section *</label>
                <select 
                  className="form-select"
                  value={formData.className}
                  onChange={(e) => setFormData({ ...formData, className: e.target.value })}
                >
                  {classes.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Parent / Guardian Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Vikram Sharma" 
                  className="form-input"
                  value={formData.parentName}
                  onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Parent Mobile (WhatsApp / SMS Alerts)</label>
                <input 
                  type="tel" 
                  placeholder="e.g. +91 98765 43210" 
                  className="form-input"
                  value={formData.parentPhone}
                  onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Student Email (Optional)</label>
                <input 
                  type="email" 
                  placeholder="e.g. aarav@school.edu" 
                  className="form-input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            {/* Biometrics Status Indicator */}
            <div className="biometric-status-box">
              <div className="bio-icon">
                {descriptors.length > 0 ? '🧬' : '⚠️'}
              </div>
              <div className="bio-text">
                <h4>
                  {descriptors.length > 0 
                    ? `Face Biometrics Ready (${descriptors.length} Embedding${descriptors.length > 1 ? 's' : ''})`
                    : 'Student Face Not Yet Captured'
                  }
                </h4>
                <p>
                  {descriptors.length > 0
                    ? '128-D facial vector generated. Ready for instant gate recognition.'
                    : 'Use the live camera panel on the right or upload a photo to calibrate biometrics.'
                  }
                </p>
              </div>
            </div>

            <div className="form-actions">
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={() => {
                  setFormData({ name: '', rollNumber: '', className: 'Class 10-A', parentName: '', parentPhone: '', email: '' });
                  setDescriptors([]);
                  setPhotoBase64(null);
                  setCapturedAngles({ front: false, left: false, right: false });
                }}
              >
                Clear Form
              </button>
              <button type="submit" className="btn btn-primary">
                <UserPlus size={18} />
                Save & Enroll Student
              </button>
            </div>
          </form>
        </div>

        {/* Right: Camera Face Capture Studio */}
        <div className="enroll-camera-card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3>Student Face Capture</h3>
              <p className="card-subtitle">Position student in front of camera to generate AI biometric descriptors</p>
            </div>
            <button 
              type="button" 
              className={`btn btn-sm ${isCameraActive ? 'btn-outline text-rose' : 'btn-accent'}`}
              onClick={() => isCameraActive ? stopCamera() : startCamera()}
              style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              {isCameraActive ? <><CameraOff size={14} /> Camera OFF</> : <><Camera size={14} /> Camera ON</>}
            </button>
          </div>

          <div className="enroll-camera-viewport">
            <video ref={videoRef} className="enroll-video" autoPlay playsInline muted />
            <canvas ref={canvasRef} className="enroll-canvas" />

            {/* Camera Off Placeholder */}
            {!isCameraActive && (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(3, 7, 18, 0.95)',
                zIndex: 15,
                padding: '1.5rem',
                textAlign: 'center'
              }}>
                <CameraOff size={38} className="text-muted" style={{ marginBottom: '0.75rem', opacity: 0.6 }} />
                <p className="text-muted text-sm" style={{ marginBottom: '1rem' }}>Webcam is paused</p>
                <button type="button" className="btn btn-sm btn-accent" onClick={startCamera}>
                  <Camera size={14} /> Turn Camera ON
                </button>
              </div>
            )}

            {isCameraActive && (
              <>
                <div className="face-guide-circle"></div>
                <div className="enroll-guide-badge">
                  {capturedAngles.front && !capturedAngles.left 
                    ? 'Optional: tilt head slightly LEFT' 
                    : capturedAngles.left && !capturedAngles.right 
                      ? 'Optional: tilt head slightly RIGHT' 
                      : 'Align student face in oval'}
                </div>
              </>
            )}
          </div>

          {/* Angles Check */}
          <div className="multi-capture-bar">
            <div className={`sample-slot ${capturedAngles.front ? 'filled' : 'empty'}`}>
              <div className="slot-label">Front View</div>
              <div className="slot-preview">{capturedAngles.front ? 'READY ✅' : '--'}</div>
            </div>
            <div className={`sample-slot ${capturedAngles.left ? 'filled' : 'empty'}`}>
              <div className="slot-label">Left View</div>
              <div className="slot-preview">{capturedAngles.left ? 'READY ✅' : '--'}</div>
            </div>
            <div className={`sample-slot ${capturedAngles.right ? 'filled' : 'empty'}`}>
              <div className="slot-label">Right View</div>
              <div className="slot-preview">{capturedAngles.right ? 'READY ✅' : '--'}</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="capture-actions">
            <button 
              type="button" 
              className="btn btn-accent" 
              onClick={handleCaptureLive}
              disabled={isCapturing}
            >
              <Camera size={18} />
              {isCapturing ? 'Analyzing Face...' : 'Capture Student Photo'}
            </button>
            
            <button 
              type="button" 
              className="btn btn-outline" 
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={16} />
              Upload Photo
            </button>
            <input 
              ref={fileInputRef} 
              type="file" 
              accept="image/*" 
              style={{ display: 'none' }} 
              onChange={handleFileUpload} 
            />
          </div>

          {photoBase64 && (
            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <img src={photoBase64} alt="Preview" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} />
              <span className="text-sm text-emerald">Biometrics ready for student registration</span>
            </div>
          )}

        </div>

      </div>

      {/* Enrolled Students Directory */}
      <div className="directory-card">
        <div className="directory-header">
          <div>
            <h3>Enrolled Students Directory</h3>
            <p className="card-subtitle">Biometric database of registered students ({filteredStudents.length} students)</p>
          </div>
          <div className="directory-search">
            <input 
              type="text" 
              placeholder="Search by student name or roll no..." 
              className="form-input"
              value={directorySearch}
              onChange={(e) => setDirectorySearch(e.target.value)}
            />
            <select 
              className="form-select"
              value={directoryClass}
              onChange={(e) => setDirectoryClass(e.target.value)}
            >
              <option value="All">All Classes</option>
              {classes.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Student Name</th>
                <th>Roll Number</th>
                <th>Class & Section</th>
                <th>Parent Contact</th>
                <th>Face Vectors</th>
                <th>Enrolled Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center text-muted">
                    No matching students found in school database.
                  </td>
                </tr>
              ) : (
                filteredStudents.map(student => (
                  <tr key={student.id}>
                    <td>
                      <img 
                        src={student.photoUrl || '/assets/default-avatar.svg'} 
                        className="table-avatar" 
                        alt="" 
                      />
                    </td>
                    <td><strong>{student.name}</strong></td>
                    <td><span className="result-id">{student.rollNumber || student.idNumber}</span></td>
                    <td><span className="status-badge present">{student.className || student.department}</span></td>
                    <td>
                      <span className="text-muted text-sm">
                        {student.parentPhone || student.parentName || '-'}
                      </span>
                    </td>
                    <td>
                      <span className="confidence-tag">
                        {student.descriptors?.length || 0} Vectors
                      </span>
                    </td>
                    <td><span className="text-muted text-sm">{student.createdAt ? student.createdAt.split('T')[0] : 'Today'}</span></td>
                    <td>
                      <button 
                        className="btn btn-sm btn-outline text-rose" 
                        onClick={() => handleDeleteStudent(student)}
                        title="Remove Student"
                      >
                        <Trash2 size={14} />
                      </button>
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
