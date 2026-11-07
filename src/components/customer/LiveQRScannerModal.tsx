'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  X,
  Camera,
  Loader2,
  CheckCircle2,
  KeyRound,
  RefreshCw,
  Upload,
  ShieldAlert,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LiveQRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (orderId: string, code?: string) => void;
  onOpenCodeInput: () => void;
}

export default function LiveQRScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
  onOpenCodeInput,
}: LiveQRScannerModalProps) {
  const [scannerActive, setScannerActive] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [loadingCamera, setLoadingCamera] = useState(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stop active scanner safely
  const stopScanner = useCallback(async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      } finally {
        setScannerActive(false);
      }
    }
  }, []);

  // Process decoded QR text
  const handleDecodedText = useCallback(
    async (decodedText: string) => {
      if (scannedResult) return;
      setScannedResult(decodedText);

      await stopScanner();

      try {
        let orderId = '';
        let code = '';

        if (decodedText.includes('track?') || decodedText.includes('id=')) {
          const urlObj = new URL(
            decodedText.startsWith('http') ? decodedText : `https://${decodedText}`
          );
          orderId = urlObj.searchParams.get('id') || '';
          code = urlObj.searchParams.get('code') || '';
        } else {
          orderId = decodedText.trim();
        }

        if (orderId) {
          setTimeout(() => {
            onScanSuccess(orderId, code);
            onClose();
          }, 800);
        } else {
          setScannedResult(null);
        }
      } catch {
        setScannedResult(null);
      }
    },
    [scannedResult, stopScanner, onScanSuccess, onClose]
  );

  // Start the scanner
  const startScanner = useCallback(async (cameraIdToUse?: string) => {
    setLoadingCamera(true);
    setPermissionDenied(false);

    try {
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }

      const html5Qr = new Html5Qrcode('live-qr-reader');
      scannerRef.current = html5Qr;

      let targetCameraId = cameraIdToUse;
      if (!targetCameraId) {
        const availableDevices = await Html5Qrcode.getCameras().catch(() => []);
        if (!availableDevices || availableDevices.length === 0) {
          setPermissionDenied(true);
          setLoadingCamera(false);
          return;
        }
        setCameras(availableDevices);
        const backCamera = availableDevices.find((c) =>
          c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('environment')
        );
        targetCameraId = backCamera ? backCamera.id : availableDevices[0].id;
        setSelectedCameraId(targetCameraId);
      }

      await html5Qr.start(
        targetCameraId,
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleDecodedText(decodedText);
        },
        () => {}
      );

      setScannerActive(true);
    } catch (err: unknown) {
      console.warn('Camera access issue:', err);
      setPermissionDenied(true);
      setScannerActive(false);
    } finally {
      setLoadingCamera(false);
    }
  }, [handleDecodedText]);

  // Handle file scan fallback
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingCamera(true);
    try {
      const html5Qr = scannerRef.current || new Html5Qrcode('live-qr-reader');
      scannerRef.current = html5Qr;
      const decodedResult = await html5Qr.scanFile(file, true);
      handleDecodedText(decodedResult);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCamera(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setScannedResult(null);
      setPermissionDenied(false);
      const timer = setTimeout(() => {
        startScanner();
      }, 350);
      return () => clearTimeout(timer);
    } else {
      stopScanner();
    }
  }, [isOpen, startScanner, stopScanner]);

  useEffect(() => {
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/70 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="w-full max-w-sm rounded-3xl bg-white shadow-2xl border border-stone-200 overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-700 flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-stone-900 text-sm">
                  Scan Order QR
                </h3>
              </div>
              <button
                onClick={() => {
                  stopScanner();
                  onClose();
                }}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Area */}
            <div className="p-5 text-center space-y-4">
              {/* Friendly Permission Denied Card */}
              {permissionDenied ? (
                <div className="py-6 px-4 space-y-4 bg-amber-50/70 rounded-2xl border border-amber-200/80 text-center">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-stone-900 text-sm">
                      Camera Permission Needed
                    </h4>
                    <p className="text-xs text-stone-600 leading-relaxed max-w-xs mx-auto">
                      Please allow camera access in your browser to scan the QR code, or enter your 4-digit PIN directly.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => startScanner()}
                      className="w-full py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition shadow-xs cursor-pointer"
                    >
                      Try Camera Again
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenCodeInput();
                      }}
                      className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-stone-100 text-stone-800 font-bold text-xs border border-stone-200 transition cursor-pointer"
                    >
                      Enter 4-Digit PIN Instead
                    </button>
                  </div>
                </div>
              ) : (
                /* Scanner Viewport */
                <div className="relative mx-auto w-[250px] h-[250px] bg-stone-950 rounded-2xl overflow-hidden border-2 border-amber-500/40 shadow-inner flex items-center justify-center">
                  <div id="live-qr-reader" className="w-full h-full object-cover" />

                  {loadingCamera && (
                    <div className="absolute inset-0 bg-stone-950/80 flex flex-col items-center justify-center text-white gap-2 z-20">
                      <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                      <span className="text-xs font-semibold">Opening camera...</span>
                    </div>
                  )}

                  {scannerActive && !scannedResult && (
                    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col items-center justify-center">
                      <div className="w-[190px] h-[190px] border-2 border-white/60 rounded-xl relative">
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-amber-500" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-amber-500" />
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-amber-500" />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-amber-500" />
                      </div>
                      <motion.div
                        className="absolute w-[190px] h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-lg shadow-amber-400/50"
                        animate={{ y: [-80, 80, -80] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    </div>
                  )}

                  {scannedResult && (
                    <div className="absolute inset-0 bg-emerald-950/90 flex flex-col items-center justify-center text-white gap-2 z-20">
                      <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
                      <span className="text-sm font-bold">QR Verified!</span>
                    </div>
                  )}
                </div>
              )}

              {!permissionDenied && (
                <p className="text-xs text-stone-500">
                  Point camera at the QR code on your slip
                </p>
              )}

              {/* Action Toolbar */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-100">
                {cameras.length > 1 && !permissionDenied && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextIndex =
                        (cameras.findIndex((c) => c.id === selectedCameraId) + 1) %
                        cameras.length;
                      setSelectedCameraId(cameras[nextIndex].id);
                      startScanner(cameras[nextIndex].id);
                    }}
                    className="p-2 text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Switch
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload Photo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />

                <button
                  type="button"
                  onClick={() => {
                    stopScanner();
                    onClose();
                    onOpenCodeInput();
                  }}
                  className="p-2 text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ml-auto cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Type PIN
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
