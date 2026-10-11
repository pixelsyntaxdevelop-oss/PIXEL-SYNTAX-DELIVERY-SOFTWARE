import React, { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { DbEmployeeMaster } from '../../types/database';
import { masterEmployeeService } from '../../services/masterEmployeeService';
import { UaeLocationSelector } from '../common/UaeLocationSelector';

interface Props {
  employee: DbEmployeeMaster;
  onClose: () => void;
  onSave: (updatedEmployee: DbEmployeeMaster) => void;
}

export const EmployeeEditModal: React.FC<Props> = ({ employee, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<DbEmployeeMaster>>({ ...employee });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await masterEmployeeService.updateMasterEmployee(employee.id, formData);
      if (res.success && res.employee) {
        onSave(res.employee);
        onClose();
      } else {
        setError(res.error || 'Failed to update employee');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Edit Employee: {employee.full_name}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-100 text-red-800 rounded-xl text-sm">{error}</div>}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Full Name</label>
              <input type="text" value={formData.full_name || ''} onChange={e => setFormData({...formData, full_name: e.target.value})} className="block w-full rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Nationality</label>
              <input type="text" value={formData.nationality || ''} onChange={e => setFormData({...formData, nationality: e.target.value})} className="block w-full rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Address / City</label>
            <UaeLocationSelector value={formData.address || ''} onChange={val => setFormData({...formData, address: val})} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Mobile</label>
              <input type="text" value={formData.personal_mobile || ''} onChange={e => setFormData({...formData, personal_mobile: e.target.value})} className="block w-full rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Emirates ID</label>
              <input type="text" value={formData.emirates_id_number || ''} onChange={e => setFormData({...formData, emirates_id_number: e.target.value})} className="block w-full rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 font-bold text-sm">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-50">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
