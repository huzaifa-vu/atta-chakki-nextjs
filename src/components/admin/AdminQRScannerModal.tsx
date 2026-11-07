'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { createClient } from '@/lib/supabase/client';
import { Order } from '@/types/database';
import { formatWeight, formatPrice } from '@/lib/utils';
import { extractOrderInfoFromQR, playSuccessFeedback } from '@/lib/utils/qrUtils';
import {
  X,
  Camera,
  Loader2,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AdminQRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCompleted: (order: Order) => void;
  currency?: string;
}

export default function AdminQRScannerModal({
  isOpen,
  onClose,
  onOrderCompleted,
  currency = 'Rs.',
}: AdminQRScannerModalProps) {
  const [scannerActive, setScannerActive] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loadingCamera, setLoadingCamera] = useState(false);
  const [processingOrder, setProcessingOrder] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);
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

  const handleScanSuccess = useCallback(
    async (decodedText: string) => {
      if (processingOrder || completedOrder) return;
      setProcessingOrder(true);
      setErrorMessage(null);

      // Stop camera immediately
      await stopScanner();

      try {
        const { orderId, code } = extractOrderInfoFromQR(decodedText);

        if (!orderId && !code) {
          setErrorMessage('Invalid QR code format. Please scan a valid order QR.');
          setProcessingOrder(false);
          return;
        }

        // 1. Fetch matching active order
        let query = supabase.from('orders').select('*');
        if (orderId) {
          query = query.eq('id', orderId);
        } else if (code) {
          query = query.eq('access_code', code);
        }

        const { data, error } = await query.limit(1).maybeSingle();

        if (error || !data) {
          setErrorMessage('Order not found or already completed.');
          setProcessingOrder(false);
          return;
        }

        const activeOrder = data as Order;

        // If already completed
        if (activeOrder.status === 'completed') {
          setErrorMessage(`Order for ${activeOrder.customer_name || 'Customer'} is already marked completed.`);
          setProcessingOrder(false);
          return;
        }

        // 2. Automatically mark order as completed!
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

        const finishedOrder = updated as Order;

        // 3. Audio & Haptic feedback
        playSuccessFeedback();
        setCompletedOrder(finishedOrder);

        // 4. Auto-close modal after 800ms confirmation window
        if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = setTimeout(() => {
          onClose();
          onOrderCompleted(finishedOrder);
        }, 800);
      } catch (err: unknown) {
        console.error('Failed to complete order from QR:', err);
        setErrorMessage('Failed to update order status.');
      } finally {
        setProcessingOrder(false);
      }
    },
    [processingOrder, completedOrder, stopScanner, supabase, onClose, onOrderCompleted]
  );

  const startScanner = useCallback(
    async (cameraIdToUse?: string) => {
      setLoadingCamera(true);
      setPermissionDenied(false);
      setErrorMessage(null);
      setCompletedOrder(null);

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
            fps: 12,
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

  useEffect(() => {
    if (isOpen) {
      setCompletedOrder(null);
      setErrorMessage(null);
      const timer = setTimeout(() => {
        startScanner();
      }, 350);
      return () => clearTimeout(timer);
    } else {
      stopScanner();
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    }
  }, [isOpen, startScanner, stopScanner]);

  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
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
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-700 flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-stone-900 text-sm">
                    Scan Customer Pickup QR
                  </h3>
                  <p className="text-[10px] text-stone-500">Auto-completes and closes</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
                  stopScanner();
                  onClose();
                }}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 text-center space-y-4">
              {/* Completed Success View */}
              {completedOrder ? (
                <div className="py-6 px-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-3 text-center">
                  <div className="w-14 h-14 mx-auto rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 animate-pulse">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full inline-block">
                      ✓ Pickup Verified
                    </span>
                    <h4 className="text-lg font-black text-stone-900">
                      {completedOrder.customer_name || 'Customer Order'}
                    </h4>
                    <p className="text-xs text-stone-600">
                      {formatWeight(completedOrder.weight_kg)} • {formatPrice(completedOrder.total_price, currency)}
                    </p>
                  </div>

                  <p className="text-[11px] font-medium text-emerald-700 animate-pulse">
                    Closing scanner & updating dashboard...
                  </p>
                </div>
              ) : permissionDenied ? (
                /* Permission Card */
                <div className="py-6 px-4 space-y-4 bg-amber-50/70 rounded-2xl border border-amber-200/80 text-center">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-stone-900 text-sm">
                      Camera Permission Needed
                    </h4>
                    <p className="text-xs text-stone-600 leading-relaxed max-w-xs mx-auto">
                      Please allow camera access in your browser to scan the customer's QR code.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startScanner()}
                    className="w-full py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition shadow-xs cursor-pointer"
                  >
                    Try Camera Again
                  </button>
                </div>
              ) : (
                /* Camera Viewport */
                <div className="relative mx-auto w-[250px] h-[250px] bg-stone-950 rounded-2xl overflow-hidden border-2 border-emerald-500/40 shadow-inner flex items-center justify-center">
                  <div id="admin-live-qr-reader" className="w-full h-full object-cover" />

                  {loadingCamera && (
                    <div className="absolute inset-0 bg-stone-950/80 flex flex-col items-center justify-center text-white gap-2 z-20">
                      <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                      <span className="text-xs font-semibold">Opening camera...</span>
                    </div>
                  )}

                  {processingOrder && (
                    <div className="absolute inset-0 bg-stone-950/90 flex flex-col items-center justify-center text-white gap-2 z-20">
                      <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                      <span className="text-xs font-bold">Verifying order...</span>
                    </div>
                  )}

                  {scannerActive && !processingOrder && (
                    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col items-center justify-center">
                      <div className="w-[190px] h-[190px] border-2 border-white/60 rounded-xl relative">
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-500" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-500" />
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-500" />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-500" />
                      </div>
                      <motion.div
                        className="absolute w-[190px] h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-lg shadow-emerald-400/50"
                        animate={{ y: [-80, 80, -80] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    </div>
                  )}
                </div>
              )}

              {errorMessage && (
                <div className="p-3.5 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-200/80 space-y-2 text-left">
                  <p className="font-semibold">{errorMessage}</p>
                  <button
                    type="button"
                    onClick={() => startScanner()}
                    className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition text-center cursor-pointer"
                  >
                    Scan Again
                  </button>
                </div>
              )}

              {!completedOrder && !permissionDenied && (
                <p className="text-xs text-stone-500">
                  Point camera at customer's phone QR or printed token slip
                </p>
              )}

              {cameras.length > 1 && !completedOrder && !permissionDenied && (
                <div className="pt-2 border-t border-stone-100 flex justify-center">
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
                    Switch Camera
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
