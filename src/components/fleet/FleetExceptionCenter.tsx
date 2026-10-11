import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  Calendar,
  Wrench,
  Fuel,
  RefreshCw,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { FleetExceptionRecord } from '../../types/fleet';
import { fleetService } from '../../services/fleetService';

interface FleetExceptionCenterProps {
  onSelectVehicle: (vehicleId: string) => void;
  onRefresh?: () => void;
}

export const FleetExceptionCenter: React.FC<FleetExceptionCenterProps> = ({
  onSelectVehicle,
  onRefresh,
}) => {
  const [exceptions, setExceptions] = useState<FleetExceptionRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadExceptions();
  }, []);

  const loadExceptions = async () => {
    setLoading(true);
    try {
      const res = await fleetService.getExceptions();
      setExceptions(res);
    } catch (err) {
      console.error('Failed to load fleet exceptions:', err);
    } finally {
      setLoading(false);
    }
  };

  if (exceptions.length === 0 && !loading) {
    return null;
  }

  const getSeverityBadge = (severity: string) => {
    if (severity === 'CRITICAL') {
      return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-800 uppercase">Critical Action</span>;
    }
    return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 uppercase">Warning</span>;
  };

  const getIcon = (type: string) => {
    if (type.includes('MULKIYA') || type.includes('INSURANCE')) return <Calendar className="w-4 h-4 text-amber-600" />;
    if (type.includes('MAINTENANCE')) return <Wrench className="w-4 h-4 text-blue-600" />;
    if (type.includes('ACCIDENT')) return <ShieldAlert className="w-4 h-4 text-rose-600" />;
    if (type.includes('FUEL')) return <Fuel className="w-4 h-4 text-purple-600" />;
    return <AlertTriangle className="w-4 h-4 text-amber-600" />;
  };

  return (
    <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 shadow-xs mb-6">
      <div className="flex items-center justify-between pb-3 border-b border-amber-200/60 mb-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-amber-500 text-white">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-amber-950 uppercase tracking-wide">
              Fleet Operations Exception Radar ({exceptions.length} Active Items)
            </h3>
            <p className="text-[11px] text-amber-800">
              Immediate compliance, safety, and service actions requiring dispatcher resolution.
            </p>
          </div>
        </div>

        <button
          onClick={loadExceptions}
          className="p-1 text-amber-800 hover:bg-amber-200 rounded-lg transition-colors"
          title="Refresh exceptions"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {exceptions.slice(0, 6).map((exc) => (
          <div
            key={exc.id}
            onClick={() => onSelectVehicle(exc.vehicle_id)}
            className="bg-white p-3 rounded-xl border border-amber-200/80 shadow-xs hover:border-blue-400 hover:shadow-sm cursor-pointer transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center space-x-1.5">
                  {getIcon(exc.exception_type)}
                  <span className="font-bold text-xs text-slate-900">{exc.vehicle_plate}</span>
                </div>
                {getSeverityBadge(exc.severity)}
              </div>
              <h4 className="text-xs font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                {exc.title}
              </h4>
              <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                {exc.message}
              </p>
            </div>

            <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="font-semibold text-blue-600 flex items-center space-x-0.5">
                <span>{exc.action_label || 'View 360 Profile'}</span>
                <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
