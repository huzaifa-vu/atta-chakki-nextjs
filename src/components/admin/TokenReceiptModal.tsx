'use client';

import { useState } from 'react';
import { Order, ShopSettings } from '@/types/database';
import { formatPrice, formatWeight, formatPhoneNumber } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';
import {
  X,
  Printer,
  Share2,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TokenReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  settings: ShopSettings | null;
}

export default function TokenReceiptModal({
  isOpen,
  onClose,
  order,
  settings,
}: TokenReceiptModalProps) {
  const [copied, setCopied] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);

  if (!order) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const trackingUrl = `${origin}/?track=${order.id}`;
  const currency = settings?.currency || 'Rs.';
  const shopName = settings?.shop_name || 'Chakki Fresh';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(trackingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPin = () => {
    if (!order.access_code) return;
    navigator.clipboard.writeText(order.access_code);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    const pinText = order.access_code ? `\n\nYour 4-Digit Access PIN is: ${order.access_code}` : '';
    const text = `Hello ${order.customer_name || 'Customer'}! Your atta order (${formatWeight(order.weight_kg)}, ${formatPrice(order.total_price, currency)}) has been processed at ${shopName}.${pinText}\nTrack live grinding progress here:\n${trackingUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm overflow-y-auto">
          {/* Main Modal for Screen */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-stone-200 overflow-hidden no-print my-8"
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4 text-white flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-100">
                  {order.status === 'completed'
                    ? 'Completed Order Slip'
                    : order.access_code
                    ? 'Order Successfully Created'
                    : 'Customer Order Receipt'}
                </span>
                {order.access_code ? (
                  <button
                    type="button"
                    onClick={handleCopyPin}
                    className="flex items-center gap-2 text-xl font-black text-white hover:text-amber-100 active:scale-95 transition cursor-pointer group text-left"
                    title="Click to copy PIN"
                  >
                    <span>PIN: {order.access_code}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 group-hover:bg-white/30 transition flex items-center gap-1">
                      {copiedPin ? (
                        <>
                          <Check className="w-3 h-3 text-white stroke-[3]" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-white/80" />
                          <span>Copy</span>
                        </>
                      )}
                    </span>
                  </button>
                ) : (
                  <div className="text-xl font-black text-white">
                    {order.customer_name || 'Customer Order'}
                  </div>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* QR Code and PIN display */}
            <div className="p-6 text-center space-y-4">
              <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100 inline-block">
                <QRCodeSVG
                  value={trackingUrl}
                  size={170}
                  level="Q"
                  includeMargin={false}
                />
              </div>

              {/* 4-digit code banner - Click/Tap to Copy */}
              {order.access_code && (
                <button
                  type="button"
                  onClick={handleCopyPin}
                  className={`w-full max-w-xs mx-auto block rounded-2xl p-3.5 transition-all duration-200 border cursor-pointer active:scale-95 group text-center shadow-2xs ${
                    copiedPin
                      ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-200'
                      : 'bg-stone-50 hover:bg-amber-50/60 border-stone-200 hover:border-amber-300'
                  }`}
                  title="Click or tap to copy PIN"
                >
                  <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-widest transition">
                    {copiedPin ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-extrabold animate-in fade-in zoom-in duration-150">
                        <Check className="w-3.5 h-3.5 stroke-[3] text-emerald-600" />
                        PIN Copied to Clipboard!
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-stone-500 group-hover:text-amber-800">
                        <Copy className="w-3 h-3 text-stone-400 group-hover:text-amber-600" />
                        4-Digit Access PIN • Tap to copy
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-center gap-2 mt-1">
                    <span
                      className={`block text-3xl font-mono font-black tracking-widest transition-colors duration-150 ${
                        copiedPin ? 'text-emerald-700' : 'text-amber-600 group-hover:text-amber-700'
                      }`}
                    >
                      {order.access_code}
                    </span>
                    <span
                      className={`p-1.5 rounded-xl transition-all duration-150 ${
                        copiedPin
                          ? 'bg-emerald-100 text-emerald-700 scale-110'
                          : 'bg-stone-200/70 group-hover:bg-amber-100 text-stone-500 group-hover:text-amber-700'
                      }`}
                    >
                      {copiedPin ? (
                        <Check className="w-4 h-4 stroke-[3]" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </span>
                  </div>

                  <p className="text-[11px] text-stone-500 mt-1 transition-colors">
                    {copiedPin
                      ? '✓ Copied! You can paste or share it now.'
                      : 'Customer can scan QR or enter PIN on our website'}
                  </p>
                </button>
              )}

              {/* Order quick info */}
              <div className="grid grid-cols-2 gap-2 text-left bg-stone-50/80 p-3 rounded-xl border border-stone-100 text-xs">
                <div>
                  <span className="text-stone-500 block">Weight:</span>
                  <span className="font-bold text-stone-900">{formatWeight(order.weight_kg)}</span>
                </div>
                <div>
                  <span className="text-stone-500 block">Total Price:</span>
                  <span className="font-bold text-stone-900">{formatPrice(order.total_price, currency)}</span>
                </div>
                {order.customer_name && (
                  <div className="col-span-2 pt-1 border-t border-stone-200">
                    <span className="text-stone-500">Customer: </span>
                    <span className="font-bold text-stone-900">{order.customer_name}</span>
                  </div>
                )}
              </div>

              {/* Dual Mode Action Buttons */}
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="py-3 px-4 rounded-xl font-bold text-xs text-stone-800 bg-stone-100 hover:bg-stone-200 active:scale-[0.98] transition flex items-center justify-center gap-2 border border-stone-200 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-stone-600" />
                  Print Token Slip
                </button>

                <button
                  type="button"
                  onClick={handleWhatsAppShare}
                  className="py-3 px-4 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  WhatsApp
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold text-stone-600 bg-white border border-stone-200 hover:bg-stone-50 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      Link Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Tracking Link
                    </>
                  )}
                </button>

                <a
                  href={trackingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2.5 px-3 rounded-xl text-xs font-semibold text-stone-600 bg-white border border-stone-200 hover:bg-stone-50 transition flex items-center gap-1 cursor-pointer"
                  title="Open Customer View"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-xl font-bold text-sm bg-stone-900 text-white hover:bg-black transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </motion.div>

          {/* Printable Ticket */}
          <div className="print-only">
            <div className="max-w-[300px] mx-auto p-4 font-mono text-black text-xs leading-tight">
              <div className="text-center pb-2 border-b-2 border-dashed border-black">
                <div className="font-bold text-base uppercase">{shopName}</div>
                <div>Fresh Stone Ground Atta</div>
                {settings?.phone_number && <div>Ph: {formatPhoneNumber(settings.phone_number)}</div>}
                <div className="text-[10px] mt-1">{new Date().toLocaleString()}</div>
              </div>

              <div className="text-center py-2 border-b border-black">
                <div className="text-[10px] font-bold uppercase">4-DIGIT ACCESS PIN</div>
                <div className="text-3xl font-black">{order.access_code}</div>
                {order.customer_name && <div className="font-bold mt-1">Name: {order.customer_name}</div>}
              </div>

              <div className="py-2 space-y-1 border-b-2 border-dashed border-black text-xs">
                <div className="flex justify-between">
                  <span>Weight:</span>
                  <span className="font-bold">{formatWeight(order.weight_kg)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Rate:</span>
                  <span>{currency} {Number(order.rate_per_kg).toFixed(0)}/kg</span>
                </div>
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-black">
                  <span>Total:</span>
                  <span>{formatPrice(order.total_price, currency)}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span>Payment:</span>
                  <span className="font-bold">{order.is_paid ? 'PAID' : 'PAY ON PICKUP'}</span>
                </div>
              </div>

              <div className="py-3 text-center space-y-1">
                <div className="flex justify-center">
                  <QRCodeSVG value={trackingUrl} size={130} />
                </div>
                <div className="text-[9px] mt-1">Scan QR or enter PIN to track live grinding progress!</div>
              </div>

              <div className="pt-2 text-center text-[10px] border-t border-dashed border-black">
                Thank you for visiting!
              </div>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
