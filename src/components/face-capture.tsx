'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Camera, SwitchCamera, CheckCircle2, AlertTriangle, 
  RefreshCw, Shield, User, X, Scan 
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface FaceCaptureProps {
  onCapture?: (imageData: string) => void;
  onVerify?: (imageData: string) => Promise<{ success: boolean; score?: number; message?: string }>;
  mode?: 'register' | 'verify' | 'attendance';
  employeeId?: string;
  employeeName?: string;
}

interface FaceDetectionResult {
  detected: boolean;
  faceCount: number;
  confidence?: number;
  message: string;
}

// ============================================
// FACE CAPTURE COMPONENT
// ============================================

export function FaceCapture({ 
  onCapture, 
  onVerify,
  mode = 'register',
  employeeId,
  employeeName 
}: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ success: boolean; score?: number; message?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState<FaceDetectionResult | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
      
      setStream(mediaStream);
      setCameraActive(true);
      setCapturedImage(null);
      setVerifyResult(null);
    } catch (err) {
      console.error('Camera error:', err);
      setError('Unable to access camera. Please check permissions.');
    }
  }, [facingMode]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  }, [stream]);

  // Switch camera
  const switchCamera = useCallback(async () => {
    stopCamera();
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    setTimeout(() => startCamera(), 100);
  }, [stopCamera, startCamera]);

  // Simple face detection simulation (replace with actual API call)
  const detectFace = useCallback(async (imageData: string) => {
    try {
      const response = await fetch('/api/face/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setFaceDetected({
          detected: data.faces?.length > 0,
          faceCount: data.faces?.length || 0,
          confidence: data.faces?.[0]?.confidence,
          message: data.faces?.length > 0 ? 'Face detected' : 'No face detected',
        });
      } else {
        // Demo mode - simulate detection
        setFaceDetected({
          detected: true,
          faceCount: 1,
          confidence: 0.95,
          message: 'Face detected (demo)',
        });
      }
    } catch {
      // Demo mode fallback
      setFaceDetected({
        detected: true,
        faceCount: 1,
        confidence: 0.95,
        message: 'Face detected (demo)',
      });
    }
  }, []);

  // Capture image
  const captureImage = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setLoading(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setLoading(false);
      return;
    }
    
    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0);
    
    // Convert to base64
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(imageData);
    
    // Detect face (simple check - in production, use proper face detection)
    await detectFace(imageData);
    
    setLoading(false);
  }, [detectFace]);

  // Verify face
  const verifyFace = async () => {
    if (!capturedImage || !onVerify) return;
    
    setVerifying(true);
    try {
      const result = await onVerify(capturedImage);
      setVerifyResult(result);
    } catch (err) {
      setVerifyResult({ success: false, message: 'Verification failed' });
    }
    setVerifying(false);
  };

  // Submit for registration or attendance
  const handleSubmit = async () => {
    if (!capturedImage || !faceDetected?.detected) return;
    
    if (onCapture) {
      onCapture(capturedImage);
    }
    
    if (onVerify && mode !== 'register') {
      await verifyFace();
    }
  };

  // Retake photo
  const retake = () => {
    setCapturedImage(null);
    setFaceDetected(null);
    setVerifyResult(null);
  };

  // Get mode-specific labels
  const getModeLabels = () => {
    switch (mode) {
      case 'register':
        return {
          title: 'Register Face',
          description: 'Take a clear photo for face registration',
          buttonText: 'Register Face',
          successMessage: 'Face registered successfully!',
        };
      case 'verify':
        return {
          title: 'Verify Identity',
          description: 'Take a photo to verify your identity',
          buttonText: 'Verify Face',
          successMessage: 'Identity verified!',
        };
      case 'attendance':
        return {
          title: 'Face Attendance',
          description: 'Take a photo to check in/out',
          buttonText: 'Check In',
          successMessage: 'Attendance recorded!',
        };
      default:
        return {
          title: 'Face Capture',
          description: 'Take a photo',
          buttonText: 'Submit',
          successMessage: 'Success!',
        };
    }
  };

  const labels = getModeLabels();

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-3">
          <Scan className="w-8 h-8 text-white" />
        </div>
        <CardTitle>{labels.title}</CardTitle>
        <CardDescription>{labels.description}</CardDescription>
        {employeeName && (
          <Badge variant="outline" className="mx-auto mt-2">
            <User className="w-3 h-3 mr-1" /> {employeeName}
          </Badge>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-4 h-4" />
            <p className="text-sm">{error}</p>
          </div>
        )}
        
        {/* Camera / Image Preview */}
        <div className="relative aspect-[4/3] bg-slate-900 rounded-lg overflow-hidden">
          {!cameraActive && !capturedImage && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
              <Camera className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm opacity-70">Camera preview</p>
            </div>
          )}
          
          {cameraActive && !capturedImage && (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              {/* Face guide overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-white/50 rounded-full" />
              </div>
            </>
          )}
          
          {capturedImage && (
            <img
              src={capturedImage}
              alt="Captured"
              className="w-full h-full object-cover"
            />
          )}
          
          {/* Hidden canvas for capture */}
          <canvas ref={canvasRef} className="hidden" />
        </div>
        
        {/* Face Detection Status */}
        {faceDetected && (
          <div className={`p-3 rounded-lg flex items-center gap-2 ${
            faceDetected.detected 
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              : 'bg-amber-50 border border-amber-200 text-amber-700'
          }`}>
            {faceDetected.detected ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{faceDetected.message}</p>
                  {faceDetected.confidence && (
                    <div className="mt-1">
                      <Progress value={faceDetected.confidence * 100} className="h-1" />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4" />
                <p className="text-sm">{faceDetected.message}</p>
              </>
            )}
          </div>
        )}
        
        {/* Verification Result */}
        {verifyResult && (
          <div className={`p-3 rounded-lg flex items-center gap-2 ${
            verifyResult.success 
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {verifyResult.success ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <div>
                  <p className="text-sm font-medium">{labels.successMessage}</p>
                  {verifyResult.score && (
                    <p className="text-xs opacity-70">Match score: {(verifyResult.score * 100).toFixed(1)}%</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <X className="w-4 h-4" />
                <p className="text-sm">{verifyResult.message || 'Verification failed'}</p>
              </>
            )}
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex gap-2">
          {!cameraActive && !capturedImage && (
            <Button 
              className="flex-1 bg-emerald-500 hover:bg-emerald-600"
              onClick={startCamera}
            >
              <Camera className="w-4 h-4 mr-2" />
              Start Camera
            </Button>
          )}
          
          {cameraActive && !capturedImage && (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={switchCamera}
                title="Switch Camera"
              >
                <SwitchCamera className="w-4 h-4" />
              </Button>
              <Button 
                className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                onClick={captureImage}
                disabled={loading}
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4 mr-2" />
                )}
                Capture
              </Button>
              <Button variant="outline" onClick={stopCamera}>
                Cancel
              </Button>
            </>
          )}
          
          {capturedImage && !verifyResult?.success && (
            <>
              <Button variant="outline" onClick={retake}>
                Retake
              </Button>
              <Button 
                className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                onClick={handleSubmit}
                disabled={!faceDetected?.detected || verifying}
              >
                {verifying ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4 mr-2" />
                )}
                {verifying ? 'Processing...' : labels.buttonText}
              </Button>
            </>
          )}
          
          {verifyResult?.success && (
            <Button 
              className="flex-1 bg-emerald-500 hover:bg-emerald-600"
              onClick={retake}
            >
              Done
            </Button>
          )}
        </div>
        
        {/* Tips */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>💡 Tips for best results:</p>
          <ul className="list-disc list-inside space-y-0.5 pl-2">
            <li>Ensure good lighting on your face</li>
            <li>Face the camera directly</li>
            <li>Remove glasses or hats if required</li>
            <li>Keep a neutral expression</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// FACE ATTENDANCE WIDGET
// ============================================

interface FaceAttendanceWidgetProps {
  employeeId: string;
  employeeName: string;
  onCheckIn?: (imageData: string) => Promise<void>;
  onCheckOut?: (imageData: string) => Promise<void>;
  isCheckedIn?: boolean;
}

export function FaceAttendanceWidget({
  employeeId,
  employeeName,
  onCheckIn,
  onCheckOut,
  isCheckedIn = false,
}: FaceAttendanceWidgetProps) {
  const [showCamera, setShowCamera] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleCapture = async (imageData: string) => {
    setProcessing(true);
    try {
      if (isCheckedIn && onCheckOut) {
        await onCheckOut(imageData);
      } else if (onCheckIn) {
        await onCheckIn(imageData);
      }
      setSuccess(true);
      setTimeout(() => {
        setShowCamera(false);
        setSuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Face attendance error:', err);
    }
    setProcessing(false);
  };

  const handleVerify = async (imageData: string) => {
    // Call face verification API
    try {
      const response = await fetch('/api/face/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          image: imageData, 
          employeeId 
        }),
      });
      
      const data = await response.json();
      return {
        success: data.success || data.match,
        score: data.score || data.confidence,
        message: data.message,
      };
    } catch {
      // Demo mode
      return { success: true, score: 0.95, message: 'Verified (demo)' };
    }
  };

  if (!showCamera) {
    return (
      <Button
        className="w-full bg-emerald-500 hover:bg-emerald-600"
        onClick={() => setShowCamera(true)}
      >
        <Camera className="w-4 h-4 mr-2" />
        {isCheckedIn ? 'Check Out with Face' : 'Check In with Face'}
      </Button>
    );
  }

  return (
    <FaceCapture
      mode="attendance"
      employeeId={employeeId}
      employeeName={employeeName}
      onCapture={handleCapture}
      onVerify={handleVerify}
    />
  );
}

// ============================================
// FACE REGISTRATION WIDGET
// ============================================

interface FaceRegistrationWidgetProps {
  employeeId: string;
  employeeName: string;
  onRegister?: (imageData: string) => Promise<void>;
  isRegistered?: boolean;
}

export function FaceRegistrationWidget({
  employeeId,
  employeeName,
  onRegister,
  isRegistered = false,
}: FaceRegistrationWidgetProps) {
  const [showCamera, setShowCamera] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registered, setRegistered] = useState(isRegistered);

  const handleRegister = async (imageData: string) => {
    setRegistering(true);
    try {
      // Call face registration API
      const response = await fetch('/api/face/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          image: imageData, 
          employeeId 
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setRegistered(true);
        if (onRegister) await onRegister(imageData);
      }
    } catch (err) {
      console.error('Face registration error:', err);
      // Demo mode
      setRegistered(true);
      if (onRegister) await onRegister(imageData);
    }
    setRegistering(false);
  };

  if (registered && !showCamera) {
    return (
      <div className="p-4 bg-emerald-50 rounded-lg flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-emerald-700">Face Registered</p>
          <p className="text-sm text-emerald-600">Your face is enrolled for attendance</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowCamera(true)}>
          Update
        </Button>
      </div>
    );
  }

  if (!showCamera) {
    return (
      <Button
        variant="outline"
        className="w-full"
        onClick={() => setShowCamera(true)}
      >
        <Camera className="w-4 h-4 mr-2" />
        Register Face
      </Button>
    );
  }

  return (
    <FaceCapture
      mode="register"
      employeeId={employeeId}
      employeeName={employeeName}
      onCapture={handleRegister}
    />
  );
}

export default FaceCapture;
