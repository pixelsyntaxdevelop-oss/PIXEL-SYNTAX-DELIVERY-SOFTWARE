import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Printer,
  FileText,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Smartphone,
  User,
} from 'lucide-react';
import { apiClient } from '../../../services/apiClient';

interface SimUndertakingModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedEmployeeId?: string | null;
  preselectedSimNumber?: string | null;
}

export const SimUndertakingModal: React.FC<SimUndertakingModalProps> = ({
  isOpen,
  onClose,
  preselectedEmployeeId,
  preselectedSimNumber,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [assignedSimNumber, setAssignedSimNumber] = useState<string | null>(null);
  const [hasAssignedSim, setHasAssignedSim] = useState<boolean>(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize or reset when modal opens
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setSearchResults([]);
      setSelectedEmployee(null);
      setAssignedSimNumber(null);
      setHasAssignedSim(false);
      setGeneratedHtml('');
      setErrorMessage(null);
      return;
    }

    if (preselectedEmployeeId) {
      loadEmployeeDetails(preselectedEmployeeId);
    }
  }, [isOpen, preselectedEmployeeId]);

  // Autocomplete search (minimum 3 characters)
  useEffect(() => {
    if (searchTerm.trim().length < 3) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await apiClient.get<any>(
          `/api/erp/sims/undertaking/search-employees?q=${encodeURIComponent(searchTerm.trim())}`
        );
        if (res.data?.success && Array.isArray(res.data.employees)) {
          setSearchResults(res.data.employees);
        } else {
          setSearchResults([]);
        }
      } catch (err: any) {
        console.error('Failed to search employees:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadEmployeeDetails = async (empId: string) => {
    setIsLoadingDetails(true);
    setErrorMessage(null);
    setGeneratedHtml('');

    try {
      const res = await apiClient.get<any>(
        `/api/erp/sims/undertaking/employee-details?employee_id=${encodeURIComponent(empId)}`
      );

      if (res.data?.success && res.data.employee) {
        const emp = res.data.employee;
        setSelectedEmployee(emp);
        setHasAssignedSim(res.data.has_assigned_sim);
        setAssignedSimNumber(res.data.assigned_sim_number);

        if (!res.data.has_assigned_sim || !res.data.assigned_sim_number) {
          setErrorMessage('No SIM is currently assigned to this employee.');
        } else {
          // Auto-generate preview immediately for convenience
          generateUndertaking(emp.id);
        }
      } else {
        setErrorMessage(res.data?.error || 'Employee not found.');
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to load employee details.');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleSelectEmployee = (emp: any) => {
    setSearchTerm('');
    setSearchResults([]);
    setSelectedEmployee(emp);
    setHasAssignedSim(emp.has_assigned_sim);
    setAssignedSimNumber(emp.assigned_sim_number);
    setGeneratedHtml('');

    if (!emp.has_assigned_sim || !emp.assigned_sim_number) {
      setErrorMessage('No SIM is currently assigned to this employee.');
    } else {
      setErrorMessage(null);
      generateUndertaking(emp.id);
    }
  };

  const generateUndertaking = async (empId?: string) => {
    const idToUse = empId || selectedEmployee?.id;
    if (!idToUse) return;

    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const res = await apiClient.post<any>('/api/erp/sims/undertaking/generate', {
        employee_id: idToUse,
      });

      if (res.data?.success && res.data.html) {
        setGeneratedHtml(res.data.html);
      } else {
        setErrorMessage(res.data?.error || 'Failed to generate undertaking.');
      }
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.error || err.message || 'No SIM is currently assigned to this employee.'
      );
      setGeneratedHtml('');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    if (!generatedHtml) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Popup blocker prevented print window. Please allow popups.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>SIM Undertaking LT0020 - ${selectedEmployee?.full_name || 'Document'}</title>
          <style>
            @media print {
              body { margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
              @page { size: A4; margin: 15mm; }
              .no-print { display: none !important; }
            }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #fff; }
          </style>
        </head>
        <body>
          ${generatedHtml}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                SIM Undertaking Form
                <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-mono">
                  Forms Number: LT0020
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Official Pixel Syntax Delivery Software corporate SIM custody undertaking.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Employee Search & Selection Area */}
          <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/60 space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-600" />
              Select Employee (3-Character Live Search)
            </label>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Type at least 3 letters (Name, Code, Emirates ID, Passport, Mobile)..."
                className="w-full pl-9 pr-9 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {isSearching && (
                <RefreshCw className="w-3.5 h-3.5 absolute right-3 top-3 text-emerald-500 animate-spin" />
              )}

              {/* Autocomplete Results Dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-30 max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {searchResults.map((emp) => (
                    <div
                      key={emp.id}
                      onClick={() => handleSelectEmployee(emp)}
                      className="p-3 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer flex items-center justify-between text-xs transition-colors"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{emp.full_name}</span>
                          <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400">
                            [{emp.employee_code}]
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          EID: {emp.emirates_id} • Project: {emp.project_name}
                        </div>
                      </div>

                      <div className="text-right">
                        {emp.has_assigned_sim ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            <Smartphone className="w-3 h-3" />
                            {emp.assigned_sim_number}
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-rose-500">
                            No SIM Assigned
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Employee Summary Card */}
            {selectedEmployee && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                <div>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    {selectedEmployee.full_name}
                  </span>
                  <span className="ml-2 font-mono text-slate-500">
                    ({selectedEmployee.employee_code})
                  </span>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Identifier (EID / Passport): <b>{selectedEmployee.emirates_id || selectedEmployee.employee_identifier || 'N/A'}</b>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {hasAssignedSim && assignedSimNumber ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-lg border border-emerald-200 dark:border-emerald-800 font-bold">
                      <Smartphone className="w-4 h-4 text-emerald-600" />
                      <span>SIM: {assignedSimNumber}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 rounded-lg border border-rose-200 dark:border-rose-800 font-bold">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span>No SIM Assigned</span>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setSelectedEmployee(null);
                      setAssignedSimNumber(null);
                      setHasAssignedSim(false);
                      setGeneratedHtml('');
                      setErrorMessage(null);
                    }}
                    className="text-xs text-slate-400 hover:text-slate-600 underline"
                  >
                    Change
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Validation Warning Notice when No SIM is assigned */}
          {errorMessage && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-3 text-xs text-rose-900 dark:text-rose-200">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm text-rose-800 dark:text-rose-300">
                  {errorMessage}
                </h4>
                <p className="mt-1 text-rose-700 dark:text-rose-400">
                  As per company policy, a SIM Undertaking document cannot be generated for an employee without an active SIM card assignment. Please assign a SIM in SIM Management first.
                </p>
              </div>
            </div>
          )}

          {/* Document Preview Canvas */}
          {isLoadingDetails || isGenerating ? (
            <div className="py-24 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 mx-auto text-emerald-500 animate-spin mb-3" />
              <p className="text-xs font-bold">Loading SIM assignment &amp; generating document...</p>
            </div>
          ) : generatedHtml ? (
            <div className="bg-slate-100 dark:bg-slate-950 p-4 sm:p-6 rounded-xl overflow-x-auto flex justify-center border border-slate-200 dark:border-slate-800">
              <div
                className="w-full max-w-[800px] bg-white text-slate-900 shadow-lg p-6 sm:p-8 rounded-sm text-xs leading-relaxed"
                dangerouslySetInnerHTML={{ __html: generatedHtml }}
              />
            </div>
          ) : (
            <div className="py-20 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-bold">
                Select an employee with an assigned SIM to view the official undertaking.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => generateUndertaking()}
              disabled={isGenerating || !selectedEmployee || !hasAssignedSim}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              Regenerate
            </button>

            <button
              onClick={handlePrint}
              disabled={!generatedHtml || !hasAssignedSim}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print / Export PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
