import React, { useState, useEffect } from 'react';
import {
  Car,
  Search,
  RefreshCw,
  Eye,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle,
  X,
  User,
  Shield,
} from 'lucide-react';
import {
  platformAdminService,
  AdminVehicle,
  DuplicateGroup,
} from '../../services/platformAdminService';
import { SafeDeleteModal } from './SafeDeleteModal';

interface AdminVehiclesTabProps {
  tenantId: string;
  isLiveTenant: boolean;
  onRefreshParentCounts: () => void;
}

export const AdminVehiclesTab: React.FC<AdminVehiclesTabProps> = ({
  tenantId,
  isLiveTenant,
  onRefreshParentCounts,
}) => {
  const [vehicles, setVehicles] = useState<AdminVehicle[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateGroup<AdminVehicle>[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSubView, setActiveSubView] = useState<'ALL' | 'DUPLICATES'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal states
  const [selectedVeh, setSelectedVeh] = useState<AdminVehicle | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [editReason, setEditReason] = useState('');

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [vehDeps, setVehDeps] = useState<any>(null);
  const [loadingDeps, setLoadingDeps] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [vehList, dupList] = await Promise.all([
        platformAdminService.getVehicles(tenantId, searchQuery, statusFilter),
        platformAdminService.getDuplicateVehicles(tenantId),
      ]);
      setVehicles(Array.isArray(vehList) ? vehList : []);
      setDuplicates(Array.isArray(dupList) ? dupList : []);
    } catch (err) {
      console.error('Failed to load vehicles:', err);
      setVehicles([]);
      setDuplicates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId, searchQuery, statusFilter]);

  const handleOpenDelete = async (veh: AdminVehicle) => {
    setSelectedVeh(veh);
    setLoadingDeps(true);
    setDeleteModalOpen(true);
    try {
      const deps = await platformAdminService.getVehicleDependencies(tenantId, veh.id);
      setVehDeps(deps);
    } catch (err) {
      console.error('Failed to load vehicle deps:', err);
    } finally {
      setLoadingDeps(false);
    }
  };

  const handleConfirmDelete = async (reason: string, confirmationPhrase?: string) => {
    if (!selectedVeh) return;
    const res = await platformAdminService.deleteVehicle(
      tenantId,
      selectedVeh.id,
      reason,
      confirmationPhrase
    );
    if (!res.success) {
      throw new Error(res.error || 'Failed to delete vehicle.');
    }
    await loadData();
    onRefreshParentCounts();
  };

  const handleOpenEdit = (veh: AdminVehicle) => {
    setSelectedVeh(veh);
    setEditFormData({
      plateNumber: veh.plateNumber,
      plate_code: veh.plate_code || '',
      vin: veh.vin || '',
      make: veh.make,
      model: veh.model,
      status: veh.status,
      ownership: veh.ownership || 'Company Owned',
      vendor_name: veh.vendor_name || '',
    });
    setEditReason('');
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedVeh) return;
    if (!editReason.trim()) {
      alert('Please provide a reason for modifying vehicle master data.');
      return;
    }
    const success = await platformAdminService.updateVehicle(tenantId, selectedVeh.id, {
      ...editFormData,
      reason: editReason,
    });
    if (success) {
      setEditModalOpen(false);
      await loadData();
      onRefreshParentCounts();
    } else {
      alert('Failed to update vehicle record.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubView('ALL')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeSubView === 'ALL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            All Vehicles ({vehicles.length})
          </button>
          <button
            onClick={() => setActiveSubView('DUPLICATES')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeSubView === 'DUPLICATES'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Duplicate Plates ({duplicates.length})
          </button>
        </div>

        {activeSubView === 'ALL' && (
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search plate, VIN, make, model..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white w-64 focus:outline-hidden focus:border-blue-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-1.5 px-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
            >
              <option value="ALL">All Statuses</option>
              <option value="AVAILABLE">AVAILABLE</option>
              <option value="ASSIGNED">ASSIGNED</option>
              <option value="MAINTENANCE">MAINTENANCE</option>
              <option value="OFF_DUTY">OFF_DUTY</option>
            </select>

            <button
              onClick={loadData}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}
      </div>

      {activeSubView === 'ALL' ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Plate Number</th>
                  <th className="py-3 px-3">Vehicle Code</th>
                  <th className="py-3 px-3">Make / Model</th>
                  <th className="py-3 px-3">VIN</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Assigned Employee</th>
                  <th className="py-3 px-3">Project</th>
                  <th className="py-3 px-3">Ownership</th>
                  <th className="py-3 px-4 text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {(!Array.isArray(vehicles) || vehicles.length === 0) ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      {loading ? 'Loading fleet assets...' : 'No vehicle records found for this tenant.'}
                    </td>
                  </tr>
                ) : (
                  (Array.isArray(vehicles) ? vehicles : []).map((veh) => (
                    <tr
                      key={veh.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        {veh.plateNumber}
                        {veh.plate_code && <span className="ml-1 text-[10px] text-slate-400">({veh.plate_code})</span>}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-500">
                        {veh.vehicle_code || veh.id}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{veh.make}</span> {veh.model}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-500 text-[11px]">
                        {veh.vin || '-'}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            veh.status === 'ASSIGNED'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                              : veh.status === 'AVAILABLE'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {veh.status}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {veh.current_assigned_employee_name ? (
                          <span className="flex items-center gap-1 font-medium text-slate-900 dark:text-white">
                            <User className="w-3 h-3 text-slate-400" />
                            {veh.current_assigned_employee_name}
                          </span>
                        ) : (
                          <span className="text-slate-400">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                        {veh.project_name || '-'}
                      </td>
                      <td className="py-3 px-3 text-[11px] text-slate-500">
                        {veh.ownership || veh.vendor_name || 'Direct'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(veh)}
                            className="p-1 text-blue-600 hover:text-blue-700 rounded hover:bg-blue-50 dark:hover:bg-blue-950/50"
                            title="Edit Vehicle Master Record"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenDelete(veh)}
                            className="p-1 text-red-600 hover:text-red-700 rounded hover:bg-red-50 dark:hover:bg-red-950/50"
                            title="Safe Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Duplicate Vehicles Sub-Tab */
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Duplicate Vehicle Plate Detection</p>
              <p className="mt-0.5 text-amber-700 dark:text-amber-300">
                Matches are detected by tenant + Plate Number or VIN. Duplicates are never automatically removed; software owners can compare and delete safe duplicates.
              </p>
            </div>
          </div>

          {duplicates.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400">
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                No Duplicate Vehicles Found
              </p>
              <p className="text-xs">
                All vehicle assets in this tenant have distinct plate numbers and VIN records.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {(Array.isArray(duplicates) ? duplicates : []).map((group) => (
                <div
                  key={group.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs"
                >
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                      Duplicate Plate: {group.matchValue}
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(Array.isArray(group.records) ? group.records : []).map((rec, i) => (
                      <div
                        key={rec.id}
                        className="p-3 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/30"
                      >
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white">
                            Vehicle #{i + 1}: {rec.make} {rec.model}
                          </span>
                          <span className="font-mono text-slate-500 ml-2">({rec.plateNumber})</span>
                          <div className="text-slate-500 text-[11px] mt-0.5">
                            Status: {rec.status} • Assigned: {rec.current_assigned_employee_name || 'None'} • VIN: {rec.vin || 'None'}
                          </div>
                        </div>
                        <button
                          onClick={() => handleOpenDelete(rec)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded border border-red-200 dark:border-red-900/50"
                        >
                          Delete Vehicle #{i + 1}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Vehicle Modal */}
      {editModalOpen && selectedVeh && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Edit Vehicle Master Record
              </h3>
              <button onClick={() => setEditModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">Plate Number</label>
                  <input
                    type="text"
                    value={editFormData.plateNumber || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, plateNumber: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Plate Code</label>
                  <input
                    type="text"
                    value={editFormData.plate_code || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, plate_code: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Make</label>
                  <input
                    type="text"
                    value={editFormData.make || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, make: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Model</label>
                  <input
                    type="text"
                    value={editFormData.model || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, model: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Status</label>
                  <select
                    value={editFormData.status || 'AVAILABLE'}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                  >
                    <option value="AVAILABLE">AVAILABLE</option>
                    <option value="ASSIGNED">ASSIGNED</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                    <option value="OFF_DUTY">OFF_DUTY</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Ownership</label>
                  <input
                    type="text"
                    value={editFormData.ownership || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, ownership: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-500 mb-1">
                  Required Audit Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Reason for modifying vehicle record..."
                  rows={2}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                />
              </div>
            </div>
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setEditModalOpen(false)}
                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-xs font-semibold rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded"
              >
                Save Changes (Audited)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safe Delete Modal */}
      {selectedVeh && (
        <SafeDeleteModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={handleConfirmDelete}
          title="Safe Delete Vehicle"
          recordIdentifier={`Plate: ${selectedVeh.plateNumber} (${selectedVeh.make} ${selectedVeh.model})`}
          entityType="VEHICLE"
          isLiveTenant={isLiveTenant}
          loading={loadingDeps}
          dependencies={
            vehDeps
              ? {
                  activePointers: vehDeps.activeAssignment
                    ? [`Assigned Employee: ${vehDeps.activeAssignment.employeeName} (will be unlinked)`]
                    : [],
                  historicalCounts: [
                    { label: 'Traffic Fines', count: vehDeps.historicalFinesCount || 0 },
                    { label: 'Salik Tolls', count: vehDeps.historicalSalikCount || 0 },
                    { label: 'Historical Assignments', count: vehDeps.historicalAssignmentsCount || 0 },
                  ],
                }
              : undefined
          }
        />
      )}
    </div>
  );
};
