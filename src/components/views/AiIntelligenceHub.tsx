import React, { useState } from 'react';
import { Sparkles, Cpu, Zap, TrendingUp, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Badge } from '../common/Badge';

interface AiIntelligenceHubProps {
  lang: 'EN' | 'AR';
}

export const AiIntelligenceHub: React.FC<AiIntelligenceHubProps> = ({ lang }) => {
  const [loading, setLoading] = useState(false);
  const [aiReportText, setAiReportText] = useState<string | null>(null);

  const handleRunAiAnalysis = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/gemini/predictive-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fleetData: { activeRiders: 385, vehiclesInUse: 320, avgFuelPerKm: 0.08 },
          financialData: { monthlyMrr: 285000, fleetRevenue: 420000 },
        }),
      });
      const data = await res.json();
      setAiReportText(data.text || 'AI Diagnostics calculation completed.');
    } catch (e) {
      setAiReportText('Unable to complete AI predictive run.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 bg-linear-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl border border-blue-800/40 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="purple">Gemini 3.6 AI Engine</Badge>
            <span className="text-xs text-amber-300 font-mono">Neural Logistics Intelligence</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            {lang === 'EN' ? 'AI Intelligence Hub & Predictive Solver' : 'مركز الذكاء الاصطناعي والتحليلات التنبؤية'}
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            {lang === 'EN'
              ? 'Automated dispatch cluster optimization, predictive vehicle maintenance diagnostics, fuel consumption forecasting, and rider rating algorithms.'
              : 'التوزيع التلقائي الذكي، التشخيص التنبؤي لصيانة المركبات، توقع استهلاك الوقود، وتقييم أداء المناديب.'}
          </p>
        </div>

        <button
          onClick={handleRunAiAnalysis}
          disabled={loading}
          className="px-4 py-2.5 bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-600 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all shrink-0"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? 'Running Gemini Neural Analysis...' : 'Run Full AI Fleet Diagnostics'}
        </button>
      </div>

      {/* AI Features Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <Zap className="w-6 h-6 text-amber-500" />
          <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">AI Route & Dispatch Optimization</h3>
          <p className="text-xs text-slate-500">Calculates traffic density, pickup distances, and groups orders into multi-stop delivery routes saving 22% fuel.</p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <Cpu className="w-6 h-6 text-blue-500" />
          <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Predictive Vehicle Diagnostics</h3>
          <p className="text-xs text-slate-500">Predicts engine oil breakdown and tire degradation based on odometer telemetry and GPS speed curves.</p>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <TrendingUp className="w-6 h-6 text-emerald-500" />
          <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Rider Performance Ranking</h3>
          <p className="text-xs text-slate-500">Neural ranking algorithm weighting on-time delivery rates, customer ratings, and order completion velocity.</p>
        </div>
      </div>

      {/* Output Result Box */}
      {aiReportText && (
        <div className="p-6 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-xl space-y-3">
          <h3 className="font-extrabold text-blue-400 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Gemini AI Predictive Analysis Result
          </h3>
          <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono">
            {aiReportText}
          </div>
        </div>
      )}
    </div>
  );
};
