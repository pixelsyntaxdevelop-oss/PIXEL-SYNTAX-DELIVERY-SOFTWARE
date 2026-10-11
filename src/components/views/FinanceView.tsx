import React from 'react';
import { DollarSign, TrendingUp, TrendingDown, CreditCard, PieChart, ArrowUpRight, ArrowDownRight, FileText } from 'lucide-react';
import { Badge } from '../common/Badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface FinanceViewProps {
  lang: 'EN' | 'AR';
}

const financialBreakdown = [
  { month: 'Apr 2026', softwareRevenue: 220000, fleetRevenue: 310000, expenses: 240000 },
  { month: 'May 2026', softwareRevenue: 245000, fleetRevenue: 340000, expenses: 255000 },
  { month: 'Jun 2026', softwareRevenue: 260000, fleetRevenue: 380000, expenses: 270000 },
  { month: 'Jul 2026', softwareRevenue: 285000, fleetRevenue: 420000, expenses: 285000 },
];

export const FinanceView: React.FC<FinanceViewProps> = ({ lang }) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-600" />
            {lang === 'EN' ? 'Enterprise Financials & Revenue Tracking' : 'المالية وتتبع الإيرادات'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {lang === 'EN'
              ? 'Combined SaaS software recurring revenue (MRR), delivery fleet fees, fuel/maintenance expense P&L, and margin analysis.'
              : 'الإيرادات البرمجية المتكررة، رسوم التوصيل، مصروفات الصيانة والوقود، وتحليلات الأرباح.'}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Total Monthly Revenue</span>
          <div className="text-3xl font-black text-slate-900 dark:text-white">$705,000</div>
          <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 mt-2"><ArrowUpRight className="w-4 h-4" /> +16.4% YoY Growth</span>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Fleet Operational OPEX</span>
          <div className="text-3xl font-black text-slate-900 dark:text-white">$285,000</div>
          <span className="text-xs text-slate-500 font-medium block mt-2">Fuel, Maintenance, Salaries</span>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Gross Profit Margin</span>
          <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">59.5%</div>
          <span className="text-xs text-emerald-600 font-semibold block mt-2">P&L Status: Highly Profitable</span>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <h3 className="font-extrabold text-slate-900 dark:text-white text-base mb-4">Software MRR vs Fleet Delivery Revenue</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={financialBreakdown}>
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }} />
              <Bar dataKey="softwareRevenue" name="Software SaaS Revenue" fill="#2563eb" radius={[6, 6, 0, 0]} />
              <Bar dataKey="fleetRevenue" name="Fleet Logistics Revenue" fill="#10b981" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expenses" name="Operating Expenses" fill="#f43f5e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
