import React, { useState } from 'react';
import {
  Navigation,
  Sparkles,
  Search,
  Plus,
  Clock,
  MapPin,
  UserCheck,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Send,
} from 'lucide-react';
import { OrderDispatch, RiderDriver } from '../../types/erp';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';

interface DispatchOrdersViewProps {
  orders: OrderDispatch[];
  riders: RiderDriver[];
  onAssignRider: (orderId: string, riderId: string) => void;
  onRunAiAutoDispatch: () => void;
  lang: 'EN' | 'AR';
}

export const DispatchOrdersView: React.FC<DispatchOrdersViewProps> = ({
  orders,
  riders,
  onAssignRider,
  onRunAiAutoDispatch,
  lang,
}) => {
  const [selectedOrder, setSelectedOrder] = useState<OrderDispatch | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [assignRiderId, setAssignRiderId] = useState<string>('');

  const filteredOrders = orders.filter((o) => filterStatus === 'ALL' || o.status === filterStatus);

  const handleManualAssign = () => {
    if (selectedOrder && assignRiderId) {
      onAssignRider(selectedOrder.id, assignRiderId);
      setSelectedOrder(null);
      setAssignRiderId('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Navigation className="w-6 h-6 text-blue-600" />
            {lang === 'EN' ? 'Live Dispatch & Order Management Hub' : 'مركز التوزيع والتوجيه المباشر'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {lang === 'EN'
              ? 'Real-time order dispatching, AI cluster optimization, ETA distance calculation, rider assignment, and delay resolution.'
              : 'التوجيه المباشر للطلبات، التجميع الذكي بالذكاء الاصطناعي، توقيت الوصول، وإسناد المناديب.'}
          </p>
        </div>

        <button
          onClick={onRunAiAutoDispatch}
          className="px-4 py-2.5 bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          {lang === 'EN' ? 'Run AI Auto-Dispatch Engine' : 'تشغيل محرك التوزيع الذكي'}
        </button>
      </div>

      {/* Filter Pills */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-2 overflow-x-auto">
        {['ALL', 'PENDING', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'DELAYED'].map((st) => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              filterStatus === st
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Orders List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider font-semibold bg-slate-50/50 dark:bg-slate-800/30">
                <th className="p-4">Order Number</th>
                <th className="p-4">Merchant & Customer</th>
                <th className="p-4">Addresses</th>
                <th className="p-4">Distance / Fee</th>
                <th className="p-4">Rider Assigned</th>
                <th className="p-4">Priority</th>
                <th className="p-4">Status</th>
                <th className="p-4">Dispatch Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredOrders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-4 font-bold text-slate-900 dark:text-white font-mono">{o.orderNumber}</td>
                  <td className="p-4">
                    <span className="font-extrabold text-slate-900 dark:text-white block">{o.merchantName}</span>
                    <span className="text-[11px] text-slate-500">Cust: {o.customerName} ({o.customerPhone})</span>
                  </td>
                  <td className="p-4 max-w-xs">
                    <div className="space-y-0.5">
                      <span className="text-[11px] text-slate-600 dark:text-slate-300 block truncate font-medium">📍 {o.pickupAddress}</span>
                      <span className="text-[11px] text-blue-600 dark:text-blue-400 block truncate font-medium">➔ {o.deliveryAddress}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="font-mono font-bold block text-slate-800 dark:text-slate-200">{o.distanceKm} km ({o.estimatedTimeMin}m)</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">Fee: AED {o.deliveryFee}</span>
                  </td>
                  <td className="p-4">
                    {o.assignedRiderName ? (
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">{o.assignedRiderName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{o.assignedVehiclePlate}</span>
                      </div>
                    ) : (
                      <span className="px-2 py-1 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-md font-bold text-[10px]">
                        Unassigned
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <Badge variant={o.priority === 'CRITICAL' ? 'danger' : o.priority === 'EXPRESS' ? 'warning' : 'default'}>
                      {o.priority}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <Badge variant={o.status === 'IN_TRANSIT' ? 'info' : o.status === 'DELIVERED' ? 'success' : 'warning'}>
                      {o.status}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => setSelectedOrder(o)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      {o.assignedRiderId ? 'Reassign' : 'Assign Rider'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Assignment Modal */}
      {selectedOrder && (
        <Modal
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          title={`Assign Rider to Order #${selectedOrder.orderNumber}`}
          subtitle={`Pickup: ${selectedOrder.pickupAddress}`}
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Select Active Online Rider</label>
              <select
                value={assignRiderId}
                onChange={(e) => setAssignRiderId(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 p-3 rounded-xl border border-slate-200 dark:border-slate-700 font-bold"
              >
                <option value="">-- Choose Available Rider --</option>
                {riders.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.fullName} ({r.code}) - {r.status} - Rating: {r.rating}⭐
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-200">
              <span className="font-bold block mb-0.5">AI Dispatch Recommendation:</span>
              <span>Hamza Al-Mansi (RDR-001) is 1.2 km away from pickup point with 18m ETA.</span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleManualAssign}
                disabled={!assignRiderId}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl disabled:opacity-50"
              >
                Confirm Dispatch
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
