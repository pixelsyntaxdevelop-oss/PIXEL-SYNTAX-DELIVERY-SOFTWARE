import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Search,
  Sparkles,
  Loader2,
  AlertCircle,
  Car,
} from 'lucide-react';
import { FineBatchRow } from '../../../types/trafficFines';
import { apiClient } from '../../../services/apiClient';

interface AddTrafficFineViewProps {
  onBack: () => void;
  onSuccess: () => void;
  branches: any[];
  vendors: string[];
  fineTypes: string[];
  currentMonth: string;
}

interface VehicleSearchResult {
  id: string;
  plate_number: string;
  plate_code: string;
  plate_emirate: string;
  vehicle_code: string;
  vehicle_type: string;
  make: string;
  model: string;
  vendor_name?: string;
  current_rider_name?: string;
}

export const AddTrafficFineView: React.FC<AddTrafficFineViewProps> = ({
  onBack,
  onSuccess,
  branches,
  vendors,
  fineTypes,
  currentMonth,
}) => {
  // Top Header Fields
  const [trafficFineType, setTrafficFineType] = useState('Vendor Wise');
  const [selectedBranchId, setSelectedBranchId] = useState(branches[0]?.id || 'b_dxb');
  const [selectedVendor, setSelectedVendor] = useState(vendors[0] || 'Dubai Police');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [forMonth, setForMonth] = useState(currentMonth || '2026-08');

  // Multi-row Grid State
  const [rows, setRows] = useState<FineBatchRow[]>([
    createInitialRow(1),
    createInitialRow(2),
    createInitialRow(3),
  ]);

  // Autocomplete state
  const [activeSearchRowIndex, setActiveSearchRowIndex] = useState<number | null>(null);
  const [vehicleQuery, setVehicleQuery] = useState('');
  const [vehicleSearchResults, setVehicleSearchResults] = useState<VehicleSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState<{
    type: 'SUCCESS' | 'ERROR';
    message: string;
    details?: string;
  } | null>(null);

  function createInitialRow(idx: number): FineBatchRow {
    return {
      row_id: `row_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`,
      plate_number: '',
      plate_code: '',
      transaction_date: new Date().toISOString().split('T')[0],
      transaction_time: '14:30:00',
      fine_amount: 300,
      admin_fee: 20,
      service_fee: 10,
      total_amount: 330,
      reference_number: '',
      violation_type: 'Speeding radar violation',
      location: 'Dubai Main Roadway',
      notes: '',
      status: 'READY',
      status_message: 'Fill mandatory fields',
    };
  }

  // Handle outside click for autocomplete
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setActiveSearchRowIndex(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search vehicles when query changes
  useEffect(() => {
    if (!vehicleQuery || vehicleQuery.length < 2 || activeSearchRowIndex === null) {
      setVehicleSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await apiClient.get<VehicleSearchResult[]>(
          `/api/erp/fines/vehicles/search?q=${encodeURIComponent(vehicleQuery)}&vendor=${encodeURIComponent(selectedVendor)}`
        );
        if (res.data && Array.isArray(res.data)) {
          setVehicleSearchResults(res.data);
        } else {
          setVehicleSearchResults([]);
        }
      } catch (err) {
        console.error('Vehicle search failed:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [vehicleQuery, activeSearchRowIndex, selectedVendor]);

  // Update a field in a row
  const updateRow = (index: number, field: keyof FineBatchRow, value: any) => {
    setRows((prev) => {
      const next = [...prev];
      const r = { ...next[index], [field]: value };

      // Recalculate total if amounts changed
      if (field === 'fine_amount' || field === 'admin_fee' || field === 'service_fee') {
        const fAmt = Number(field === 'fine_amount' ? value : r.fine_amount) || 0;
        const aFee = Number(field === 'admin_fee' ? value : r.admin_fee) || 0;
        const sFee = Number(field === 'service_fee' ? value : r.service_fee) || 0;
        r.total_amount = Math.round((fAmt + aFee + sFee) * 100) / 100;
      }

      next[index] = r;
      return next;
    });
  };

  const handleSelectVehicle = (index: number, v: VehicleSearchResult) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        plate_number: v.plate_number,
        plate_code: v.plate_code || '',
        vehicle: {
          id: v.id,
          plate_number: v.plate_number,
          plate_code: v.plate_code || '',
          emirate: v.plate_emirate || 'Dubai',
          vehicle_code: v.vehicle_code || '',
        },
      };
      return next;
    });
    setActiveSearchRowIndex(null);
    setVehicleQuery('');
  };

  const addRow = (count: number = 1) => {
    setRows((prev) => {
      const newRows: FineBatchRow[] = [];
      for (let i = 0; i < count; i++) {
        newRows.push(createInitialRow(prev.length + i + 1));
      }
      return [...prev, ...newRows];
    });
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  // Run server batch validation
  const validateBatch = async () => {
    setIsValidating(true);
    setSubmissionFeedback(null);
    try {
      const res = await apiClient.post<any>('/api/erp/fines/validate-batch', {
        header: {
          fine_type: trafficFineType,
          branch_id: selectedBranchId,
          vendor: selectedVendor,
          invoice_number: invoiceNumber,
          month: forMonth,
        },
        rows: rows.map((r) => ({
          plate_number: r.plate_number,
          plate_code: r.plate_code,
          transaction_date: r.transaction_date,
          transaction_time: r.transaction_time,
          fine_amount: Number(r.fine_amount),
          admin_fee: Number(r.admin_fee),
          service_fee: Number(r.service_fee),
          reference_number: r.reference_number,
          violation_type: r.violation_type,
          location: r.location,
          notes: r.notes,
        })),
      });

      if (res.data && res.data.results) {
        setRows((prev) => {
          return prev.map((r, i) => {
            const vRes = res.data.results[i];
            if (!vRes) return r;
            return {
              ...r,
              status: vRes.status,
              status_message: vRes.message,
              resolved_rider: vRes.resolved_rider,
              vehicle: vRes.vehicle || r.vehicle,
              total_amount: vRes.total_amount || r.total_amount,
            };
          });
        });

        if (res.data.failed_count === 0) {
          setSubmissionFeedback({
            type: 'SUCCESS',
            message: `All ${res.data.ready_count} rows passed validation and are ready for submission.`,
          });
        } else {
          setSubmissionFeedback({
            type: 'ERROR',
            message: `${res.data.failed_count} row(s) failed validation. Review row tags for details.`,
          });
        }
      }
    } catch (err: any) {
      setSubmissionFeedback({
        type: 'ERROR',
        message: err.message || 'Validation request failed.',
      });
    } finally {
      setIsValidating(false);
    }
  };

  // Submit fines
  const handleSubmitFines = async () => {
    // Validate required header fields
    if (!selectedVendor) {
      setSubmissionFeedback({ type: 'ERROR', message: 'Please select a vendor or police authority.' });
      return;
    }

    // Filter out completely blank rows
    const activeRows = rows.filter((r) => r.plate_number.trim() || r.reference_number.trim());
    if (activeRows.length === 0) {
      setSubmissionFeedback({ type: 'ERROR', message: 'Please enter at least one fine row.' });
      return;
    }

    setIsSubmitting(true);
    setSubmissionFeedback(null);

    const selectedBranch = branches.find((b) => b.id === selectedBranchId);

    try {
      const payload = {
        header: {
          traffic_fine_type: trafficFineType,
          fine_type: trafficFineType,
          branch_id: selectedBranchId,
          branch_name: selectedBranch?.branch_name || selectedBranch?.name || 'Dubai Central Logistics Hub',
          vendor: selectedVendor,
          invoice_number: invoiceNumber.trim(),
          month: forMonth,
        },
        rows: activeRows.map((r) => ({
          plate_number: r.plate_number.trim(),
          plate_code: r.plate_code.trim(),
          transaction_date: r.transaction_date,
          transaction_time: r.transaction_time || '12:00:00',
          fine_amount: Number(r.fine_amount) || 0,
          admin_fee: Number(r.admin_fee) || 0,
          service_fee: Number(r.service_fee) || 0,
          reference_number: r.reference_number.trim(),
          violation_type: r.violation_type || 'Traffic Violation',
          location: r.location || '',
          notes: r.notes || '',
        })),
      };

      const res = await apiClient.post<any>('/api/erp/fines/batch', payload);

      if (res.error) {
        setSubmissionFeedback({
          type: 'ERROR',
          message: res.error,
        });
        setIsSubmitting(false);
        return;
      }

      if (res.data && res.data.success) {
        setSubmissionFeedback({
          type: 'SUCCESS',
          message: res.data.message || `Successfully created ${res.data.created_count} fines.`,
        });

        // Small delay to allow user to see success message before navigating back
        setTimeout(() => {
          onSuccess();
        }, 1200);
      } else {
        setSubmissionFeedback({
          type: 'ERROR',
          message: 'Some rows could not be ingested.',
        });
      }
    } catch (err: any) {
      setSubmissionFeedback({
        type: 'ERROR',
        message: err.message || 'Submission failed.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: FineBatchRow['status'], msg?: string) => {
    switch (status) {
      case 'READY':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800" title={msg}>
            READY
          </span>
        );
      case 'DUPLICATE_FINE':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800" title={msg}>
            DUPLICATE
          </span>
        );
      case 'VEHICLE_NOT_FOUND':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800" title={msg}>
            NOT FOUND
          </span>
        );
      case 'INVALID_PLATE':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-800" title={msg}>
            BAD PLATE
          </span>
        );
      case 'MISSING_DATE':
      case 'INVALID_AMOUNT':
      case 'MISSING_REFERENCE':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700" title={msg}>
            {status.replace('_', ' ')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
            PENDING
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 pb-12" id="add-traffic-fines-view">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 border border-slate-200 rounded-lg shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            id="btn-back-to-fines"
            onClick={onBack}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
            title="Back to Traffic Fines"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Add Traffic Fines</h1>
            <p className="text-xs text-slate-500">
              Vendor-wise multi-row entry grid with automatic historical custody resolution
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            id="btn-validate-batch"
            onClick={validateBatch}
            disabled={isValidating || isSubmitting}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
          >
            {isValidating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCheck className="w-3.5 h-3.5 text-slate-600" />}
            <span>Validate Rows</span>
          </button>

          <button
            type="button"
            id="btn-submit-fines"
            onClick={handleSubmitFines}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm transition-colors disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>Submit Fines</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {submissionFeedback && (
        <div
          id="batch-feedback-banner"
          className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
            submissionFeedback.type === 'SUCCESS'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {submissionFeedback.type === 'SUCCESS' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          )}
          <span>{submissionFeedback.message}</span>
        </div>
      )}

      {/* Top Fields Panel */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Traffic Fine Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Traffic Fine Type
            </label>
            <select
              id="select-fine-type"
              value={trafficFineType}
              onChange={(e) => setTrafficFineType(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              {fineTypes.map((ft) => (
                <option key={ft} value={ft}>
                  {ft}
                </option>
              ))}
            </select>
          </div>

          {/* Branch */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Branch</label>
            <select
              id="select-branch"
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.branch_name || b.name || b.id}
                </option>
              ))}
            </select>
          </div>

          {/* Vendor */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Vendor / Authority
            </label>
            <select
              id="select-vendor"
              value={selectedVendor}
              onChange={(e) => setSelectedVendor(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              {vendors.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {/* Invoice Number */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Invoice Number
            </label>
            <input
              type="text"
              id="input-invoice-number"
              placeholder="e.g. INV-2026-8801"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          {/* For Month */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">For Month</label>
            <input
              type="month"
              id="input-for-month"
              value={forMonth}
              onChange={(e) => setForMonth(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>
        </div>
      </div>

      {/* Multi-row Entry Grid */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden" ref={searchContainerRef}>
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Fine Entry Grid ({rows.length} rows)
            </span>
            <span className="text-[11px] text-slate-500">
              Type 2+ chars in Plate No to autocomplete vehicle
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              id="btn-add-row"
              onClick={() => addRow(1)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Row</span>
            </button>
            <button
              type="button"
              id="btn-add-5-rows"
              onClick={() => addRow(5)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+5 Rows</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse" id="table-fine-entry-grid">
            <thead>
              <tr className="bg-slate-100/75 text-slate-600 border-b border-slate-200 font-semibold text-[11px]">
                <th className="py-2.5 px-2 w-10 text-center">#</th>
                <th className="py-2.5 px-2 w-32">Plate No *</th>
                <th className="py-2.5 px-2 w-20">Code</th>
                <th className="py-2.5 px-2 w-32">Tx Date *</th>
                <th className="py-2.5 px-2 w-24">Time *</th>
                <th className="py-2.5 px-2 w-24">Fine (AED) *</th>
                <th className="py-2.5 px-2 w-20">Admin</th>
                <th className="py-2.5 px-2 w-20">Service</th>
                <th className="py-2.5 px-2 w-24">Total (AED)</th>
                <th className="py-2.5 px-2 w-36">Ref No *</th>
                <th className="py-2.5 px-2 min-w-[160px]">Notes</th>
                <th className="py-2.5 px-2 w-28 text-center">Status</th>
                <th className="py-2.5 px-2 w-10 text-center">Act</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((row, idx) => (
                <tr key={row.row_id} className="hover:bg-slate-50/80 transition-colors">
                  {/* Row # */}
                  <td className="py-2 px-2 text-center text-slate-400 font-mono text-[11px]">
                    {idx + 1}
                  </td>

                  {/* Plate No (Searchable Autocomplete) */}
                  <td className="py-2 px-2 relative">
                    <input
                      type="text"
                      placeholder="e.g. 72154"
                      value={activeSearchRowIndex === idx ? vehicleQuery : row.plate_number}
                      onFocus={() => {
                        setActiveSearchRowIndex(idx);
                        setVehicleQuery(row.plate_number);
                      }}
                      onChange={(e) => {
                        const val = e.target.value;
                        setVehicleQuery(val);
                        updateRow(idx, 'plate_number', val);
                      }}
                      className="w-full text-xs font-mono font-medium uppercase border border-slate-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    />

                    {/* Autocomplete Dropdown */}
                    {activeSearchRowIndex === idx && (
                      <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-300 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                        {searchLoading ? (
                          <div className="p-2 text-center text-slate-400 text-xs flex items-center justify-center gap-1">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching fleet...
                          </div>
                        ) : vehicleSearchResults.length > 0 ? (
                          vehicleSearchResults.map((v) => (
                            <div
                              key={v.id}
                              onClick={() => handleSelectVehicle(idx, v)}
                              className="p-2 hover:bg-slate-100 cursor-pointer border-b border-slate-100 last:border-0 text-xs"
                            >
                              <div className="font-semibold text-slate-800 flex items-center justify-between">
                                <span>
                                  {v.plate_number} {v.plate_code && `(${v.plate_code})`}
                                </span>
                                <span className="text-[10px] text-slate-500 font-normal">{v.plate_emirate}</span>
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center justify-between mt-0.5">
                                <span>{v.make} {v.model}</span>
                                {v.current_rider_name && (
                                  <span className="text-emerald-700 truncate max-w-[100px]">{v.current_rider_name}</span>
                                )}
                              </div>
                            </div>
                          ))
                        ) : vehicleQuery.length >= 2 ? (
                          <div className="p-2 text-center text-slate-400 text-xs">
                            No vehicle found with plate "{vehicleQuery}"
                          </div>
                        ) : (
                          <div className="p-2 text-center text-slate-400 text-xs">
                            Type 2+ chars to search
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Plate Code */}
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      placeholder="Code"
                      value={row.plate_code}
                      onChange={(e) => updateRow(idx, 'plate_code', e.target.value.toUpperCase())}
                      className="w-full text-xs font-mono border border-slate-300 rounded px-1.5 py-1 text-center bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </td>

                  {/* Tx Date */}
                  <td className="py-2 px-2">
                    <input
                      type="date"
                      value={row.transaction_date}
                      onChange={(e) => updateRow(idx, 'transaction_date', e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </td>

                  {/* Time */}
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      placeholder="14:30:00"
                      value={row.transaction_time}
                      onChange={(e) => updateRow(idx, 'transaction_time', e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded px-1.5 py-1 font-mono text-center bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </td>

                  {/* Fine Amount */}
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      min="0"
                      step="10"
                      placeholder="300"
                      value={row.fine_amount}
                      onChange={(e) => updateRow(idx, 'fine_amount', e.target.value)}
                      className="w-full text-xs font-mono font-semibold border border-slate-300 rounded px-2 py-1 text-right bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </td>

                  {/* Admin Fee */}
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      min="0"
                      step="5"
                      value={row.admin_fee}
                      onChange={(e) => updateRow(idx, 'admin_fee', e.target.value)}
                      className="w-full text-xs font-mono border border-slate-300 rounded px-1.5 py-1 text-right bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </td>

                  {/* Service Fee */}
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      min="0"
                      step="5"
                      value={row.service_fee}
                      onChange={(e) => updateRow(idx, 'service_fee', e.target.value)}
                      className="w-full text-xs font-mono border border-slate-300 rounded px-1.5 py-1 text-right bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </td>

                  {/* Total Amount (Auto-calculated) */}
                  <td className="py-2 px-2 text-right font-mono font-bold text-slate-800">
                    {row.total_amount.toFixed(2)}
                  </td>

                  {/* Reference Number */}
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      placeholder="DXB-TKT-2026-..."
                      value={row.reference_number}
                      onChange={(e) => updateRow(idx, 'reference_number', e.target.value)}
                      className="w-full text-xs font-mono border border-slate-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </td>

                  {/* Notes */}
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      placeholder="Radar location / notes..."
                      value={row.notes || ''}
                      onChange={(e) => updateRow(idx, 'notes', e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </td>

                  {/* Status */}
                  <td className="py-2 px-2 text-center">
                    {getStatusBadge(row.status, row.status_message)}
                    {row.resolved_rider && (
                      <div className="text-[10px] text-emerald-700 truncate max-w-[100px] mt-0.5" title={`Auto-resolved: ${row.resolved_rider.rider_name} (${row.resolved_rider.rider_code})`}>
                        {row.resolved_rider.rider_name}
                      </div>
                    )}
                  </td>

                  {/* Delete Row Action */}
                  <td className="py-2 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      disabled={rows.length <= 1}
                      className="text-slate-400 hover:text-rose-600 p-1 disabled:opacity-30 transition-colors"
                      title="Delete row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Summary */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-500">
            Total Rows:{' '}
            <strong className="text-slate-800">{rows.length}</strong> | Ready:{' '}
            <strong className="text-emerald-700">
              {rows.filter((r) => r.status === 'READY').length}
            </strong>
          </div>

          <div className="text-slate-700 font-medium">
            Batch Total:{' '}
            <span className="font-bold text-slate-900 font-mono text-sm ml-1">
              AED{' '}
              {rows
                .reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0)
                .toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
