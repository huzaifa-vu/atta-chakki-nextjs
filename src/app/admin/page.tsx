'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Order, OrderStatus, ShopSettings } from '@/types/database';
import AdminOrderCard from '@/components/admin/AdminOrderCard';
import NewOrderModal from '@/components/admin/NewOrderModal';
import TokenReceiptModal from '@/components/admin/TokenReceiptModal';
import AdminQRScannerModal from '@/components/admin/AdminQRScannerModal';
import { formatWeight } from '@/lib/utils';
import { useShopOperatingStatus, formatTime12Hour, formatNextOpenShort } from '@/lib/utils/shopHours';
import {
  Wheat,
  Plus,
  Settings as SettingsIcon,
  RefreshCw,
  Clock,
  Flame,
  ShoppingBag,
  Camera,
  Loader2,
  CheckCircle2,
  CheckSquare,
  X,
  Check,
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [activeTab, setActiveTab] = useState<'all_active' | 'queued' | 'grinding' | 'ready' | 'completed'>('all_active');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<Order | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isAdminScannerOpen, setIsAdminScannerOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const supabase = createClient();

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase
      .from('shop_settings')
      .select('*')
      .limit(1)
      .single();
    if (data) {
      setSettings(data as ShopSettings);
      try {
        localStorage.setItem('chakki_cached_settings', JSON.stringify(data));
      } catch {
        // Ignore localStorage error
      }
    }
  }, [supabase]);

  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setOrders(data as Order[]);
    }
    setLoading(false);
  }, [supabase]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchSettings(), fetchOrders()]);
    setTimeout(() => setIsRefreshing(false), 400);
  };

  useEffect(() => {
    fetchSettings();
    fetchOrders();

    const channel = supabase
      .channel('admin-orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newOrd = payload.new as Order;
            setOrders((prev) => [newOrd, ...prev.filter((o) => o.id !== newOrd.id)]);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Order;
            setOrders((prev) =>
              prev.map((ord) => (ord.id === updated.id ? updated : ord))
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id;
            setOrders((prev) => prev.filter((ord) => ord.id !== deletedId));
            setSelectedOrderIds((prev) => prev.filter((id) => id !== deletedId));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shop_settings' },
        (payload) => {
          if (payload.new) {
            setSettings(payload.new as ShopSettings);
            try {
              localStorage.setItem('chakki_cached_settings', JSON.stringify(payload.new));
            } catch {
              // Ignore
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchSettings, fetchOrders]);

  // Single status transition handler
  const handleUpdateStatus = async (orderId: string, nextStatus: OrderStatus) => {
    const updateData: Partial<Order> = {
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };

    if (nextStatus === 'completed') {
      updateData.access_code = null;
      updateData.completed_at = new Date().toISOString();
    }

    // Optimistically update local state so card animates immediately
    setOrders((prev) =>
      prev.map((ord) => (ord.id === orderId ? { ...ord, ...updateData } : ord))
    );
    setSelectedOrderIds((prev) => prev.filter((id) => id !== orderId));

    try {
      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;
    } catch (e) {
      console.error('Failed to update status', e);
      fetchOrders();
      alert('Failed to update status.');
    }
  };

  // Currently selected status type (locked so admin selects one type at a time)
  const selectedStatus: OrderStatus | null =
    selectedOrderIds.length > 0
      ? orders.find((o) => o.id === selectedOrderIds[0])?.status ?? null
      : null;

  // Bulk status update handler - strictly forward transitions only!
  const handleBulkUpdateStatus = async (nextStatus: OrderStatus) => {
    if (selectedOrderIds.length === 0) return;

    // Safety constraint: Never allow status regression
    if (selectedStatus === 'ready' && nextStatus !== 'completed') {
      alert('Ready orders can only be advanced to Completed.');
      return;
    }
    if (selectedStatus === 'grinding' && nextStatus === 'queued') {
      alert('Grinding orders cannot be reverted back to In Queue.');
      return;
    }

    try {
      const updateData: Partial<Order> = {
        status: nextStatus,
        updated_at: new Date().toISOString(),
      };

      if (nextStatus === 'completed') {
        updateData.access_code = null;
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .in('id', selectedOrderIds);

      if (error) throw error;

      const count = selectedOrderIds.length;
      setSelectedOrderIds([]);
      setToastMessage(
        `Batch of ${count} bags updated to ${
          nextStatus === 'grinding'
            ? 'Grinding'
            : nextStatus === 'ready'
            ? 'Ready for Pickup'
            : 'Completed'
        }!`
      );
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      console.error('Bulk update error:', err);
      alert('Failed to update selected orders.');
    }
  };

  // Selection handlers - enforce selecting ONE status type at a time
  const handleToggleSelect = (orderId: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;

    if (selectedOrderIds.includes(orderId)) {
      setSelectedOrderIds((prev) => prev.filter((id) => id !== orderId));
    } else {
      // If other orders already selected, ensure status matches
      if (selectedStatus && targetOrder.status !== selectedStatus) {
        setToastMessage(`Please select one status type at a time (${selectedStatus} orders).`);
        setTimeout(() => setToastMessage(null), 3000);
        return;
      }
      setSelectedOrderIds((prev) => [...prev, orderId]);
    }
  };

  const handleSelectAllInQueue = () => {
    const queuedIds = orders.filter((o) => o.status === 'queued').map((o) => o.id);
    setSelectedOrderIds(queuedIds);
  };

  const handleSelectAllGrinding = () => {
    const grindingIds = orders.filter((o) => o.status === 'grinding').map((o) => o.id);
    setSelectedOrderIds(grindingIds);
  };

  const handleSelectAllReady = () => {
    const readyIds = orders.filter((o) => o.status === 'ready').map((o) => o.id);
    setSelectedOrderIds(readyIds);
  };

  const handleClearSelection = () => {
    setSelectedOrderIds([]);
  };

  const handleTogglePayment = async (orderId: string, currentPaid: boolean) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ is_paid: !currentPaid, updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (error) throw error;
    } catch (e) {
      console.error('Failed to toggle payment', e);
    }
  };

  const handleUpdateOrderRate = async (orderId: string, newRate: number, newTotal: number) => {
    // Optimistically update orders in state
    setOrders((prev) =>
      prev.map((ord) =>
        ord.id === orderId
          ? {
              ...ord,
              rate_per_kg: newRate,
              total_price: newTotal,
              updated_at: new Date().toISOString(),
            }
          : ord
      )
    );

    try {
      const { error } = await supabase
        .from('orders')
        .update({
          rate_per_kg: newRate,
          total_price: newTotal,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (error) throw error;

      setToastMessage(`✓ Rate updated to Rs. ${newRate}/kg (Total: Rs. ${newTotal})`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (e) {
      console.error('Failed to update rate', e);
      fetchOrders();
      alert('Failed to update rate');
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel and delete this order?')) return;

    try {
      const { error } = await supabase.from('orders').delete().eq('id', orderId);
      if (error) throw error;
      setSelectedOrderIds((prev) => prev.filter((id) => id !== orderId));
    } catch (e) {
      console.error('Failed to delete order', e);
      alert('Failed to delete order');
    }
  };

  const handleOrderCreated = (newOrder: Order) => {
    setIsNewOrderModalOpen(false);
    setSelectedReceiptOrder(newOrder);
    setIsReceiptModalOpen(true);
  };

  const handleAutoCompletedFromQR = (completedOrd: Order) => {
    // Optimistically update orders in state so the card animates out immediately
    setOrders((prev) =>
      prev.map((ord) =>
        ord.id === completedOrd.id
          ? {
              ...ord,
              status: 'completed' as OrderStatus,
              access_code: null,
              completed_at: new Date().toISOString(),
            }
          : ord
      )
    );
    setSelectedOrderIds((prev) => prev.filter((id) => id !== completedOrd.id));

    const pinLabel = completedOrd.access_code ? ` (PIN ${completedOrd.access_code})` : '';
    setToastMessage(
      `✓ Pickup verified! Order for ${completedOrd.customer_name || 'Customer'}${pinLabel} marked Completed & Handed Over!`
    );
    setTimeout(() => setToastMessage(null), 4500);
  };

  const queuedOrders = orders.filter((o) => o.status === 'queued');
  const grindingOrders = orders.filter((o) => o.status === 'grinding');
  const readyOrders = orders.filter((o) => o.status === 'ready');
  const completedOrders = orders.filter((o) => o.status === 'completed');
  const activeOrders = orders.filter((o) => o.status !== 'completed');

  const displayedOrders =
    activeTab === 'all_active'
      ? activeOrders
      : activeTab === 'queued'
      ? queuedOrders
      : activeTab === 'grinding'
      ? grindingOrders
      : activeTab === 'ready'
      ? readyOrders
      : completedOrders;

  // Selected batch statistics
  const selectedOrders = orders.filter((o) => selectedOrderIds.includes(o.id));
  const totalBatchWeight = selectedOrders.reduce((sum, o) => sum + Number(o.weight_kg), 0);

  const currency = settings?.currency || 'Rs.';
  const currentRate =
    settings?.rate_per_kg !== undefined && settings?.rate_per_kg !== null
      ? Number(settings.rate_per_kg)
      : null;
  const displayRate =
    currentRate !== null
      ? Number.isInteger(currentRate)
        ? currentRate.toString()
        : currentRate.toFixed(2)
      : null;
  const shopStatus = useShopOperatingStatus(settings);

  return (
    <div className="min-h-screen bg-[#faf8f5] flex flex-col justify-between pb-24 w-full overflow-x-hidden">
      {/* Top Header - Clean, Modern Admin Navbar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200/90 shadow-2xs px-3 sm:px-6 py-2.5 sm:py-3 w-full">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2 sm:gap-4 min-w-0">
          {/* Left: Brand Identity with Live Status Indicator */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-sm shadow-amber-500/20 shrink-0">
              <Wheat className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-sm sm:text-lg font-black text-stone-900 tracking-tight leading-tight truncate">
                  {settings?.shop_name || 'Chakki Fresh'}
                </h1>
                <span className="text-[9px] sm:text-[10px] font-black uppercase bg-stone-900 text-white px-1.5 sm:px-2 py-0.5 rounded-md tracking-wider shrink-0 shadow-2xs">
                  Admin
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-stone-500 font-medium min-w-0">
                <span className="flex items-center gap-1.5 min-w-0 truncate">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      shopStatus.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                    }`}
                  />
                  <span className={`font-bold shrink-0 ${shopStatus.isOpen ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {shopStatus.isOpen
                      ? 'Open'
                      : shopStatus.isBreakActive
                      ? 'Break'
                      : 'Closed'}
                  </span>
                  <span className="text-stone-400 whitespace-nowrap">
                    • {shopStatus.isOpen
                      ? `Closes ${formatTime12Hour(shopStatus.todaySchedule?.close)}`
                      : `Opens ${formatNextOpenShort(shopStatus.formattedNextOpen)}`}
                  </span>
                </span>
                {displayRate && (
                  <span className="hidden md:inline text-stone-400 truncate">
                    • Rate: {currency} {displayRate}/kg
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Sleek, Unified Toolbar Capsule */}
          <div className="flex items-center bg-stone-100/90 p-1 rounded-2xl border border-stone-200/80 shadow-2xs shrink-0">
            {/* Customer Storefront Link (Hidden on mobile for clean breathing room) */}
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center justify-center gap-1.5 text-xs font-bold text-stone-600 hover:text-stone-900 hover:bg-white px-2.5 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap"
              title="Open customer view in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5 text-stone-500" />
              <span>Storefront</span>
            </a>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={handleRefresh}
              className="p-1.5 sm:px-2.5 sm:py-1.5 text-stone-600 hover:text-stone-900 hover:bg-white rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 text-xs font-semibold"
              title="Refresh order pipeline"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-600' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Settings Link */}
            <Link
              href="/admin/settings"
              prefetch={true}
              className="p-1.5 sm:px-2.5 sm:py-1.5 text-stone-600 hover:text-amber-800 hover:bg-white rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 text-xs font-semibold"
              title="Shop Settings & Hours"
            >
              <SettingsIcon className="w-3.5 h-3.5 text-stone-600" />
              <span className="hidden sm:inline">Settings</span>
            </Link>
          </div>
        </div>
      </header>

      {/* High-Visibility Success Toast Alert */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-50 bg-stone-900/95 backdrop-blur-md text-white px-4 sm:px-6 py-3 rounded-2xl shadow-2xl border border-stone-700/80 flex items-center gap-2.5 text-xs sm:text-sm font-bold max-w-[92vw] sm:max-w-lg text-center"
          >
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="truncate">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main suppressHydrationWarning className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6 min-w-0">
        {/* Top Header: Pipeline Title & Primary Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 pb-1 min-w-0">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight truncate">
              Order Pipeline
            </h2>
            <p className="text-xs text-stone-500 font-medium mt-0.5 truncate hidden sm:block">
              Live wheat milling queue, counter slip generation & QR pickup
            </p>
          </div>

          {/* Action Buttons: Scan Pickup QR & New Order */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => setIsAdminScannerOpen(true)}
              className="w-full sm:w-auto py-2.5 px-3 sm:px-4 rounded-xl font-bold text-xs sm:text-sm text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 active:scale-95 transition flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer shadow-xs whitespace-nowrap"
              title="Scan customer pickup QR code to auto-complete"
            >
              <Camera className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Scan Pickup QR</span>
            </button>

            <button
              onClick={() => setIsNewOrderModalOpen(true)}
              className="w-full sm:w-auto py-2.5 px-3 sm:px-4 rounded-xl font-black text-xs sm:text-sm text-white bg-amber-600 hover:bg-amber-700 active:scale-95 transition shadow-md shadow-amber-600/20 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 stroke-[3] shrink-0" />
              <span>New Order</span>
            </button>
          </div>
        </div>

        {/* KPI Summary Cards (Clickable Quick Filters) */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 w-full min-w-0">
          <button
            type="button"
            onClick={() => setActiveTab('queued')}
            className={`text-left p-2.5 sm:p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group min-w-0 ${
              activeTab === 'queued'
                ? 'bg-amber-50/90 border-amber-300 ring-2 ring-amber-200 shadow-sm'
                : 'bg-white hover:bg-amber-50/40 border-stone-200/90 hover:border-amber-200 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between min-w-0">
              <span className="text-[11px] sm:text-xs font-bold text-amber-800 flex items-center gap-1 sm:gap-1.5 truncate">
                <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="truncate">In Queue</span>
              </span>
              <span className="text-[10px] text-stone-600 font-medium hidden sm:inline">
                Waiting
              </span>
            </div>
            <div className="mt-1.5 sm:mt-2 flex items-baseline gap-1 sm:gap-1.5 truncate">
              <span className="text-xl sm:text-3xl font-black text-stone-900 tracking-tight">
                {queuedOrders.length}
              </span>
              <span className="text-[11px] sm:text-xs text-stone-600 font-semibold">orders</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('grinding')}
            className={`text-left p-2.5 sm:p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group min-w-0 ${
              activeTab === 'grinding'
                ? 'bg-blue-50/90 border-blue-300 ring-2 ring-blue-200 shadow-sm'
                : 'bg-white hover:bg-blue-50/40 border-stone-200/90 hover:border-blue-200 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between min-w-0">
              <span className="text-[11px] sm:text-xs font-bold text-blue-800 flex items-center gap-1 sm:gap-1.5 truncate">
                <Flame className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="truncate">Grinding</span>
              </span>
              <span className="text-[10px] text-stone-600 font-medium hidden sm:inline">
                In Mill
              </span>
            </div>
            <div className="mt-1.5 sm:mt-2 flex items-baseline gap-1 sm:gap-1.5 truncate">
              <span className="text-xl sm:text-3xl font-black text-stone-900 tracking-tight">
                {grindingOrders.length}
              </span>
              <span className="text-[11px] sm:text-xs text-stone-600 font-semibold">orders</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ready')}
            className={`text-left p-2.5 sm:p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group min-w-0 ${
              activeTab === 'ready'
                ? 'bg-emerald-50/90 border-emerald-300 ring-2 ring-emerald-200 shadow-sm'
                : 'bg-white hover:bg-emerald-50/40 border-stone-200/90 hover:border-emerald-200 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between min-w-0">
              <span className="text-[11px] sm:text-xs font-bold text-emerald-800 flex items-center gap-1 sm:gap-1.5 truncate">
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">Ready</span>
              </span>
              <span className="text-[10px] text-stone-600 font-medium hidden sm:inline">
                At Counter
              </span>
            </div>
            <div className="mt-1.5 sm:mt-2 flex items-baseline gap-1 sm:gap-1.5 truncate">
              <span className="text-xl sm:text-3xl font-black text-stone-900 tracking-tight">
                {readyOrders.length}
              </span>
              <span className="text-[11px] sm:text-xs text-stone-600 font-semibold">orders</span>
            </div>
          </button>
        </div>

        {/* Generous Spacing Buffer & Divider before Tabs */}
        <div className="pt-2 sm:pt-4 space-y-4 w-full min-w-0">
          {/* Mobile Status Filter Navigation (Zero-scroll 2-tier segmented control) */}
          <div className="sm:hidden w-full border-b border-stone-200/80 pb-3">
            <div className="bg-stone-100/90 p-1.5 rounded-2xl border border-stone-200/70 shadow-2xs space-y-1.5 w-full">
              {/* Row 1: Macro Views (Active Orders vs Completed History) */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('all_active')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 min-w-0 ${
                    activeTab === 'all_active'
                      ? 'bg-white text-stone-900 shadow-xs ring-1 ring-stone-900/5'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-white/40'
                  }`}
                >
                  <span className="truncate">Active Orders</span>
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold shrink-0 transition-colors ${
                      activeTab === 'all_active'
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-200/80 text-stone-600'
                    }`}
                  >
                    {activeOrders.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('completed')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 min-w-0 ${
                    activeTab === 'completed'
                      ? 'bg-stone-800 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-white/40'
                  }`}
                >
                  <span className="truncate">Completed</span>
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold shrink-0 transition-colors ${
                      activeTab === 'completed'
                        ? 'bg-stone-700 text-stone-200'
                        : 'bg-stone-200/80 text-stone-600'
                    }`}
                  >
                    {completedOrders.length}
                  </span>
                </button>
              </div>

              {/* Row 2: Active Pipeline Stage Sub-filters */}
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('queued')}
                  className={`py-1.5 px-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 min-w-0 ${
                    activeTab === 'queued'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white/50 text-stone-600 hover:text-stone-900 hover:bg-white'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeTab === 'queued' ? 'bg-amber-200' : 'bg-amber-500'}`} />
                  <span className="truncate">Queue</span>
                  <span className={`text-[10px] font-bold shrink-0 ${activeTab === 'queued' ? 'text-amber-100' : 'text-stone-500'}`}>
                    ({queuedOrders.length})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('grinding')}
                  className={`py-1.5 px-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 min-w-0 ${
                    activeTab === 'grinding'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white/50 text-stone-600 hover:text-stone-900 hover:bg-white'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeTab === 'grinding' ? 'bg-blue-200' : 'bg-blue-500'}`} />
                  <span className="truncate">Grinding</span>
                  <span className={`text-[10px] font-bold shrink-0 ${activeTab === 'grinding' ? 'text-blue-100' : 'text-stone-500'}`}>
                    ({grindingOrders.length})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('ready')}
                  className={`py-1.5 px-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 min-w-0 ${
                    activeTab === 'ready'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white/50 text-stone-600 hover:text-stone-900 hover:bg-white'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeTab === 'ready' ? 'bg-emerald-200' : 'bg-emerald-500'}`} />
                  <span className="truncate">Ready</span>
                  <span className={`text-[10px] font-bold shrink-0 ${activeTab === 'ready' ? 'text-emerald-100' : 'text-stone-500'}`}>
                    ({readyOrders.length})
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Desktop Segmented Filter Navigation Tabs (Unchanged for >= sm / Desktop) */}
          <div className="hidden sm:block w-full border-b border-stone-200/80 pb-3 overflow-x-auto no-scrollbar">
            <div className="bg-stone-100/90 p-1 rounded-2xl border border-stone-200/70 inline-flex items-center gap-1 shadow-2xs min-w-max">
              <button
                type="button"
                onClick={() => setActiveTab('all_active')}
                className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  activeTab === 'all_active'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Active Orders ({activeOrders.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('queued')}
                className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  activeTab === 'queued'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                In Queue ({queuedOrders.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('grinding')}
                className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  activeTab === 'grinding'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Grinding ({grindingOrders.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('ready')}
                className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  activeTab === 'ready'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Ready ({readyOrders.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('completed')}
                className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  activeTab === 'completed'
                    ? 'bg-stone-800 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Completed ({completedOrders.length})
              </button>
            </div>
          </div>

          {/* Smart Batch Selection Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 pb-1 w-full min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap text-xs">
              {queuedOrders.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllInQueue}
                  className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition cursor-pointer text-xs"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Select All In Queue ({queuedOrders.length})</span>
                </button>
              )}

              {grindingOrders.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllGrinding}
                  className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl font-bold bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 transition cursor-pointer text-xs"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Select All Grinding ({grindingOrders.length})</span>
                </button>
              )}

              {readyOrders.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllReady}
                  className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 transition cursor-pointer text-xs"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Select All Ready ({readyOrders.length})</span>
                </button>
              )}

              {selectedOrderIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-semibold text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition cursor-pointer text-xs"
                >
                  <X className="w-3.5 h-3.5 shrink-0" />
                  <span>Deselect All</span>
                </button>
              )}
            </div>

            <span className="text-[11px] text-stone-500 font-medium truncate">
              {selectedStatus ? `Selecting ${selectedStatus.toUpperCase()} bags only` : 'Select one status type at a time'}
            </span>
          </div>
        </div>

        {/* Orders List */}
        <section className="space-y-3">
          {loading ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-stone-200 space-y-3">
              <Loader2 className="w-7 h-7 animate-spin text-amber-600 mx-auto" />
              <p className="text-xs font-semibold text-stone-500">Loading orders...</p>
            </div>
          ) : displayedOrders.length > 0 ? (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {displayedOrders.map((order) => (
                  <AdminOrderCard
                    key={order.id}
                    order={order}
                    currency={currency}
                    isSelected={selectedOrderIds.includes(order.id)}
                    selectionDisabled={!!selectedStatus && order.status !== selectedStatus}
                    onToggleSelect={handleToggleSelect}
                    onUpdateStatus={handleUpdateStatus}
                    onTogglePayment={handleTogglePayment}
                    onUpdateRate={handleUpdateOrderRate}
                    onViewSlip={(ord) => {
                      setSelectedReceiptOrder(ord);
                      setIsReceiptModalOpen(true);
                    }}
                    onDeleteOrder={handleDeleteOrder}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="p-10 text-center bg-white rounded-3xl border border-dashed border-stone-300 space-y-2">
              <p className="font-bold text-stone-800 text-sm">No orders in this list</p>
              <p className="text-xs text-stone-500">
                Click "+ New Order" to register incoming wheat at the counter.
              </p>
            </div>
          )}
        </section>
      </main>

      {/* Floating Sticky Batch Action Bar - STRICTLY FORWARD TRANSITIONS ONLY! */}
      <AnimatePresence>
        {selectedOrderIds.length > 0 && selectedStatus && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-2xl bg-stone-900 text-white rounded-3xl p-4 sm:px-6 shadow-2xl border border-stone-700 flex flex-col sm:flex-row items-center justify-between gap-3"
          >
            {/* Batch Info */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-amber-500 text-stone-950 font-black text-xs flex items-center justify-center">
                  {selectedOrderIds.length}
                </span>
                <div>
                  <span className="block text-xs font-extrabold text-white">
                    {selectedOrderIds.length} {selectedOrderIds.length === 1 ? 'Bag' : 'Bags'} Selected ({selectedStatus.toUpperCase()})
                  </span>
                  <span className="block text-[11px] text-amber-300 font-bold">
                    {formatWeight(totalBatchWeight)} Total Batch
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClearSelection}
                className="text-stone-400 hover:text-white p-1 rounded-lg hover:bg-stone-800 transition cursor-pointer"
                title="Deselect all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Batch Action Buttons - DYNAMICALLY STRICTLY RELEVANT TO CURRENT STATUS */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {/* 1. If QUEUED orders are selected -> ONLY allow moving to GRINDING */}
              {selectedStatus === 'queued' && (
                <button
                  type="button"
                  onClick={() => handleBulkUpdateStatus('grinding')}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Start grinding selected queued bags"
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Start Grinding Batch ({selectedOrderIds.length})</span>
                </button>
              )}

              {/* 2. If GRINDING orders are selected -> ONLY allow moving to READY */}
              {selectedStatus === 'grinding' && (
                <button
                  type="button"
                  onClick={() => handleBulkUpdateStatus('ready')}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Mark all grinding bags as Ready for Pickup"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Mark Batch Ready ({selectedOrderIds.length})</span>
                </button>
              )}

              {/* 3. If READY orders are selected -> ONLY allow completing them! NO REVERSION TO GRINDING! */}
              {selectedStatus === 'ready' && (
                <button
                  type="button"
                  onClick={() => handleBulkUpdateStatus('completed')}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs bg-stone-800 hover:bg-black text-white border border-stone-600 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Hand over all ready bags to customers"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Complete & Handover Batch ({selectedOrderIds.length})</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <NewOrderModal
        isOpen={isNewOrderModalOpen}
        onClose={() => setIsNewOrderModalOpen(false)}
        settings={settings}
        onOrderCreated={handleOrderCreated}
      />

      <TokenReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        order={selectedReceiptOrder}
        settings={settings}
      />

      <AdminQRScannerModal
        isOpen={isAdminScannerOpen}
        onClose={() => setIsAdminScannerOpen(false)}
        onOrderCompleted={handleAutoCompletedFromQR}
        currency={currency}
      />
    </div>
  );
}
