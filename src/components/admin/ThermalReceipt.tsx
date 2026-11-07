'use client';

import { Order, ShopSettings } from '@/types/database';
import { formatPrice, formatWeight, formatDate } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';

interface ThermalReceiptProps {
  order: Order;
  settings: ShopSettings | null;
  trackingUrl: string;
}

export default function ThermalReceipt({
  order,
  settings,
  trackingUrl,
}: ThermalReceiptProps) {
  const shopName = settings?.shop_name || 'Chakki Fresh';
  const phone = settings?.phone_number || '';
  const currency = settings?.currency || 'Rs.';

  return (
    <div
      id="printable-slip"
      className="w-full max-w-[300px] mx-auto bg-white p-5 border border-stone-200 rounded-2xl font-mono text-stone-900 shadow-sm"
    >
      {/* Header */}
      <div className="text-center pb-3 border-b-2 border-dashed border-stone-300">
        <h2 className="text-lg font-black uppercase tracking-tight">{shopName}</h2>
        <p className="text-[11px] text-stone-600 mt-0.5">Fresh Stone Ground Atta</p>
        {phone && <p className="text-[11px] text-stone-600">Ph: {phone}</p>}
        <p className="text-[10px] text-stone-600 mt-1">
          {new Date(order.created_at).toLocaleDateString()} • {formatDate(order.created_at)}
        </p>
      </div>

      {/* 4-Digit Access PIN & Customer */}
      <div className="py-3 text-center border-b border-stone-200">
        <span className="text-[11px] font-bold text-stone-600 uppercase tracking-widest">
          ACCESS PIN
        </span>
        <div className="text-3xl font-black tracking-widest text-stone-900 mt-0.5">
          {order.access_code}
        </div>
        {order.customer_name && (
          <div className="text-xs font-bold text-stone-800 mt-1">
            Customer: {order.customer_name}
          </div>
        )}
      </div>

      {/* Weight & Price Details */}
      <div className="py-3 text-xs space-y-1.5 border-b-2 border-dashed border-stone-300">
        <div className="flex justify-between">
          <span className="text-stone-600">Wheat Weight:</span>
          <span className="font-bold">{formatWeight(order.weight_kg)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-stone-600">Rate / kg:</span>
          <span>{currency} {Number(order.rate_per_kg).toFixed(0)}</span>
        </div>
        <div className="flex justify-between text-sm pt-1 border-t border-stone-100 font-black">
          <span>Total Amount:</span>
          <span>{formatPrice(order.total_price, currency)}</span>
        </div>
        <div className="flex justify-between text-[11px] pt-0.5">
          <span className="text-stone-600">Payment:</span>
          <span className="font-bold">{order.is_paid ? 'PAID' : 'PAY ON PICKUP'}</span>
        </div>
      </div>

      {/* QR Code */}
      <div className="py-4 text-center space-y-2">
        <div className="inline-block p-2 bg-white rounded-xl border border-stone-200 shadow-xs">
          <QRCodeSVG
            value={trackingUrl}
            size={135}
            level="M"
            includeMargin={false}
          />
        </div>

        <p className="text-[10px] text-stone-600 max-w-[220px] mx-auto leading-tight">
          Scan QR code or enter PIN at our website to track live grinding progress!
        </p>
      </div>

      {/* Footer */}
      <div className="pt-2 text-center text-[10px] text-stone-600 border-t border-dashed border-stone-300">
        Thank you for visiting!
      </div>
    </div>
  );
}
