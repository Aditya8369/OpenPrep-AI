import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Camera,
  Crop,
  Check,
  RotateCcw,
  Sparkles,
  AlertCircle,
  FileImage,
  VideoOff,
  Layers,
} from 'lucide-react';

const SUBJECT_OPTIONS = [
  'General STEM',
  'Mathematics & Calculus',
  'Classical & Modern Physics',
  'Organic & Physical Chemistry',
  'Electrical & Electronic Circuits',
  'Mechanical & Structural Engineering',
];

export default function ProblemImageCapture({ onCaptureComplete, isProcessing = false }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [subjectHint, setSubjectHint] = useState('General STEM');
  const [validationError, setValidationError] = useState('');
  const [cropBox, setCropBox] = useState({ x: 50, y: 50, w: 300, h: 200 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState(null); // 'move' | 'tl' | 'tr' | 'bl' | 'br'
  const [dragStart, setDragStart] = useState({ mouseX: 0, mouseY: 0, boxX: 0, boxY: 0, boxW: 0, boxH: 0 });

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const imageObjRef = useRef(new Image());

  // Stop camera when unmounting
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    stopCamera();
    setValidationError('');
    setCameraError('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
      setImageSrc(null);
    } catch (err) {
      setCameraError(err.message || 'Unable to access webcam. Please check device permissions.');
      setIsCameraActive(false);
    }
  };

  const captureCameraSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = video.videoWidth || 640;
    snapCanvas.height = video.videoHeight || 480;
    const ctx = snapCanvas.getContext('2d');
    ctx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);
    const dataUrl = snapCanvas.toDataURL('image/jpeg', 0.95);
    setImageSrc(dataUrl);
    stopCamera();
  };

  const handleFile = (file) => {
    setValidationError('');
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setValidationError('Please upload a valid image (JPEG, PNG, or WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setValidationError('Image size exceeds 5MB limit. Please choose a smaller image.');
      return;
    }

    stopCamera();
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageSrc(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // Image load into canvas
  useEffect(() => {
    if (!imageSrc) return;
    const img = imageObjRef.current;
    img.src = imageSrc;
    img.onload = () => {
      const initialW = Math.min(img.width * 0.85, 450);
      const initialH = Math.min(img.height * 0.85, 300);
      const initialX = Math.max(10, (img.width - initialW) / 2);
      const initialY = Math.max(10, (img.height - initialH) / 2);

      setCropBox({
        x: Math.round(initialX),
        y: Math.round(initialY),
        w: Math.round(initialW),
        h: Math.round(initialH),
      });
      drawPreview();
    };
  }, [imageSrc]);

  useEffect(() => {
    if (imageSrc) {
      drawPreview();
    }
  }, [cropBox, imageSrc]);

  const drawPreview = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = imageObjRef.current;
    if (!img.width || !img.height) return;

    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');

    // Draw main image
    ctx.drawImage(img, 0, 0);

    // Dim area outside crop box
    ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Clear inside crop box
    ctx.clearRect(cropBox.x, cropBox.y, cropBox.w, cropBox.h);
    ctx.drawImage(
      img,
      cropBox.x,
      cropBox.y,
      cropBox.w,
      cropBox.h,
      cropBox.x,
      cropBox.y,
      cropBox.w,
      cropBox.h
    );

    // Border on crop box
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 3;
    ctx.strokeRect(cropBox.x, cropBox.y, cropBox.w, cropBox.h);

    // Corner handles
    ctx.fillStyle = '#818cf8';
    const handleSize = 10;
    const corners = [
      [cropBox.x, cropBox.y],
      [cropBox.x + cropBox.w, cropBox.y],
      [cropBox.x, cropBox.y + cropBox.h],
      [cropBox.x + cropBox.w, cropBox.y + cropBox.h],
    ];
    corners.forEach(([cx, cy]) => {
      ctx.fillRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
    });
  };

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e) => {
    const { x, y } = getCanvasCoords(e);
    const tol = 16;
    let mode = null;

    if (Math.abs(x - cropBox.x) < tol && Math.abs(y - cropBox.y) < tol) mode = 'tl';
    else if (Math.abs(x - (cropBox.x + cropBox.w)) < tol && Math.abs(y - cropBox.y) < tol) mode = 'tr';
    else if (Math.abs(x - cropBox.x) < tol && Math.abs(y - (cropBox.y + cropBox.h)) < tol) mode = 'bl';
    else if (
      Math.abs(x - (cropBox.x + cropBox.w)) < tol &&
      Math.abs(y - (cropBox.y + cropBox.h)) < tol
    )
      mode = 'br';
    else if (
      x >= cropBox.x &&
      x <= cropBox.x + cropBox.w &&
      y >= cropBox.y &&
      y <= cropBox.y + cropBox.h
    ) {
      mode = 'move';
    }

    if (mode) {
      setDragMode(mode);
      setDragStart({
        mouseX: x,
        mouseY: y,
        boxX: cropBox.x,
        boxY: cropBox.y,
        boxW: cropBox.w,
        boxH: cropBox.h,
      });
    }
  };

  const handleMouseMove = (e) => {
    if (!dragMode) return;
    const { x, y } = getCanvasCoords(e);
    const dx = x - dragStart.mouseX;
    const dy = y - dragStart.mouseY;
    const imgW = canvasRef.current.width;
    const imgH = canvasRef.current.height;

    setCropBox((prev) => {
      let { boxX, boxY, boxW, boxH } = dragStart;
      if (dragMode === 'move') {
        const nextX = Math.max(0, Math.min(imgW - boxW, boxX + dx));
        const nextY = Math.max(0, Math.min(imgH - boxH, boxY + dy));
        return { ...prev, x: Math.round(nextX), y: Math.round(nextY) };
      }
      if (dragMode === 'br') {
        return {
          ...prev,
          w: Math.max(40, Math.min(imgW - boxX, boxW + dx)),
          h: Math.max(40, Math.min(imgH - boxY, boxH + dy)),
        };
      }
      if (dragMode === 'tl') {
        const newX = Math.max(0, Math.min(boxX + boxW - 40, boxX + dx));
        const newY = Math.max(0, Math.min(boxY + boxH - 40, boxY + dy));
        return {
          x: newX,
          y: newY,
          w: boxW - (newX - boxX),
          h: boxH - (newY - boxY),
        };
      }
      return prev;
    });
  };

  const handleMouseUp = () => {
    setDragMode(null);
  };

  const handleSolve = () => {
    if (!imageSrc) {
      setValidationError('Please upload or snap a diagram problem image first.');
      return;
    }

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropBox.w;
    cropCanvas.height = cropBox.h;
    const ctx = cropCanvas.getContext('2d');

    ctx.drawImage(
      imageObjRef.current,
      cropBox.x,
      cropBox.y,
      cropBox.w,
      cropBox.h,
      0,
      0,
      cropBox.w,
      cropBox.h
    );

    cropCanvas.toBlob(
      (blob) => {
        if (!blob) {
          setValidationError('Failed to generate cropped image.');
          return;
        }
        const dataUrl = cropCanvas.toDataURL('image/jpeg', 0.95);
        if (onCaptureComplete) {
          onCaptureComplete(blob, dataUrl, subjectHint);
        }
      },
      'image/jpeg',
      0.95
    );
  };

  return (
    <div className="w-full space-y-6">
      {/* Upload & Camera Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Camera className="w-5 h-5 text-indigo-400" />
              Capture Math or Diagram Problem
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Snap textbook problems, circuit diagrams, or differential equations to solve.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition"
            >
              <Upload className="w-4 h-4 text-indigo-400" />
              Choose File
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="hidden"
            />

            {!isCameraActive ? (
              <button
                type="button"
                onClick={startCamera}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md transition"
              >
                <Camera className="w-4 h-4" />
                Live Camera
              </button>
            ) : (
              <button
                type="button"
                onClick={stopCamera}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl shadow-md transition"
              >
                <VideoOff className="w-4 h-4" />
                Stop Camera
              </button>
            )}
          </div>
        </div>

        {/* Validation or Camera Error Banner */}
        {(validationError || cameraError) && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold rounded-xl flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{validationError || cameraError}</span>
          </div>
        )}

        {/* Live Video Camera Viewport */}
        {isCameraActive && (
          <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-700 flex flex-col items-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full max-h-[380px] object-contain bg-black"
            />
            <div className="absolute bottom-4 flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-700">
              <button
                type="button"
                onClick={captureCameraSnapshot}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition"
              >
                <Camera className="w-4 h-4" />
                Snap Photo
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="px-3 py-2 text-slate-400 hover:text-slate-200 text-xs font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Drop Zone when no image is loaded and camera inactive */}
        {!imageSrc && !isCameraActive && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
              isDragging
                ? 'border-indigo-400 bg-indigo-500/10'
                : 'border-slate-750 hover:border-slate-600 bg-slate-950/40'
            }`}
          >
            <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700 text-indigo-400">
              <FileImage className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">
                Drag and drop your math equation or diagram here
              </p>
              <p className="text-xs text-slate-500 mt-1">Supports JPEG, PNG, and WebP up to 5MB</p>
            </div>
          </div>
        )}

        {/* Bounding Box Cropper Canvas View */}
        {imageSrc && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-medium">
                <Crop className="w-4 h-4 text-indigo-400" />
                Drag the crop box corners to isolate the problem formula or diagram
              </span>
              <button
                type="button"
                onClick={() => {
                  setImageSrc(null);
                  setValidationError('');
                }}
                className="flex items-center gap-1.5 hover:text-slate-200 text-slate-450 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>

            <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex justify-center p-2">
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="max-w-full max-h-[440px] object-contain cursor-crosshair rounded-xl"
              />
            </div>
          </div>
        )}

        {/* Subject Domain Selector & Solve Action */}
        <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-indigo-400" />
            <label className="text-xs font-semibold text-slate-300">Subject Domain:</label>
            <select
              value={subjectHint}
              onChange={(e) => setSubjectHint(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              {SUBJECT_OPTIONS.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            disabled={!imageSrc || isProcessing}
            onClick={handleSolve}
            className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition shadow-lg ${
              !imageSrc || isProcessing
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white cursor-pointer'
            }`}
          >
            {isProcessing ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin text-indigo-200" />
                Analyzing Problem...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Solve Diagram with KaTeX
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
