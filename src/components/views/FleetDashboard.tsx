import React from 'react';
import {
  Truck,
  Users,
  Navigation,
  Clock,
  DollarSign,
  AlertTriangle,
  FileWarning,
  TrendingUp,
  MapPin,
  CheckCircle2,
  Shield,
  Activity,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { RiderDriver, Vehicle, OrderDispatch, ExpiringDocumentAlert } from '../../types/erp';
import { Badge } from '../common/Badge';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface FleetDashboardProps {
  riders: RiderDriver[];
  vehicles: Vehicle[];
  orders: OrderDispatch[];
  alerts: ExpiringDocumentAlert[];
  lang: 'EN' | 'AR';
  onNavigateModule: (module: any) => void;
  onOpenAiAutoDispatch: () => void;
}

const hourlyDeliveryData = [
  { time: '08:00', orders: 42, revenue: 1420 },
  { time: '11:00', orders: 88, revenue: 3100 },
  { time: '14:00', orders: 135, revenue: 4890 },
  { time: '17:00', orders: 198, revenue: 7200 },
  { time: '20:00', orders: 245, revenue: 9800 },
  { time: '23:00', orders: 310, revenue: 12450 },
];

export const FleetDashboard: React.FC<FleetDashboardProps> = ({
  riders,
  vehicles,
  orders,
  alerts,
  lang,
  onNavigateModule,
  onOpenAiAutoDispatch,
}) => {
  const onlineRiders = riders.filter((r) => r.status === 'ONLINE' || r.status === 'DELIVERING').length;
  const offlineRiders = riders.filter((r) => r.status === 'OFFLINE').length;
  const activeOrdersCount = orders.filter((o) => o.status === 'IN_TRANSIT' || o.status === 'ASSIGNED').length;
  const delayedOrdersCount = orders.filter((o) => o.status === 'DELAYED' || Boolean(o.delayedReason)).length;
  const availableVehicles = vehicles.filter((v) => v.status === 'AVAILABLE' || v.status === 'IN_USE').length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 bg-linear-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl border border-blue-800/40 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="purple">Next-Gen Fleet ERP</Badge>
            <span className="text-xs text-blue-300 font-mono">Dubai & MENA Region</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            {lang === 'EN' ? 'Fleet Operations & Logistics Real-time Dashboard' : 'لوحة قيادة إدارة الأسطول واللوجستيات المباشرة'}
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            {lang === 'EN'
              ? 'Real-time telemetry, live driver dispatching, GPS route monitoring, document expiration compliance, and fuel maintenance tracking.'
              : 'التتبع المباشر للأسطول، توجيه المناديب، متابعة المسارات، صلاحية المستندات، ومصروفات الصيانة والوقود.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAiAutoDispatch}
            className="px-4 py-2.5 bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            {lang === 'EN' ? 'Run AI Auto-Dispatch' : 'تشغيل التوزيع الذكي (AI)'}
          </button>
        </div>
      </div>

      {/* Top Stats - Professional Polish Design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Riders Active */}
        <div
          onClick={() => onNavigateModule('riders_drivers')}
          className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col justify-between cursor-pointer hover:border-blue-500 transition-all"
        >
          <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Riders Active</p>
          <div className="flex items-end justify-between mt-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">
              {riders.length > 0 ? onlineRiders.toLocaleString() : 'No data available'}
            </span>
            {riders.length > 0 && (
              <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                {offlineRiders} offline
              </span>
            )}
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-blue-600 h-1.5 rounded-full"
              style={{ width: riders.length > 0 ? `${Math.round((onlineRiders / riders.length) * 100)}%` : '0%' }}
            ></div>
          </div>
        </div>

        {/* Card 2: Pending Orders */}
        <div
          onClick={() => onNavigateModule('dispatch_orders')}
          className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col justify-between cursor-pointer hover:border-orange-500 transition-all"
        >
          <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Pending Orders</p>
          <div className="flex items-end justify-between mt-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">
              {orders.length > 0 ? activeOrdersCount.toLocaleString() : 'No data available'}
            </span>
            {delayedOrdersCount > 0 && (
              <span className="text-[11px] text-orange-700 dark:text-orange-400 font-bold bg-orange-50 dark:bg-orange-950/60 px-2 py-0.5 rounded">
                {delayedOrdersCount} Delayed
              </span>
            )}
          </div>
          <div className="flex gap-1 mt-3">
            <div className={`h-1.5 flex-1 rounded-full ${delayedOrdersCount > 0 ? 'bg-red-500' : 'bg-slate-200 dark:bg-slate-800'}`}></div>
            <div className={`h-1.5 flex-1 rounded-full ${activeOrdersCount > 0 ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-800'}`}></div>
            <div className="h-1.5 flex-1 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
          </div>
        </div>

        {/* Card 3: Daily Revenue (Featured Blue Accent) */}
        <div
          onClick={() => onNavigateModule('finance')}
          className="bg-blue-600 text-white p-4 rounded-xl shadow-xs flex flex-col justify-between cursor-pointer hover:bg-blue-700 transition-all"
        >
          <p className="text-[11px] text-blue-200 uppercase font-bold tracking-wider">Daily Revenue</p>
          <div className="flex items-end justify-between mt-2">
            <span className="text-3xl font-bold text-white">
              {orders.length > 0 ? `AED ${orders.reduce((acc, o) => acc + (o.orderValue || 0), 0).toLocaleString()}` : 'AED 0.00'}
            </span>
            <span className="text-[11px] text-blue-100 font-bold px-2 py-0.5 bg-blue-500/50 rounded">
              {orders.length > 0 ? 'Live Sync' : 'No Data'}
            </span>
          </div>
          <div className="mt-3 text-[10px] text-blue-200 font-medium">
            {orders.length > 0 ? `${orders.length} orders dispatched` : 'No revenue records logged today'}
          </div>
        </div>

        {/* Card 4: Fleet Utilization */}
        <div
          onClick={() => onNavigateModule('vehicles_fleet')}
          className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col justify-between cursor-pointer hover:border-blue-500 transition-all"
        >
          <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Fleet Utilization</p>
          <div className="flex items-end justify-between mt-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">
              {vehicles.length > 0
                ? `${Math.round((vehicles.filter((v) => v.status === 'IN_USE').length / vehicles.length) * 100)}%`
                : 'No data available'}
            </span>
            {vehicles.length > 0 && (
              <span className="text-[11px] text-blue-700 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded">
                {vehicles.length} Vehicles
              </span>
            )}
          </div>
          <div className="mt-3 grid grid-cols-5 gap-1">
            <div className={`h-1 rounded ${vehicles.length > 0 ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-800'}`}></div>
            <div className={`h-1 rounded ${vehicles.filter((v) => v.status === 'IN_USE').length > 0 ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-800'}`}></div>
            <div className="h-1 bg-slate-200 dark:bg-slate-800 rounded"></div>
            <div className="h-1 bg-slate-200 dark:bg-slate-800 rounded"></div>
            <div className="h-1 bg-slate-200 dark:bg-slate-800 rounded"></div>
          </div>
        </div>
      </div>

      {/* Main Grid: Logistics Map & Right Column Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Live Logistics Network Map View (8 Columns) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden min-h-[420px]">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Live Logistics Network</h3>
            <div className="flex gap-2">
              <button className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold rounded hover:bg-slate-200 text-slate-700 dark:text-slate-300">
                EXPORT DATA
              </button>
              <button onClick={onOpenAiAutoDispatch} className="px-3 py-1 bg-blue-600 text-white text-[10px] font-bold rounded hover:bg-blue-700">
                AI OPTIMIZE ROUTES
              </button>
            </div>
          </div>

          {/* Map Simulation Workspace */}
          <div className="flex-1 bg-slate-950 relative min-h-[320px] p-4 flex flex-col justify-between overflow-hidden">
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px]"></div>

            {/* Radar / Markers */}
            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  GPS Satellite Telemetry Live
                </span>
                <span className="font-mono text-[10px]">Region: Dubai &amp; Northern Emirates</span>
              </div>

              {/* Active Nodes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {riders.length > 0 ? (
                  riders.slice(0, 3).map((r) => (
                    <div key={r.id} className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-lg text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-white">{r.fullName}</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">{r.currentLocation?.address || 'GPS Active'}</p>
                    </div>
                  ))
                ) : (
                  <div className="col-span-3 p-4 text-center text-xs text-slate-400 bg-slate-900/60 rounded-lg border border-slate-800">
                    No active GPS nodes currently transmitting telemetry.
                  </div>
                )}
              </div>
            </div>

            {/* Delay alert banner simulated on map */}
            {delayedOrdersCount > 0 ? (
              <div className="relative z-10 my-4 bg-red-950/80 border border-red-800/80 p-2.5 rounded-lg flex items-center justify-between text-xs text-red-200">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="font-bold">Alert: {delayedOrdersCount} Delayed Orders</span>
                  <span className="hidden sm:inline text-red-300 text-[11px]">- Action required in dispatch</span>
                </div>
                <button onClick={() => onNavigateModule('dispatch_orders')} className="text-[10px] font-bold text-white bg-red-800 hover:bg-red-700 px-2 py-1 rounded">
                  VIEW DISPATCH
                </button>
              </div>
            ) : null}

            {/* Bottom Floating Telematics Bar */}
            <div className="relative z-10 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg px-4 py-2.5 flex flex-wrap items-center gap-4 text-xs">
              <div><span className="text-slate-400 mr-1.5">TELEMETRY STATUS</span> <span className="font-bold text-white">{vehicles.length > 0 ? 'ONLINE' : 'STANDBY'}</span></div>
              <div><span className="text-slate-400 mr-1.5">VEHICLES LOGGED</span> <span className="font-bold text-white">{vehicles.length}</span></div>
              <div className="ml-auto flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> REAL-TIME SYNC ACTIVE
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Compliance Alerts & Top Performers (4 Columns) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Compliance & Alerts Box */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Compliance &amp; Alerts</h3>
            </div>
            <div className="p-3 space-y-2.5">
              {alerts && alerts.length > 0 ? (
                alerts.slice(0, 3).map((al) => (
                  <div key={al.id} className="p-3 bg-red-50 dark:bg-red-950/40 border-l-4 border-red-500 rounded">
                    <p className="text-[11px] font-bold text-red-800 dark:text-red-300">{al.documentType} ({al.daysUntilExpiry} days)</p>
                    <p className="text-[10px] text-red-600 dark:text-red-400">{al.entityName} - {al.entityType}</p>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400 italic">
                  No active compliance alerts or expiring documents
                </div>
              )}
            </div>
            <div className="p-3 text-center border-t border-slate-100 dark:border-slate-800 mt-auto">
              <button onClick={() => onNavigateModule('documents_vault')} className="text-[11px] text-blue-600 dark:text-blue-400 font-bold uppercase hover:underline">
                View All Reports
              </button>
            </div>
          </div>

          {/* Top Performers Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
            <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <h3 className="text-[11px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider">Top Performers</h3>
            </div>
            <div className="p-0">
              {riders && riders.length > 0 ? (
                <table className="w-full text-left">
                  <tbody>
                    {riders.slice(0, 3).map((r) => (
                      <tr key={r.id} className="text-xs border-b border-slate-100 dark:border-slate-800 last:border-0">
                        <td className="p-2.5 pl-4 flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 flex items-center justify-center font-bold text-xs">
                            {r.fullName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 dark:text-slate-200">{r.fullName}</p>
                            <p className="text-[10px] text-slate-400">{r.status}</p>
                          </div>
                        </td>
                        <td className="p-2.5 text-right pr-4">
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">Active</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400 italic">
                  No delivery performance data available
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts & Live Map Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Deliveries & Revenue Chart */}
        <div className="lg:col-span-2 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                {lang === 'EN' ? 'Today Order Deliveries & Fleet Revenue (AED)' : 'تسليمات اليوم والإيرادات'}
              </h3>
              <p className="text-xs text-slate-500">Hourly delivery throughput and total gross billings</p>
            </div>
            {orders.length > 0 && <Badge variant="success">Live Dispatch Sync</Badge>}
          </div>

          <div className="h-64">
            {orders.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyDeliveryData}>
                  <defs>
                    <linearGradient id="fleetRevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }} />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#fleetRevGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                <p className="font-semibold text-slate-600 dark:text-slate-300">No Delivery Activity Recorded Today</p>
                <p className="text-[11px] text-slate-400 mt-1">Dispatched orders and hourly revenues will populate here dynamically.</p>
              </div>
            )}
          </div>
        </div>

        {/* Live Mini Map Telematics Box */}
        <div className="p-6 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-400" /> Live GPS Map Simulation
              </span>
              <Badge variant="purple">Dubai & AUH</Badge>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 relative overflow-hidden">
              <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> Live GPS Signal
              </div>

              {riders.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-xs border-b border-slate-800/80 pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${r.status === 'DELIVERING' ? 'bg-blue-400' : 'bg-emerald-400'}`}></span>
                    <span className="font-bold text-slate-200">{r.fullName}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 truncate max-w-[140px] font-mono">{r.currentLocation?.address}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => onNavigateModule('gps_tracking')}
            className="w-full mt-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors"
          >
            {lang === 'EN' ? 'Open Full Interactive Map & Replay' : 'فتح الخريطة التفاعلية والمسارات'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Orders Dispatch Preview List */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
            {lang === 'EN' ? 'Real-time Active Order Dispatches' : 'الطلبات والمناديب المباشرة'}
          </h3>
          <button
            onClick={() => onNavigateModule('dispatch_orders')}
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            View All Dispatch Orders ({orders.length}) <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="p-3">Order ID</th>
                <th className="p-3">Merchant / Customer</th>
                <th className="p-3">Pickup → Delivery Address</th>
                <th className="p-3">Rider / Driver</th>
                <th className="p-3">Distance / ETA</th>
                <th className="p-3">Priority</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-3 font-bold text-slate-900 dark:text-white font-mono">{o.orderNumber}</td>
                  <td className="p-3">
                    <span className="font-bold block text-slate-800 dark:text-slate-200">{o.merchantName}</span>
                    <span className="text-[10px] text-slate-500">Cust: {o.customerName}</span>
                  </td>
                  <td className="p-3 max-w-xs">
                    <span className="text-[11px] text-slate-700 dark:text-slate-300 block truncate">{o.pickupAddress}</span>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium block truncate">➔ {o.deliveryAddress}</span>
                  </td>
                  <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                    {o.assignedRiderName || <span className="text-rose-500 font-normal">Unassigned</span>}
                  </td>
                  <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                    {o.distanceKm} km ({o.estimatedTimeMin} mins)
                  </td>
                  <td className="p-3">
                    <Badge variant={o.priority === 'CRITICAL' ? 'danger' : o.priority === 'EXPRESS' ? 'warning' : 'default'}>
                      {o.priority}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Badge variant={o.status === 'IN_TRANSIT' ? 'info' : o.status === 'DELIVERED' ? 'success' : 'warning'}>
                      {o.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
