import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Filter,
  Users,
  Briefcase,
  Stamp,
  Smartphone,
  Truck,
  DollarSign,
  AlertTriangle,
  Landmark,
  Calendar,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { masterEmployeeService } from '../../services/masterEmployeeService';
import { DbEmployeeMaster } from '../../types/database';

interface OperationalReportsViewProps {
  lang?: 'EN' | 'AR';
}

export const OperationalReportsView: React.FC<OperationalReportsViewProps> = ({ lang = 'EN' }) => {
  const [employees, setEmployees] = useState<DbEmployeeMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<
    | 'HEADCOUNT_PROJECT'
    | 'HEADCOUNT_STATUS'
    | 'PASSPORT_CUSTODY'
    | 'SIM_ASSIGNMENT'
    | 'VEHICLE_ASSIGNMENT'
    | 'TRAFFIC_FINES'
    | 'PAYROLL_SUMMARY'
    | 'LOAN_BALANCES'
  >('HEADCOUNT_PROJECT');

  const [filterBranch, setFilterBranch] = useState('All');
  const [filterProject, setFilterProject] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    masterEmployeeService.getMasterEmployees().then((data) => {
      setEmployees(data);
      setLoading(false);
    });
  }, []);

  const downloadCsv = (filename: string, rows: Array<Record<string, any>>) => {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]).join(',');
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers, ...rows.map((r) => Object.values(r).map((v) => `"${v}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered rows for reports
  const filteredEmployees = employees.filter((e) => {
    const matchBranch = filterBranch === 'All' || (e.branch_name || '').includes(filterBranch);
    const projectName = e.project_name || e.current_project_name || '';
    const matchProject = filterProject === 'All' || projectName.includes(filterProject);
    const eid = e.emirates_id_number || e.emirates_id || '';
    const matchSearch =
      !searchTerm ||
      (e.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.employee_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      eid.toLowerCase().includes(searchTerm.toLowerCase());
    return matchBranch && matchProject && matchSearch;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              Operational Reporting
            </span>
          </div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            Enterprise Operations & Compliance Reports
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Practical audit-ready reports with real-time field filters and instant CSV export.
          </p>
        </div>

        <button
          onClick={() => {
            const reportName = selectedReport.toLowerCase();
            const exportData = filteredEmployees.map((e) => ({
              'Employee Code': e.employee_code,
              'Full Name': e.full_name,
              'Emirates ID': e.emirates_id_number || e.emirates_id || 'N/A',
              'Current Project': e.project_name || e.current_project_name || 'N/A',
              'Status': e.current_status || e.status || 'Active',
              'Bike Plate': e.current_bike_plate || 'N/A',
              'SIM Number': e.current_sim_number || 'N/A',
              'Passport Status': e.passport_custody_status || e.passport_status || 'WITH_COMPANY',
            }));
            downloadCsv(reportName, exportData);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-xs shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export CSV Report</span>
        </button>
      </div>

      {/* Report Selector Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold">
        {[
          { id: 'HEADCOUNT_PROJECT', label: 'Headcount by Project', icon: Briefcase },
          { id: 'HEADCOUNT_STATUS', label: 'Headcount by Status', icon: Users },
          { id: 'PASSPORT_CUSTODY', label: 'Passport Custody & Expiry', icon: Stamp },
          { id: 'SIM_ASSIGNMENT', label: 'SIM Inventory & Allocation', icon: Smartphone },
          { id: 'VEHICLE_ASSIGNMENT', label: 'Vehicle Fleet & Mulkiya', icon: Truck },
          { id: 'TRAFFIC_FINES', label: 'Traffic Fines & Deductions', icon: AlertTriangle },
          { id: 'PAYROLL_SUMMARY', label: 'Split Payroll Summary', icon: DollarSign },
          { id: 'LOAN_BALANCES', label: 'Active Loan Balances', icon: Landmark },
        ].map((item) => {
          const Icon = item.icon;
          const isSelected = selectedReport === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setSelectedReport(item.id as any)}
              className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                isSelected
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0 text-blue-500" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center gap-3 text-xs">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search report records..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-bold uppercase text-[10px]">Project:</span>
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-hidden"
          >
            <option value="All">All Projects</option>
            <option value="Talabat">Talabat Dubai Hub</option>
            <option value="Keeta">Keeta Delivery Hub</option>
            <option value="Careem">Careem Express</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-bold uppercase text-[10px]">Branch:</span>
          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-hidden"
          >
            <option value="All">All Branches</option>
            <option value="Dubai">Dubai Central</option>
            <option value="Abu Dhabi">Abu Dhabi North</option>
            <option value="Sharjah">Sharjah Hub</option>
          </select>
        </div>
      </div>

      {/* Report Table Display */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
          <span>{filteredEmployees.length} Records Matching Criteria</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Emirates ID</th>
                <th className="py-3 px-4">Project</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Bike Plate</th>
                <th className="py-3 px-4">SIM Number</th>
                <th className="py-3 px-4">Passport</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                    <div>{emp.full_name}</div>
                    <div className="text-[10px] text-slate-400 font-mono font-normal">{emp.employee_code}</div>
                  </td>
                  <td className="py-3 px-4 font-mono">{emp.emirates_id_number || emp.emirates_id || 'N/A'}</td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {emp.project_name || emp.current_project_name || 'Unassigned'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        (emp.current_status || emp.status) === 'Active' || (emp.current_status || emp.status) === 'Assigned'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {emp.current_status || emp.status || 'Active'}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono">{emp.current_bike_plate || '—'}</td>
                  <td className="py-3 px-4 font-mono">{emp.current_sim_number || '—'}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      Safe Custody
                    </span>
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
