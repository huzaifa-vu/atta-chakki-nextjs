'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Order, OrderStatus, ShopSettings } from '@/types/database';
import AdminOrderCard from '@/components/admin/AdminOrderCard';
import NewOrderModal from '@/components/admin/NewOrderModal';
import TokenReceiptModal from '@/components/admin/TokenReceiptModal';
import AdminQRScannerModal from '@/components/admin/AdminQRScannerModal';
import { formatWeight } from '@/lib/utils';
import { useShopOperatingStatus } from '@/lib/utils/shopHours';
import {
  Wheat,
  Plus,
  Settings as SettingsIcon,
  LogOut,
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
        .eq('id', orderId);

      if (error) throw error;
    } catch (e) {
      console.error('Failed to update status', e);
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/admin/login');
  };

  const handleOrderCreated = (newOrder: Order) => {
    setIsNewOrderModalOpen(false);
    setSelectedReceiptOrder(newOrder);
    setIsReceiptModalOpen(true);
  };

  const handleAutoCompletedFromQR = (completedOrd: Order) => {
    setToastMessage(`✓ Pickup verified! Order for ${completedOrd.customer_name || 'Customer'} marked Completed & Handed Over!`);
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
  const currentRate = settings?.rate_per_kg || 15;
  const shopStatus = useShopOperatingStatus(settings);

  return (
    <div className="min-h-screen bg-[#faf8f5] flex flex-col justify-between pb-24">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-stone-200 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-sm">
              <Wheat className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-extrabold text-stone-900 tracking-tight">
                  {settings?.shop_name || 'Chakki Fresh'}
                </h1>
                <span className="text-[10px] font-bold uppercase bg-stone-100 text-stone-600 px-2 py-0.5 rounded-md">
                  Admin
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    shopStatus.isOpen
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      shopStatus.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                    }`}
                  />
                  <span>{shopStatus.isOpen ? 'Open' : 'Closed'}</span>
                </span>
              </div>
              <p className="text-[11px] text-stone-500">
                Rate: {currency} {Number(currentRate).toFixed(0)}/kg • Hours: {shopStatus.formattedHours}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="p-2 text-stone-500 hover:text-stone-800 rounded-xl hover:bg-stone-100 transition cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => router.push('/admin/settings')}
              className="p-2 text-stone-600 hover:text-stone-900 rounded-xl hover:bg-stone-100 transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
              title="Settings"
            >
              <SettingsIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </button>

            <button
              onClick={handleSignOut}
              className="p-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition flex items-center gap-1 text-xs font-semibold cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main suppressHydrationWarning className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Top Header: Pipeline Title & Primary Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                Order Pipeline
              </h2>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
            <p className="text-xs text-stone-500 font-medium mt-0.5">
              Live wheat milling queue, counter slip generation & QR pickup
            </p>
          </div>

          {/* Action Buttons: Scan Pickup QR & New Order */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsAdminScannerOpen(true)}
              className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              title="Scan customer pickup QR code to auto-complete"
            >
              <Camera className="w-4 h-4 text-emerald-700" />
              <span>Scan Pickup QR</span>
            </button>

            <button
              onClick={() => setIsNewOrderModalOpen(true)}
              className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl font-black text-xs sm:text-sm text-white bg-amber-600 hover:bg-amber-700 active:scale-95 transition shadow-md shadow-amber-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>New Order</span>
            </button>
          </div>
        </div>

        {/* KPI Summary Cards (Clickable Quick Filters) */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('queued')}
            className={`text-left p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
              activeTab === 'queued'
                ? 'bg-amber-50/90 border-amber-300 ring-2 ring-amber-200 shadow-sm'
                : 'bg-white hover:bg-amber-50/40 border-stone-200/90 hover:border-amber-200 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                In Queue
              </span>
              <span className="text-[10px] text-stone-600 font-medium hidden sm:inline">
                Waiting
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
                {queuedOrders.length}
              </span>
              <span className="text-xs text-stone-600 font-semibold">orders</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('grinding')}
            className={`text-left p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
              activeTab === 'grinding'
                ? 'bg-blue-50/90 border-blue-300 ring-2 ring-blue-200 shadow-sm'
                : 'bg-white hover:bg-blue-50/40 border-stone-200/90 hover:border-blue-200 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-800 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-blue-600" />
                Grinding
              </span>
              <span className="text-[10px] text-stone-600 font-medium hidden sm:inline">
                In Mill
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
                {grindingOrders.length}
              </span>
              <span className="text-xs text-stone-600 font-semibold">orders</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ready')}
            className={`text-left p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
              activeTab === 'ready'
                ? 'bg-emerald-50/90 border-emerald-300 ring-2 ring-emerald-200 shadow-sm'
                : 'bg-white hover:bg-emerald-50/40 border-stone-200/90 hover:border-emerald-200 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                Ready
              </span>
              <span className="text-[10px] text-stone-600 font-medium hidden sm:inline">
                At Counter
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
                {readyOrders.length}
              </span>
              <span className="text-xs text-stone-600 font-semibold">orders</span>
            </div>
          </button>
        </div>

        {/* Generous Spacing Buffer & Divider before Tabs */}
        <div className="pt-4 space-y-4">
          {/* Segmented Filter Navigation Tabs */}
          <div className="flex items-center justify-between gap-3 flex-wrap border-b border-stone-200/80 pb-3">
            <div className="bg-stone-100/90 p-1 rounded-2xl border border-stone-200/70 inline-flex items-center gap-1 overflow-x-auto max-w-full scrollbar-none shadow-2xs">
              <button
                onClick={() => setActiveTab('all_active')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  activeTab === 'all_active'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Active Orders ({activeOrders.length})
              </button>

              <button
                onClick={() => setActiveTab('queued')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  activeTab === 'queued'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                In Queue ({queuedOrders.length})
              </button>

              <button
                onClick={() => setActiveTab('grinding')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  activeTab === 'grinding'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Grinding ({grindingOrders.length})
              </button>

              <button
                onClick={() => setActiveTab('ready')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  activeTab === 'ready'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Ready ({readyOrders.length})
              </button>

              <button
                onClick={() => setActiveTab('completed')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
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
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 pb-1">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {queuedOrders.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllInQueue}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition cursor-pointer"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-amber-600" />
                  Select All In Queue ({queuedOrders.length})
                </button>
              )}

              {grindingOrders.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllGrinding}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 transition cursor-pointer"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                  Select All Grinding ({grindingOrders.length})
                </button>
              )}

              {readyOrders.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllReady}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 transition cursor-pointer"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                  Select All Ready ({readyOrders.length})
                </button>
              )}

              {selectedOrderIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-semibold text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  Deselect All
                </button>
              )}
            </div>

            <span className="text-[11px] text-stone-500 font-medium">
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
              <AnimatePresence>
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
