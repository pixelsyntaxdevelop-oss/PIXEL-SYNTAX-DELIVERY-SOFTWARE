import React, { useState } from 'react';
import {
  MapPin,
  Play,
  Pause,
  RotateCcw,
  Shield,
  Zap,
  Activity,
  Layers,
  Compass,
  AlertTriangle,
} from 'lucide-react';
import { RiderDriver, GeofenceZone } from '../../types/erp';
import { Badge } from '../common/Badge';

interface GpsTrackingViewProps {
  riders: RiderDriver[];
  geofences: GeofenceZone[];
  lang: 'EN' | 'AR';
}

export const GpsTrackingView: React.FC<GpsTrackingViewProps> = ({ riders, geofences, lang }) => {
  const [isPlayingReplay, setIsPlayingReplay] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState<number>(1);
  const [selectedRiderId, setSelectedRiderId] = useState<string>(riders[0]?.id || '');

  const activeRider = riders.find((r) => r.id === selectedRiderId) || riders[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-6 h-6 text-emerald-600" />
            {lang === 'EN' ? 'GPS Telematics, Route Replay & Geofence Hub' : 'التتبع الجغرافي والإعادة والجغرافية الذكية'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {lang === 'EN'
              ? 'Real-time GPS coordinates, historical route playback, speed violation monitoring, and restricted zone geofences.'
              : 'إحداثيات التتبع المباشر، إعادة تشغيل المسارات، مراقبة تجاوز السرعة، والمناطق الجغرافية المحددة.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlayingReplay(!isPlayingReplay)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
          >
            {isPlayingReplay ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isPlayingReplay ? 'Pause Route Replay' : 'Play Historical Route'}
          </button>
        </div>
      </div>

      {/* Main Map & Telematics Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Simulator Box */}
        <div className="lg:col-span-2 p-6 bg-slate-950 text-white rounded-2xl border border-slate-800 shadow-2xl relative min-h-[420px] flex flex-col justify-between overflow-hidden">
          {/* Simulated Map Visual Canvas Background */}
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40"></div>

          {/* Map Top Bar */}
          <div className="relative z-10 flex items-center justify-between bg-slate-900/90 backdrop-blur-md p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> Live GPS Stream
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-xs text-slate-300 font-mono">Center: Dubai DIFC & Downtown</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setReplaySpeed(replaySpeed === 1 ? 2 : replaySpeed === 2 ? 4 : 1)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-mono font-bold rounded-lg border border-slate-700"
              >
                {replaySpeed}x Speed
              </button>
            </div>
          </div>

          {/* Interactive Simulated Marker Plot */}
          <div className="relative z-10 my-auto py-8 grid grid-cols-2 sm:grid-cols-3 gap-4">
            {riders.map((r, idx) => (
              <div
                key={r.id}
                onClick={() => setSelectedRiderId(r.id)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  r.id === selectedRiderId
                    ? 'bg-blue-600/30 border-blue-500 shadow-lg shadow-blue-500/20'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-white truncate">{r.fullName}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                </div>
                <p className="text-[10px] text-slate-400 font-mono truncate">{r.currentLocation?.address}</p>
                <div className="mt-2 text-[10px] font-mono font-bold text-blue-400">
                  Speed: 42 km/h • Lat: {r.currentLocation?.lat}
                </div>
              </div>
            ))}
          </div>

          {/* Route Replay Control Slider */}
          <div className="relative z-10 bg-slate-900/90 backdrop-blur-md p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs font-mono text-slate-300">
              <span>08:00 AM (Start)</span>
              <span className="text-emerald-400 font-bold">11:45 AM (Current Replay Frame)</span>
              <span>06:00 PM (End)</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              defaultValue="45"
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Geofence Zone Manager Sidebar */}
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h3 className="font-extrabold text-slate-900 dark:text-white text-base flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            {lang === 'EN' ? 'Geofence Zones & Limits' : 'المناطق الجغرافية المحددة'}
          </h3>

          <div className="space-y-3">
            {geofences.map((zone) => (
              <div
                key={zone.id}
                className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-slate-900 dark:text-white">{zone.name}</span>
                  <Badge variant={zone.type === 'DELIVERY_ZONE' ? 'info' : 'warning'}>{zone.type}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                  <div>
                    <span className="block text-slate-400">Radius:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{zone.radiusMeters} meters</span>
                  </div>
                  <div>
                    <span className="block text-slate-400">Speed Cap:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">{zone.speedLimitKmh} km/h</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
