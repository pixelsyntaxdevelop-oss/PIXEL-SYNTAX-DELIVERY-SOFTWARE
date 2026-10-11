import React, { useState } from 'react';
import {
  Code,
  Terminal,
  GitBranch,
  Bug,
  Zap,
  TrendingUp,
  DollarSign,
  Users,
  CheckCircle,
  Plus,
  ExternalLink,
  Cpu,
} from 'lucide-react';
import { SoftwareProject, SoftwareDeveloper } from '../../types/erp';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface SoftwareCompanyDashboardProps {
  projects: SoftwareProject[];
  developers: SoftwareDeveloper[];
  lang: 'EN' | 'AR';
}

const velocityData = [
  { sprint: 'Sprint 24', velocity: 34, bugsResolved: 18, mrr: 210000 },
  { sprint: 'Sprint 25', velocity: 38, bugsResolved: 22, mrr: 235000 },
  { sprint: 'Sprint 26', velocity: 41, bugsResolved: 25, mrr: 250000 },
  { sprint: 'Sprint 27', velocity: 42, bugsResolved: 29, mrr: 285000 },
];

export const SoftwareCompanyDashboard: React.FC<SoftwareCompanyDashboardProps> = ({
  projects,
  developers,
  lang,
}) => {
  const [selectedProject, setSelectedProject] = useState<SoftwareProject | null>(null);

  const totalMrr = projects.reduce((acc, p) => acc + p.mrrContribution, 0);
  const totalBilled = projects.reduce((acc, p) => acc + p.billedRevenue, 0);
  const totalOpenBugs = projects.reduce((acc, p) => acc + p.openBugs, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner / Headline */}
      <div className="p-6 bg-linear-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-2xl border border-blue-900/40 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="purple">Tech Division ERP</Badge>
            <span className="text-xs text-blue-300 font-mono">v4.8 Release Pipeline</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            {lang === 'EN' ? 'Software Engineering & SaaS Hub' : 'مركز الهندسة البرمجية والمنصات'}
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            {lang === 'EN'
              ? 'Real-time performance metrics for engineering teams, sprint velocity, code quality scores, SaaS monthly recurring revenue (MRR), and client deliverable timelines.'
              : 'مؤشرات الأداء المباشرة لفرق الهندسة، سرعة الإنجاز، أداء الكود، والإيرادات الشهرية المتكررة.'}
          </p>
        </div>

        <button className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all shrink-0">
          <Plus className="w-4 h-4" />
          {lang === 'EN' ? 'New Software Project' : 'مشروع برمجي جديد'}
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {lang === 'EN' ? 'SaaS Tech MRR' : 'الإيراد المتكرر للتقنية'}
            </span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">${totalMrr.toLocaleString()}</div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-2">
            <TrendingUp className="w-3.5 h-3.5" /> +14.2% {lang === 'EN' ? 'from last month' : 'مقارنة بالشهر الماضي'}
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {lang === 'EN' ? 'Total Billed Value' : 'إجمالي المبالغ المفلترة'}
            </span>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 rounded-xl">
              <Code className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">${totalBilled.toLocaleString()}</div>
          <div className="text-xs text-slate-500 mt-2 font-medium">
            {projects.length} {lang === 'EN' ? 'Active Enterprise Apps' : 'تطبيقات جارية'}
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {lang === 'EN' ? 'Sprint Velocity' : 'سرعة السبرينت'}
            </span>
            <div className="p-2 bg-purple-50 dark:bg-purple-950/50 text-purple-600 rounded-xl">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">42 pts / wk</div>
          <div className="text-xs text-purple-600 dark:text-purple-400 font-semibold mt-2">
            100% {lang === 'EN' ? 'CI/CD Pass Rate' : 'معدل نجاح الاختبارات'}
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {lang === 'EN' ? 'Open Production Bugs' : 'الأخطاء البرمجية المفتوحة'}
            </span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/50 text-amber-600 rounded-xl">
              <Bug className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{totalOpenBugs}</div>
          <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-2">
            {lang === 'EN' ? 'Avg Resolution: 2.4 Hours' : 'متوسط وقت الحل: 2.4 ساعة'}
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                {lang === 'EN' ? 'SaaS Revenue & Sprint Velocity Growth' : 'نمو إيرادات البرمجيات وسرعة السبرينت'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Monthly recurring revenue trajectory ($USD)</p>
            </div>
            <Badge variant="success">99.98% Uptime</Badge>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={velocityData}>
                <defs>
                  <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="sprint" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }} />
                <Area type="monotone" dataKey="mrr" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#mrrGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Developer Leaderboard */}
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col">
          <h3 className="font-extrabold text-slate-900 dark:text-white text-base mb-4 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-blue-500" />
            {lang === 'EN' ? 'Top Engineering Output' : 'أعلى كفاءة هندسية'}
          </h3>

          <div className="space-y-3 flex-1 overflow-y-auto">
            {developers.map((dev) => (
              <div
                key={dev.id}
                className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <img src={dev.avatarUrl} alt={dev.fullName} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">{dev.fullName}</h4>
                    <p className="text-[11px] text-slate-500 font-mono">{dev.role}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">
                    {dev.codeQualityScore}/100 Quality
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {dev.commitsThisWeek} commits
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Projects Timeline Table */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <h3 className="font-extrabold text-slate-900 dark:text-white text-base mb-4">
          {lang === 'EN' ? 'Active Enterprise Software Projects' : 'مشاريع البرمجيات النشطة'}
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="p-3">Project Name</th>
                <th className="p-3">Tech Stack</th>
                <th className="p-3">Progress</th>
                <th className="p-3">MRR</th>
                <th className="p-3">Team Lead</th>
                <th className="p-3">Status</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {projects.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-3 font-bold text-slate-900 dark:text-white">
                    {p.projectName}
                    <span className="block text-[10px] text-slate-500 font-normal">{p.clientName}</span>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {p.techStack.slice(0, 3).map((t, idx) => (
                        <span key={idx} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-sm font-mono text-[10px]">
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 min-w-[140px]">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div className="bg-blue-600 h-full rounded-full" style={{ width: `${p.progressPercent}%` }}></div>
                      </div>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{p.progressPercent}%</span>
                    </div>
                  </td>
                  <td className="p-3 font-bold text-emerald-600 dark:text-emerald-400">${p.mrrContribution.toLocaleString()}</td>
                  <td className="p-3 font-medium text-slate-700 dark:text-slate-300">{p.teamLead}</td>
                  <td className="p-3">
                    <Badge variant={p.status === 'COMPLETED' ? 'success' : 'info'}>{p.status}</Badge>
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => setSelectedProject(p)}
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-medium rounded-lg transition-colors flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" /> Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Project Detail Modal */}
      {selectedProject && (
        <Modal
          isOpen={!!selectedProject}
          onClose={() => setSelectedProject(null)}
          title={selectedProject.projectName}
          subtitle={`Client: ${selectedProject.clientName}`}
        >
          <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
            <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <div>
                <span className="text-slate-400 block font-medium">Budget Total</span>
                <span className="text-base font-bold text-slate-900 dark:text-white">${selectedProject.budgetTotal.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">MRR Contribution</span>
                <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">${selectedProject.mrrContribution.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Deadline</span>
                <span className="font-bold">{selectedProject.deadline}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Open Bugs</span>
                <span className="font-bold text-amber-500">{selectedProject.openBugs} Active Issues</span>
              </div>
            </div>

            <div>
              <h4 className="font-bold mb-1 text-slate-900 dark:text-white">Full Tech Architecture Stack</h4>
              <div className="flex flex-wrap gap-1.5">
                {selectedProject.techStack.map((tech, idx) => (
                  <span key={idx} className="px-2 py-1 bg-blue-50 dark:bg-slate-700 text-blue-700 dark:text-blue-300 rounded-md font-mono">
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
