import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, CameraOff, Volume2, VolumeX, Sparkles, CheckCircle2, Clock, AlertTriangle, ShieldCheck, Sun, Moon, Calendar } from 'lucide-react';
import confetti from 'canvas-confetti';
import { aiEngine } from '../services/aiEngine';
import { api } from '../services/api';

export default function ScannerKiosk({ settings, onAttendanceMarked, showToast }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');

  // Gate Mode: 'in' (Morning Entry) | 'out' (Afternoon Dispersal) | 'scheduled' (Auto based on time)
  const [gateMode, setGateMode] = useState('in');
  const [fps, setFps] = useState('0.0');
  const [statusMessage, setStatusMessage] = useState('Position your face in front of the gate scanner');
  const [statusType, setStatusType] = useState('idle'); // 'idle' | 'success' | 'warning' | 'danger'
  
  // Last Verified Student Card
  const [lastMatch, setLastMatch] = useState(null);
  // Sidebar Activity Stream
  const [streamItems, setStreamItems] = useState([]);

  // Local cooldown memory to prevent rapid double-punches: studentId -> timestamp
  const localCooldowns = useRef(new Map());
  const matchStreak = useRef({ studentId: null, count: 0 });
  
  // High-performance inference throttle refs (PREVENTS ALL LAG)
  const animFrameId = useRef(null);
  const isDetecting = useRef(false);
  const lastInferenceTime = useRef(0);
  const frameCount = useRef(0);
  const lastFpsTime = useRef(performance.now());
  const activeStream = useRef(null);

  // Load today's activity stream
  const fetchTodayStream = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await api.getAttendance({ date: today });
      if (data.success) {
        setStreamItems(data.attendance.slice(0, 15));
      }
    } catch (e) {
      console.warn('Could not load today stream:', e);
    }
  }, []);

  useEffect(() => {
    fetchTodayStream();
  }, [fetchTodayStream]);

  // Determine current active punch type based on gate mode & school timings
  const getActivePunchType = useCallback(() => {
    if (gateMode === 'in') return 'IN';
    if (gateMode === 'out') return 'OUT';
    // Scheduled mode: Morning before 12:00 PM is Entry; Afternoon 12:00 PM onwards is Dispersal
    const hour = new Date().getHours();
    return hour < 12 ? 'IN' : 'OUT';
  }, [gateMode]);

  // Populate Camera list
  const populateCameras = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      setCameras(videoDevices);
      if (videoDevices.length > 0 && !selectedCamera) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
    } catch (e) {
      console.warn('Camera enumeration error:', e);
    }
  };

  // Start Camera
  const startCamera = async (deviceId = null) => {
    if (activeStream.current) {
      activeStream.current.getTracks().forEach(t => t.stop());
    }

    try {
      const constraints = {
        video: deviceId 
          ? { deviceId: { exact: deviceId } } 
          : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      activeStream.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          if (canvasRef.current) {
            canvasRef.current.width = videoRef.current.videoWidth || 640;
            canvasRef.current.height = videoRef.current.videoHeight || 480;
          }
          setIsCameraActive(true);
        };
      }
      populateCameras();
    } catch (err) {
      console.error('Webcam error:', err);
      showToast('Could not access camera. Please allow camera permissions.', 'error');
      setStatusMessage('Camera Access Denied');
      setStatusType('danger');
      setIsCameraActive(false);
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    if (activeStream.current) {
      activeStream.current.getTracks().forEach(t => t.stop());
      activeStream.current = null;
    }
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setIsCameraActive(false);
    setStatusMessage('Camera Off');
    setStatusType('idle');
  };

  // Confetti burst
  const triggerConfetti = () => {
    confetti({
      particleCount: 50,
      spread: 70,
      origin: { y: 0.65 },
      colors: ['#38bdf8', '#10b981', '#fbbf24']
    });
  };

  // Capture student snapshot frame
  const captureSnapshot = () => {
    if (!videoRef.current) return null;
    try {
      const snapCanvas = document.createElement('canvas');
      snapCanvas.width = 240;
      snapCanvas.height = 180;
      const sCtx = snapCanvas.getContext('2d');
      sCtx.translate(snapCanvas.width, 0);
      sCtx.scale(-1, 1);
      sCtx.drawImage(videoRef.current, 0, 0, snapCanvas.width, snapCanvas.height);
      return snapCanvas.toDataURL('image/jpeg', 0.85);
    } catch (e) {
      return null;
    }
  };

  // Submit student punch to server
  const executePunch = async (student, confidence) => {
    const snapshotBase64 = captureSnapshot();
    const effectiveMode = getActivePunchType().toLowerCase();

    try {
      const res = await api.submitPunch({
        userId: student.id,
        confidence: confidence,
        snapshotBase64: snapshotBase64,
        mode: effectiveMode
      });

      if (res.success) {
        localCooldowns.current.set(student.id, Date.now());

        if (settings?.soundEffects) {
          aiEngine.playSound(res.punchType === 'OUT' ? 'punch-out' : 'success');
        }
        if (settings?.voiceGreetings) {
          const greeting = res.punchType === 'IN' 
            ? `Good morning, ${student.name}! Attendance recorded.` 
            : `Goodbye, ${student.name}! Have a safe journey home.`;
          aiEngine.speak(greeting);
        }

        triggerConfetti();

        // Update big result card
        setLastMatch({
          student: res.student || res.user,
          record: res.record,
          punchType: res.punchType,
          confidence: confidence,
          time: res.record.punchInTime || res.record.punchOutTime
        });

        // Prepend to today's activity stream
        setStreamItems(prev => [res.record, ...prev.slice(0, 14)]);

        showToast(res.message, 'success');
        if (onAttendanceMarked) onAttendanceMarked();

      } else if (res.cooldown) {
        setStatusMessage(`Already marked today (${student.name})`);
        setStatusType('warning');
      }
    } catch (err) {
      console.error('Punch failed:', err);
      showToast('Error recording attendance to server', 'error');
    }
  };

  // Ultra-Fast Non-Blocking Inference Loop (Zero Lag)
  useEffect(() => {
    if (!isCameraActive) return;

    let isMounted = true;
    const INFERENCE_INTERVAL_MS = 100; // ~10 inferences/sec ensures 60 FPS video without UI lag

    const processLoop = async () => {
      if (!isMounted || !videoRef.current || videoRef.current.paused || videoRef.current.ended) {
        return;
      }

      // Calculate real FPS
      frameCount.current++;
      const now = performance.now();
      if (now - lastFpsTime.current >= 1000) {
        setFps(((frameCount.current * 1000) / (now - lastFpsTime.current)).toFixed(1));
        frameCount.current = 0;
        lastFpsTime.current = now;
      }

      // Throttle AI inference to avoid CPU/GPU queue exhaustion
      if (aiEngine.isReady() && !isDetecting.current && (now - lastInferenceTime.current >= INFERENCE_INTERVAL_MS)) {
        isDetecting.current = true;
        lastInferenceTime.current = now;

        try {
          const detection = await aiEngine.detectSingle(videoRef.current);
          const canvas = canvasRef.current;

          if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (detection) {
              const { box } = detection.detection;
              const landmarks = detection.landmarks;
              const descriptor = detection.descriptor;

              // Match Student Biometrics
              const matchResult = aiEngine.matchFace(descriptor);
              const isMatched = matchResult.student !== null;

              // Draw Glowing Student Box
              const color = isMatched ? '#10b981' : (matchResult.confidence > 35 ? '#f59e0b' : '#f43f5e');

              ctx.save();
              const { x, y, width: w, height: h } = box;
              const len = Math.min(24, w * 0.2);

              ctx.strokeStyle = color;
              ctx.lineWidth = 3;
              ctx.lineCap = 'round';

              // HUD Viewfinder Brackets
              ctx.beginPath();
              ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y);
              ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len);
              ctx.moveTo(x, y + h - len); ctx.lineTo(x, y + h); ctx.lineTo(x + len, y + h);
              ctx.moveTo(x + w - len, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - len);
              ctx.stroke();

              // Subtle Facial Landmark Dots
              if (landmarks) {
                ctx.fillStyle = 'rgba(56, 189, 248, 0.7)';
                for (let i = 0; i < landmarks.positions.length; i += 4) {
                  const pt = landmarks.positions[i];
                  ctx.beginPath();
                  ctx.arc(pt.x, pt.y, 1.5, 0, 2 * Math.PI);
                  ctx.fill();
                }
              }
              ctx.restore();

              // Immediate Verification Logic (Fast 1-2 frame response)
              if (!isMatched) {
                setStatusMessage('Unregistered Face — Please enroll in Enrollment Studio');
                setStatusType('danger');
                matchStreak.current = { studentId: null, count: 0 };
              } else {
                const student = matchResult.student;
                const activeMode = getActivePunchType();
                setStatusMessage(`Verified: ${student.name} (${student.className || 'Student'}) — ${matchResult.confidence}%`);
                setStatusType('success');

                if (matchStreak.current.studentId === student.id) {
                  matchStreak.current.count++;
                } else {
                  matchStreak.current = { studentId: student.id, count: 1 };
                }

                // Verify on 2 fast frames (~200ms verification)
                if (matchStreak.current.count >= 2) {
                  const lastPunch = localCooldowns.current.get(student.id) || 0;
                  const cooldownMs = (settings?.cooldownMinutes || 1) * 60 * 1000;

                  if (now - lastPunch > cooldownMs) {
                    matchStreak.current = { studentId: null, count: 0 };
                    executePunch(student, matchResult.confidence);
                  }
                }
              }

            } else {
              // No face in sight
              setStatusMessage('Scanning school gate for students...');
              setStatusType('idle');
              matchStreak.current = { studentId: null, count: 0 };
            }
          }
        } catch (e) {
          console.warn('Inference frame glitch:', e);
        } finally {
          isDetecting.current = false;
        }
      }

      if (isMounted) {
        animFrameId.current = requestAnimationFrame(processLoop);
      }
    };

    animFrameId.current = requestAnimationFrame(processLoop);

    return () => {
      isMounted = false;
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [isCameraActive, settings, gateMode, getActivePunchType]);

  // Start Camera on load
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const currentPunchType = getActivePunchType();

  return (
    <div className="tab-pane">
      <div className="kiosk-grid">
        
        {/* Main Camera Viewport Card */}
        <div className="scanner-card">
          <div className="scanner-header">
            <div>
              <span className="live-indicator">
                <span className="blink-dot"></span> SCHOOL GATE SCANNER
              </span>
              <p className="card-subtitle">
                {currentPunchType === 'IN' 
                  ? '🔔 MORNING ENTRY MODE — Students walk in front of camera to mark Present' 
                  : '🏠 AFTERNOON DISPERSAL MODE — Students scan to mark School Exit'}
              </p>
            </div>

            {/* Gate Controls: Camera ON/OFF & Mode Switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button 
                className={`btn btn-sm ${isCameraActive ? 'btn-outline text-rose' : 'btn-accent'}`}
                onClick={() => {
                  if (isCameraActive) {
                    stopCamera();
                    showToast('Gate Camera turned OFF', 'info');
                  } else {
                    startCamera(selectedCamera);
                    showToast('Gate Camera turned ON', 'success');
                  }
                }}
                style={{ fontWeight: 700 }}
              >
                {isCameraActive ? (
                  <>
                    <CameraOff size={15} /> Turn Camera OFF
                  </>
                ) : (
                  <>
                    <Camera size={15} /> Turn Camera ON
                  </>
                )}
              </button>

              <div className="mode-switch-group">
                <button 
                  className={`mode-btn ${gateMode === 'in' ? 'active' : ''}`}
                  onClick={() => { setGateMode('in'); showToast('Gate Mode set to: MORNING ENTRY (IN)', 'info'); }}
                >
                  <Sun size={14} className="text-emerald" /> Morning Entry (IN)
                </button>
                <button 
                  className={`mode-btn ${gateMode === 'out' ? 'active' : ''}`}
                  onClick={() => { setGateMode('out'); showToast('Gate Mode set to: DISPERSAL (OUT)', 'info'); }}
                >
                  <Moon size={14} className="text-blue" /> Dispersal Exit (OUT)
                </button>
                <button 
                  className={`mode-btn ${gateMode === 'scheduled' ? 'active' : ''}`}
                  onClick={() => { setGateMode('scheduled'); showToast('Gate Mode set to: AUTO SCHEDULE (In < 12PM, Out >= 12PM)', 'info'); }}
                >
                  <Calendar size={14} /> Auto Window
                </button>
              </div>
            </div>
          </div>

          {/* Viewport Box */}
          <div className="viewport-wrapper">
            <video ref={videoRef} className="webcam-video" autoPlay playsInline muted />
            <canvas ref={canvasRef} className="detection-canvas" />

            {/* Camera OFF Overlay */}
            {!isCameraActive && (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(3, 7, 18, 0.96)',
                zIndex: 25,
                padding: '2rem',
                textAlign: 'center'
              }}>
                <div style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: 'rgba(244, 63, 94, 0.1)',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1rem'
                }}>
                  <CameraOff size={36} className="text-rose" />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.4rem', color: '#fff' }}>
                  Camera is Turned OFF
                </h3>
                <p className="text-muted text-sm" style={{ maxWidth: 360, marginBottom: '1.5rem', lineHeight: 1.5 }}>
                  The school gate scanner video feed is currently stopped. Turn on the camera when students arrive.
                </p>
                <button 
                  className="btn btn-accent" 
                  onClick={() => startCamera(selectedCamera)}
                  style={{ padding: '0.75rem 1.75rem', fontSize: '0.92rem', fontWeight: 700 }}
                >
                  <Camera size={18} /> Turn Camera ON
                </button>
              </div>
            )}

            {/* AI HUD Overlay */}
            {isCameraActive && (
              <div className="hud-overlay">
                <div className="hud-corner top-left"></div>
                <div className="hud-corner top-right"></div>
                <div className="hud-corner bottom-left"></div>
                <div className="hud-corner bottom-right"></div>
                <div className="hud-scanline"></div>
              </div>
            )}

            {/* Viewport Status Pill */}
            <div className="viewport-badge">
              <span>{statusType === 'success' ? '✅' : statusType === 'danger' ? '⛔' : statusType === 'warning' ? '⚠️' : '🔍'}</span>
              <span>{statusMessage}</span>
            </div>

            {/* Current Active Mode Badge */}
            <div style={{ position: 'absolute', bottom: 20, left: 20, background: 'rgba(15, 23, 42, 0.9)', padding: '0.4rem 0.85rem', borderRadius: 8, border: '1px solid rgba(56, 189, 248, 0.3)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className={`status-badge ${currentPunchType === 'IN' ? 'present' : 'out'}`}>
                {currentPunchType === 'IN' ? 'PUNCH IN (ENTRY)' : 'PUNCH OUT (EXIT)'}
              </span>
              <span className="text-muted text-sm">Gate Active</span>
            </div>

            {/* Controls */}
            <div className="viewport-controls">
              <button 
                className="icon-control-btn" 
                onClick={() => isCameraActive ? stopCamera() : startCamera(selectedCamera)}
                title="Toggle Camera"
              >
                <Camera size={18} />
              </button>
              {cameras.length > 1 && (
                <select 
                  className="source-select"
                  value={selectedCamera}
                  onChange={(e) => {
                    setSelectedCamera(e.target.value);
                    startCamera(e.target.value);
                  }}
                >
                  {cameras.map((cam, idx) => (
                    <option key={cam.deviceId || idx} value={cam.deviceId}>
                      {cam.label || `Gate Camera ${idx + 1}`}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Telemetry Footer */}
          <div className="scanner-telemetry">
            <div className="telemetry-item">
              <span className="t-label">Gate Engine</span>
              <span className="t-val">WebGL FastNet (224)</span>
            </div>
            <div className="telemetry-item">
              <span className="t-label">Frame Rate</span>
              <span className="t-val text-emerald">{fps} FPS</span>
            </div>
            <div className="telemetry-item">
              <span className="t-label">Camera Status</span>
              <span className={`t-val ${isCameraActive ? 'text-emerald' : 'text-rose'}`}>
                {isCameraActive ? 'Online & Streaming' : 'Stopped'}
              </span>
            </div>
            <div className="telemetry-item">
              <span className="t-label">Mode</span>
              <span className="t-val text-emerald">
                {currentPunchType === 'IN' ? 'Morning Entry' : 'Dispersal Exit'}
              </span>
            </div>
          </div>

        </div>

        {/* Sidebar: Student Result & Activity Stream */}
        <div className="kiosk-sidebar">
          
          {/* Dynamic Student Verification Card */}
          <div className={`result-card ${lastMatch ? 'success' : 'idle'}`}>
            <div className="card-title-sm">Current Student Match</div>
            {lastMatch ? (
              <div className="result-body">
                <div className="result-avatar-wrap">
                  <img src={lastMatch.record.snapshotUrl || lastMatch.student.photoUrl || '/assets/default-avatar.svg'} alt="" />
                  <div className="result-stamp" style={{
                    background: lastMatch.punchType === 'IN' 
                      ? (lastMatch.record.status === 'Late' ? 'var(--accent-amber)' : 'var(--accent-emerald)')
                      : 'var(--accent-blue)'
                  }}>
                    {lastMatch.punchType === 'IN' ? lastMatch.record.status : 'DISPERSED'}
                  </div>
                </div>
                <div className="result-details">
                  <h3>{lastMatch.student.name}</h3>
                  <p className="result-id">{lastMatch.student.rollNumber || lastMatch.student.idNumber}</p>
                  <p className="result-dept">{lastMatch.student.className || lastMatch.student.department}</p>
                  <div className="result-meta">
                    <span className="confidence-tag">Match: {lastMatch.confidence}%</span>
                    <span className="time-tag">{lastMatch.time}</span>
                  </div>
                  <div style={{ marginTop: '0.45rem', fontSize: '0.7rem', color: '#10b981' }}>
                    📱 Parent Alert Sent ({lastMatch.student.parentPhone || 'SMS/WhatsApp'})
                  </div>
                </div>
              </div>
            ) : (
              <div className="result-body">
                <div className="result-avatar-wrap">
                  <img src="/assets/default-avatar.svg" alt="" />
                  <div className="result-stamp">READY</div>
                </div>
                <div className="result-details">
                  <h3>Awaiting Student</h3>
                  <p className="result-id">Step in front of gate camera</p>
                  <p className="result-dept">Recognition in ~200ms</p>
                  <div className="result-meta">
                    <span className="confidence-tag">Confidence: --%</span>
                    <span className="time-tag">--:--:--</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Today's Stream Card */}
          <div className="stream-card">
            <div className="stream-header">
              <h3>Today's Gate Punches</h3>
              <span className="badge-count">{streamItems.length}</span>
            </div>
            <div className="stream-list">
              {streamItems.length === 0 ? (
                <div className="empty-state-sm">No student punches recorded today yet</div>
              ) : (
                streamItems.map((item) => (
                  <div key={item.id} className="stream-item">
                    <img 
                      src={item.snapshotUrl || '/assets/default-avatar.svg'} 
                      className="stream-thumb" 
                      alt="" 
                    />
                    <div className="stream-info">
                      <div className="stream-name">{item.studentName || item.userName}</div>
                      <div className="stream-meta">
                        <span>{item.rollNumber || item.idNumber}</span>
                        <span>•</span>
                        <span>{item.className || item.department}</span>
                        <span>•</span>
                        <span>{item.punchInTime || item.punchOutTime}</span>
                      </div>
                    </div>
                    <span className={`status-badge ${item.punchOutTime && !item.punchInTime ? 'out' : (item.status === 'Late' ? 'late' : 'present')}`}>
                      {item.punchOutTime && !item.punchInTime ? 'EXIT' : item.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
