'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { createClient } from '@/lib/supabase/client';
import { Order } from '@/types/database';
import { extractOrderInfoFromQR, playSuccessFeedback } from '@/lib/utils/qrUtils';
import {
  X,
  Camera,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Upload,
  KeyRound,
  ChevronRight,
  AlertCircle,
  FileImage,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AdminQRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCompleted: (order: Order) => void;
  currency?: string;
}

type ScannerMode = 'camera' | 'upload' | 'pin';

export default function AdminQRScannerModal({
  isOpen,
  onClose,
  onOrderCompleted,
}: AdminQRScannerModalProps) {
  const [mode, setMode] = useState<ScannerMode>('camera');
  const [scannerActive, setScannerActive] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loadingCamera, setLoadingCamera] = useState(false);
  const [processingOrder, setProcessingOrder] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);

  // Upload & PIN states
  const [fileUploading, setFileUploading] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const supabase = createClient();

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

  // Central Order Completion Handler
  const verifyAndCompleteOrder = useCallback(
    async ({
      orderId,
      code,
    }: {
      orderId?: string | null;
      code?: string | null;
    }) => {
      if (processingOrder) return;
      setProcessingOrder(true);
      setErrorMessage(null);

      try {
        let query = supabase.from('orders').select('*');
        if (orderId) {
          query = query.eq('id', orderId);
        } else if (code) {
          query = query.eq('access_code', code);
        } else {
          setErrorMessage('Invalid QR or PIN. Please try again.');
          setProcessingOrder(false);
          return;
        }

        const { data, error } = await query.limit(1).maybeSingle();

        if (error || !data) {
          setErrorMessage(
            code
              ? `No active order found for PIN #${code}. Please check the slip.`
              : 'Order not found or already completed.'
          );
          setProcessingOrder(false);
          return;
        }

        const activeOrder = data as Order;

        if (activeOrder.status === 'completed') {
          setErrorMessage(
            `Order for ${activeOrder.customer_name || 'Customer'} is already marked completed.`
          );
          setProcessingOrder(false);
          return;
        }

        // Mark order completed in database
        const { data: updated, error: updateError } = await supabase
          .from('orders')
          .update({
            status: 'completed',
            access_code: null,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', activeOrder.id)
          .select()
          .single();

        if (updateError) throw updateError;

        const finishedOrder = {
          ...(updated as Order),
          access_code: activeOrder.access_code, // preserve original PIN for toast display
        };

        // 1. Play immediate audio chime and haptic feedback
        playSuccessFeedback();

        // 2. Stop camera cleanly
        await stopScanner();

        // 3. Close modal immediately and notify parent dashboard to trigger animation
        onClose();
        onOrderCompleted(finishedOrder);
      } catch (err: unknown) {
        console.error('Failed to complete order:', err);
        setErrorMessage('Failed to verify and update order status.');
      } finally {
        setProcessingOrder(false);
      }
    },
    [processingOrder, supabase, stopScanner, onClose, onOrderCompleted]
  );

  const handleScanSuccess = useCallback(
    async (decodedText: string) => {
      const { orderId, code } = extractOrderInfoFromQR(decodedText);
      if (!orderId && !code) {
        setErrorMessage('Invalid QR code format. Please scan a valid order QR.');
        return;
      }
      await verifyAndCompleteOrder({ orderId, code });
    },
    [verifyAndCompleteOrder]
  );

  const startScanner = useCallback(
    async (cameraIdToUse?: string) => {
      setLoadingCamera(true);
      setPermissionDenied(false);
      setErrorMessage(null);

      try {
        if (scannerRef.current && scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }

        const html5Qr = new Html5Qrcode('admin-live-qr-reader');
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
            fps: 14,
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            handleScanSuccess(decodedText);
          },
          () => {}
        );

        setScannerActive(true);
      } catch (err) {
        console.warn('Camera error:', err);
        setPermissionDenied(true);
        setScannerActive(false);
      } finally {
        setLoadingCamera(false);
      }
    },
    [handleScanSuccess]
  );

  // File Image Upload handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileUploading(true);
    setErrorMessage(null);

    try {
      let tempContainer = document.getElementById('admin-qr-file-scanner-temp');
      if (!tempContainer) {
        tempContainer = document.createElement('div');
        tempContainer.id = 'admin-qr-file-scanner-temp';
        tempContainer.style.position = 'absolute';
        tempContainer.style.top = '-9999px';
        tempContainer.style.left = '-9999px';
        tempContainer.style.width = '1px';
        tempContainer.style.height = '1px';
        tempContainer.style.overflow = 'hidden';
        document.body.appendChild(tempContainer);
      }

      const fileQr = new Html5Qrcode('admin-qr-file-scanner-temp');
      const decodedResult = await fileQr.scanFile(file, true);
      try {
        await fileQr.clear();
      } catch {
        // Ignore clear error
      }

      const { orderId, code } = extractOrderInfoFromQR(decodedResult);
      if (!orderId && !code) {
        setErrorMessage('QR code in photo was not recognized as a valid order code.');
        return;
      }

      await verifyAndCompleteOrder({ orderId, code });
    } catch (err) {
      console.error('Failed to decode QR image:', err);
      setErrorMessage(
        'Could not detect a QR code in this photo. Please try a clearer picture or enter the PIN.'
      );
    } finally {
      setFileUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // PIN Form submit handler
  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pinInput.trim();
    if (cleanPin.length !== 4) {
      setErrorMessage('Please enter a 4-digit PIN.');
      return;
    }
    await verifyAndCompleteOrder({ code: cleanPin });
  };

  // Manage scanner lifecycle with modal open/close and mode changes
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setPinInput('');
      if (mode === 'camera') {
        const timer = setTimeout(() => {
          startScanner();
        }, 300);
        return () => clearTimeout(timer);
      } else {
        stopScanner();
      }
    } else {
      stopScanner();
    }
  }, [isOpen, mode, startScanner, stopScanner]);

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
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 border border-amber-200/60 flex items-center justify-center">
                  <Camera className="w-4 h-4 text-amber-700" />
                </div>
                <div>
                  <h3 className="font-extrabold text-stone-900 text-sm">
                    Verify Customer Pickup
                  </h3>
                  <p className="text-[10px] text-stone-500">Scan QR, upload slip, or enter PIN</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopScanner();
                  onClose();
                }}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Segmented Mode Switcher */}
            <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-100">
              <div className="grid grid-cols-3 gap-1 bg-stone-200/60 p-1 rounded-xl text-xs font-bold text-stone-600">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setMode('camera');
                  }}
                  className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    mode === 'camera'
                      ? 'bg-white text-stone-900 shadow-2xs font-black'
                      : 'hover:text-stone-900'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Scan QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setMode('upload');
                  }}
                  className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    mode === 'upload'
                      ? 'bg-white text-stone-900 shadow-2xs font-black'
                      : 'hover:text-stone-900'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setMode('pin');
                  }}
                  className={`py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    mode === 'pin'
                      ? 'bg-white text-stone-900 shadow-2xs font-black'
                      : 'hover:text-stone-900'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Type PIN</span>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 text-center space-y-3.5">
              {/* MODE 1: Camera Scanner */}
              {mode === 'camera' && (
                <>
                  {permissionDenied ? (
                    /* Permission Card with Fallback Options */
                    <div className="py-5 px-4 space-y-3.5 bg-amber-50/70 rounded-2xl border border-amber-200/80 text-center">
                      <div className="w-11 h-11 mx-auto rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
                        <ShieldAlert className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-extrabold text-stone-900 text-sm">
                          Camera Access Blocked
                        </h4>
                        <p className="text-xs text-stone-600 leading-relaxed max-w-xs mx-auto">
                          Please allow camera access in browser settings, or use one of the quick fallbacks below.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setMode('upload')}
                          className="py-2.5 px-3 rounded-xl bg-white border border-amber-300 hover:bg-amber-100/60 text-amber-900 font-bold text-xs transition shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5 text-amber-700" />
                          <span>Upload Slip</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setMode('pin')}
                          className="py-2.5 px-3 rounded-xl bg-white border border-amber-300 hover:bg-amber-100/60 text-amber-900 font-bold text-xs transition shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-amber-700" />
                          <span>Type PIN</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => startScanner()}
                        className="w-full py-2 text-stone-500 hover:text-stone-800 text-xs font-semibold underline cursor-pointer"
                      >
                        Try camera again
                      </button>
                    </div>
                  ) : (
                    /* Live Camera Viewport */
                    <div className="relative mx-auto w-[240px] h-[240px] bg-stone-950 rounded-2xl overflow-hidden border-2 border-emerald-500/40 shadow-inner flex items-center justify-center">
                      <div id="admin-live-qr-reader" className="w-full h-full object-cover" />

                      {loadingCamera && (
                        <div className="absolute inset-0 bg-stone-950/80 flex flex-col items-center justify-center text-white gap-2 z-20">
                          <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
                          <span className="text-xs font-semibold">Opening camera...</span>
                        </div>
                      )}

                      {processingOrder && (
                        <div className="absolute inset-0 bg-stone-950/90 flex flex-col items-center justify-center text-white gap-2 z-20">
                          <Loader2 className="w-7 h-7 animate-spin text-emerald-400" />
                          <span className="text-xs font-bold">Verifying order...</span>
                        </div>
                      )}

                      {scannerActive && !processingOrder && (
                        <div className="absolute inset-0 pointer-events-none z-10 flex flex-col items-center justify-center">
                          <div className="w-[180px] h-[180px] border-2 border-white/60 rounded-xl relative">
                            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-500" />
                            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-500" />
                            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-500" />
                            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-500" />
                          </div>
                          <motion.div
                            className="absolute w-[180px] h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-lg shadow-emerald-400/50"
                            animate={{ y: [-75, 75, -75] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {!permissionDenied && (
                    <p className="text-xs text-stone-500">
                      Point camera at customer's phone QR or printed token slip
                    </p>
                  )}

                  {cameras.length > 1 && !permissionDenied && (
                    <div className="pt-1 flex justify-center">
                      <button
                        type="button"
                        onClick={() => {
                          const nextIndex =
                            (cameras.findIndex((c) => c.id === selectedCameraId) + 1) %
                            cameras.length;
                          setSelectedCameraId(cameras[nextIndex].id);
                          startScanner(cameras[nextIndex].id);
                        }}
                        className="py-1 px-2.5 text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Switch Camera</span>
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* MODE 2: Upload Image */}
              {mode === 'upload' && (
                <div className="py-2 space-y-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />

                  <button
                    type="button"
                    disabled={fileUploading || processingOrder}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-6 rounded-2xl border-2 border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/50 hover:bg-amber-50/80 active:scale-[0.99] transition flex flex-col items-center justify-center gap-3 text-center cursor-pointer group disabled:opacity-50"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-white border border-amber-200 text-amber-700 flex items-center justify-center shadow-2xs group-hover:scale-105 transition">
                      {fileUploading || processingOrder ? (
                        <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
                      ) : (
                        <FileImage className="w-6 h-6 text-amber-600" />
                      )}
                    </div>
                    <div>
                      <span className="block text-sm font-black text-stone-900">
                        {fileUploading || processingOrder
                          ? 'Reading QR Photo...'
                          : 'Choose Slip / QR Screenshot'}
                      </span>
                      <span className="block text-xs text-stone-500 mt-0.5">
                        Tap to select image from your device gallery
                      </span>
                    </div>
                  </button>

                  <p className="text-[11px] text-stone-400">
                    Supports WhatsApp screenshots, printed slip photos & QR files
                  </p>
                </div>
              )}

              {/* MODE 3: Type PIN */}
              {mode === 'pin' && (
                <form onSubmit={handlePinSubmit} className="py-2 space-y-4">
                  <div className="text-center space-y-1">
                    <span className="text-xs font-extrabold text-stone-800 block">
                      Enter 4-Digit Access PIN
                    </span>
                    <p className="text-[11px] text-stone-500">
                      Found on customer's tracking screen or printed slip
                    </p>
                  </div>

                  <div className="max-w-[200px] mx-auto">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      autoFocus
                      value={pinInput}
                      onChange={(e) => {
                        setPinInput(e.target.value.replace(/[^0-9]/g, ''));
                        setErrorMessage(null);
                      }}
                      placeholder="4420"
                      className="w-full text-center py-2.5 px-3 text-2xl font-mono font-black tracking-[0.35em] rounded-2xl border-2 border-stone-200 focus:border-amber-500 focus:bg-amber-50/20 bg-stone-50 text-stone-900 focus:outline-none transition shadow-inner"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={pinInput.length !== 4 || processingOrder}
                    className="w-full py-3 px-4 rounded-xl font-black text-xs text-white bg-amber-600 hover:bg-amber-700 active:scale-[0.99] transition shadow-md shadow-amber-600/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {processingOrder ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying & Completing...</span>
                      </>
                    ) : (
                      <>
                        <span>Verify & Complete Pickup</span>
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Error Alert Display */}
              {errorMessage && (
                <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-200/80 flex items-start gap-2 text-left">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="font-semibold flex-1 leading-snug">{errorMessage}</span>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
