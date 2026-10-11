import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Smartphone,
  Package,
  Briefcase,
  Activity,
  X,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  ArrowRightLeft,
  Calendar,
  UserMinus,
  CheckSquare,
  ShieldCheck,
  FileCheck,
  Search,
  Bike,
  AlertTriangle,
  Gauge,
  Clock,
  User,
} from 'lucide-react';
import { DbProject, DbVehicle, DbSimCardMaster, DbAsset } from '../../types/database';
import { masterEmployeeService } from '../../services/masterEmployeeService';
import { authService } from '../../services/authService';
import { AssignSimModal } from '../views/sim/AssignSimModal';

export type AssignmentModalType =
  | 'PROJECT'
  | 'END_PROJECT'
  | 'ASSIGN_BIKE'
  | 'REPLACE_BIKE'
  | 'RETURN_BIKE'
  | 'ASSIGN_SIM'
  | 'REPLACE_SIM'
  | 'RETURN_SIM'
  | 'ASSIGN_ASSET'
  | 'RETURN_ASSET'
  | 'STATUS'
  | 'LEAVE'
  | 'RETURN_LEAVE'
  | 'EXIT'
  | null;

interface AssignmentModalsProps {
  employeeId: string;
  employeeName: string;
  activeModal: AssignmentModalType;
  onClose: () => void;
  onSuccess: (message: string) => void;
  projects: DbProject[];
  vehicles: DbVehicle[];
  sims: DbSimCardMaster[];
  assets: DbAsset[];
  currentProjectName?: string;
  currentExternalId?: string;
  activeAssignmentId?: string;
  currentBikePlate?: string;
  currentSimNumber?: string;
  currentStatus?: string;
  employeeCode?: string;
  emiratesId?: string;
  activeAssets?: Array<{ id: string; asset_id: string; asset_name: string; asset_type: string }>;
  currentSim?: any;
  activeSimAssignment?: any;
  currentVehicle?: any;
  activeVehicleAssignment?: any;
  simHistory?: any[];
  vehicleHistory?: any[];
}

export const EmployeeAssignmentModals: React.FC<AssignmentModalsProps> = ({
  employeeId,
  employeeName,
  activeModal,
  onClose,
  onSuccess,
  projects,
  vehicles,
  sims,
  assets,
  currentProjectName,
  currentExternalId,
  activeAssignmentId,
  currentBikePlate,
  currentSimNumber,
  currentStatus,
  employeeCode,
  emiratesId,
  activeAssets = [],
  currentSim,
  activeSimAssignment,
  currentVehicle,
  activeVehicleAssignment,
  simHistory = [],
  vehicleHistory = [],
}) => {
  // Delegate SIM operations directly to the canonical shared AssignSimModal
  if (activeModal === 'ASSIGN_SIM') {
    return (
      <AssignSimModal
        isOpen={true}
        onClose={onClose}
        onSuccess={(msg) => {
          onSuccess(msg || 'SIM Line successfully assigned.');
          onClose();
        }}
        mode="ASSIGN"
        preselectedEmployee={{
          id: employeeId,
          full_name: employeeName,
          employee_code: employeeCode,
          emirates_id: emiratesId,
          current_sim_number: currentSimNumber,
          current_sim_id: activeAssignmentId,
          primary_project: currentProjectName,
          current_bike_plate: currentBikePlate,
        }}
        availableSimsList={sims as any}
      />
    );
  }

  if (activeModal === 'REPLACE_SIM') {
    const activeSimRecord = (sims || []).find(
      (s) => s.id === activeAssignmentId || s.mobile_number === currentSimNumber
    );
    return (
      <AssignSimModal
        isOpen={true}
        onClose={onClose}
        onSuccess={(msg) => {
          onSuccess(msg || 'SIM Line successfully swapped.');
          onClose();
        }}
        mode="REPLACE"
        sim={activeSimRecord as any}
        preselectedEmployee={{
          id: employeeId,
          full_name: employeeName,
          employee_code: employeeCode,
          emirates_id: emiratesId,
          current_sim_number: currentSimNumber,
          current_sim_id: activeAssignmentId,
          primary_project: currentProjectName,
          current_bike_plate: currentBikePlate,
        }}
        availableSimsList={sims as any}
      />
    );
  }

  if (activeModal === 'RETURN_SIM') {
    const rawSimNum = currentSimNumber || currentSim?.mobile_number || activeSimAssignment?.mobile_number || '';
    const cleanTargetDigits = rawSimNum.replace(/\D/g, '');

    const foundSim = (sims || []).find((s: any) => {
      if (currentSim?.id && s.id === currentSim.id) return true;
      if (activeSimAssignment?.sim_card_id && (s.id === activeSimAssignment.sim_card_id || s.sim_id === activeSimAssignment.sim_card_id)) return true;
      if (activeSimAssignment?.sim_id && (s.id === activeSimAssignment.sim_id || s.sim_id === activeSimAssignment.sim_id)) return true;
      if (cleanTargetDigits) {
        const sDigits = (s.mobile_number || s.sim_number || '').replace(/\D/g, '');
        if (sDigits && (sDigits === cleanTargetDigits || sDigits.endsWith(cleanTargetDigits) || cleanTargetDigits.endsWith(sDigits))) {
          return true;
        }
      }
      return false;
    });

    // Authoritative Decorator: Resolve source-of-truth inconsistency
    // When returning from Employee 360, this SIM is authoritatively in active custody of this employee.
    const activeSimRecord = {
      ...(foundSim || {}),
      id: foundSim?.id || currentSim?.id || activeSimAssignment?.sim_card_id || activeSimAssignment?.sim_id || (cleanTargetDigits ? `sim_${cleanTargetDigits}` : `sim_${employeeId}`),
      mobile_number: foundSim?.mobile_number || rawSimNum || 'Active Line',
      sim_number: foundSim?.sim_number || rawSimNum || 'Active Line',
      iccid: foundSim?.iccid || currentSim?.iccid || activeSimAssignment?.iccid || '—',
      provider: foundSim?.provider || currentSim?.provider || activeSimAssignment?.provider || 'ETISALAT',
      plan: foundSim?.plan || currentSim?.plan || activeSimAssignment?.plan || 'Standard Fleet Plan',
      monthly_package_amount: foundSim?.monthly_package_amount ?? currentSim?.monthly_package_amount ?? 100,
      approved_amount: foundSim?.approved_amount ?? currentSim?.approved_amount ?? 100,
      payable_amount: foundSim?.payable_amount ?? currentSim?.payable_amount ?? 0,
      assignment_status: 'Assigned',
      status: 'Assigned',
      service_status: (foundSim?.service_status && foundSim.service_status !== 'Inactive')
        ? foundSim.service_status
        : (currentSim?.service_status || 'Active'),
      is_active: true,
      current_employee_id: employeeId,
      current_employee_name: employeeName,
      current_employee_code: employeeCode,
      current_project_name: currentProjectName,
      current_vehicle_plate: currentBikePlate,
      assigned_date: foundSim?.assigned_date || currentSim?.assigned_date || activeSimAssignment?.assigned_date || activeSimAssignment?.assigned_at || new Date().toISOString().slice(0, 10),
    };

    return (
      <AssignSimModal
        isOpen={true}
        onClose={onClose}
        onSuccess={(msg) => {
          onSuccess(msg || 'SIM Line returned to inventory stock.');
          onClose();
        }}
        mode="RETURN"
        sim={activeSimRecord as any}
        preselectedEmployee={{
          id: employeeId,
          full_name: employeeName,
          employee_code: employeeCode,
          emirates_id: emiratesId,
          current_sim_number: activeSimRecord.mobile_number,
          current_sim_id: activeSimRecord.id,
          primary_project: currentProjectName,
          current_bike_plate: currentBikePlate,
        }}
        availableSimsList={sims as any}
      />
    );
  }

  // Modal Loading & Error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  // Project state
  const [allProjectsList, setAllProjectsList] = useState<DbProject[]>(projects || []);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [projectStartDate, setProjectStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [projectTransferReason, setProjectTransferReason] = useState('Client capacity demand');
  const [externalRiderId, setExternalRiderId] = useState('');
  const [projectNotes, setProjectNotes] = useState('');

  // Synchronize projects prop and load authoritative company_pixel_syntax projects if empty
  useEffect(() => {
    if (projects && projects.length > 0) {
      setAllProjectsList(projects);
      setProjectId((prev) => prev || projects[0].id);
    } else {
      setProjectsLoading(true);
      masterEmployeeService
        .getProjects()
        .then((pList) => {
          if (Array.isArray(pList) && pList.length > 0) {
            setAllProjectsList(pList);
            setProjectId((prev) => prev || pList[0].id);
          }
        })
        .catch((err) => console.warn('Projects fetch error in modal', err))
        .finally(() => setProjectsLoading(false));
    }
  }, [projects]);

  // When PROJECT assignment modal is activated, ensure authoritative projects are ready
  useEffect(() => {
    if (activeModal === 'PROJECT') {
      setError(null);
      if (currentExternalId && currentExternalId !== '-') {
        setExternalRiderId(currentExternalId);
      } else {
        setExternalRiderId('');
      }
      if (allProjectsList.length === 0) {
        setProjectsLoading(true);
        masterEmployeeService
          .getProjects()
          .then((pList) => {
            if (Array.isArray(pList) && pList.length > 0) {
              setAllProjectsList(pList);
              setProjectId((prev) => prev || pList[0].id);
            }
          })
          .catch((err) => console.warn('Projects fetch error in modal', err))
          .finally(() => setProjectsLoading(false));
      } else if (!projectId && allProjectsList.length > 0) {
        setProjectId(allProjectsList[0].id);
      }
    }
  }, [activeModal, allProjectsList, projectId, currentExternalId]);

  // End Project state
  const [endProjectReason, setEndProjectReason] = useState('Project completed');
  const [endProjectDate, setEndProjectDate] = useState(new Date().toISOString().split('T')[0]);
  const [endProjectNotes, setEndProjectNotes] = useState('');

  // Bike Assign / Replace state & Search across all authoritative vehicles
  const [allVehiclesList, setAllVehiclesList] = useState<any[]>(vehicles || []);
  const [bikeSearchQuery, setBikeSearchQuery] = useState('');
  const [forceBikeReassign, setForceBikeReassign] = useState(false);
  const [bikeReassignWarning, setBikeReassignWarning] = useState<string | null>(null);

  useEffect(() => {
    if (vehicles && vehicles.length > 0) {
      setAllVehiclesList(vehicles);
    }
    // Fetch authoritative vehicles master to guarantee complete directory access
    masterEmployeeService.getVehiclesMaster().then((vList) => {
      if (Array.isArray(vList) && vList.length > 0) {
        setAllVehiclesList(vList);
      }
    }).catch((err) => console.warn('Vehicles fetch error', err));
  }, [vehicles]);

  const availableVehicles = useMemo(() => {
    return allVehiclesList.filter(
      (v) =>
        v.status === 'AVAILABLE' ||
        v.current_status === 'AVAILABLE' ||
        (v.status as string) === 'Available'
    );
  }, [allVehiclesList]);

  const [vehicleId, setVehicleId] = useState('');
  const [startingOdometer, setStartingOdometer] = useState<number | ''>('');
  const [bikeCondition, setBikeCondition] = useState('');
  const [bikeHandoverNotes, setBikeHandoverNotes] = useState('');

  // Reset bike assignment form whenever ASSIGN_BIKE modal is opened
  useEffect(() => {
    if (activeModal === 'ASSIGN_BIKE' || activeModal === 'RETURN_BIKE') {
      setConfirmed(false);
    }
    if (activeModal === 'ASSIGN_BIKE') {
      setVehicleId('');
      setBikeSearchQuery('');
      setStartingOdometer('');
      setBikeCondition('');
      setBikeHandoverNotes('');
      setForceBikeReassign(false);
      setBikeReassignWarning(null);
      setError(null);
    }
  }, [activeModal]);

  const selectedVehicleObj = useMemo(() => {
    return allVehiclesList.find((v) => v.id === vehicleId) || null;
  }, [allVehiclesList, vehicleId]);

  // Vehicle search filtering: Plate Number, Chassis Number, TC Number, Make & Model
  const filteredVehiclesList = useMemo(() => {
    const q = bikeSearchQuery.trim().toLowerCase();
    if (!q) return allVehiclesList.slice(0, 30);
    const qDigits = q.replace(/\D/g, '');

    return allVehiclesList.filter((v) => {
      const plate = (v.plate_number || v.plateNumber || '').toLowerCase();
      const code = (v.plate_code || v.plateCode || '').toLowerCase();
      const emirate = (v.plate_emirate || v.plateEmirate || '').toLowerCase();
      const fullPlate = `${emirate} ${code} ${plate}`.toLowerCase();

      const chassis = (v.chassis_number || v.chassisNumber || v.vin || '').toLowerCase();
      const tc = (
        `${v.tc_number || ''} ${v.tcNumber || ''} ${v.engine_number || ''} ${v.engineNumber || ''} ${v.traffic_file_number || ''}`
      ).toLowerCase();
      const makeModel = `${v.make || ''} ${v.model || ''}`.toLowerCase();

      if (fullPlate.includes(q) || plate.includes(q)) return true;
      if (qDigits && (plate.includes(qDigits) || chassis.includes(qDigits) || tc.includes(qDigits))) return true;
      if (chassis.includes(q)) return true;
      if (tc.includes(q)) return true;
      if (makeModel.includes(q)) return true;
      return false;
    });
  }, [allVehiclesList, bikeSearchQuery]);

  // Bike Swap state
  const [oldBikeReturnOdo, setOldBikeReturnOdo] = useState(1450);
  const [bikeSwapReason, setBikeSwapReason] = useState('Scheduled Maintenance Replacement');

  // Bike Return state (Rider Return to Depot)
  const [bikeReturnDate, setBikeReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [bikeReturnTime, setBikeReturnTime] = useState(new Date().toTimeString().slice(0, 5));
  const [returnOdometer, setReturnOdometer] = useState(1500);
  const [bikeReturnCondition, setBikeReturnCondition] = useState('Returned in Good Condition');
  const [bikeReturnReason, setBikeReturnReason] = useState('Standard Depot Return');
  const [bikeReturnNotes, setBikeReturnNotes] = useState('All keys and documents returned');
  const [bikeReturnedBy, setBikeReturnedBy] = useState('Operations Admin');

  // SIM Assign / Replace state
  const availableSims = sims.filter((s) => s.status === 'AVAILABLE' || (s.status as string) === 'Available');
  const [simCardId, setSimCardId] = useState(availableSims[0]?.id || sims[0]?.id || '');
  const [simSwapReason, setSimSwapReason] = useState('Network upgrade / SIM Replacement');
  const [simNotes, setSimNotes] = useState('SIM handed over for daily delivery operations');

  // SIM Return state (Rider Return to Telecom Stock)
  const [simReturnDate, setSimReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [simReturnReason, setSimReturnReason] = useState('Return to Stock');
  const [simReturnNotes, setSimReturnNotes] = useState('Returned to telecom inventory');
  const [simReturnedBy, setSimReturnedBy] = useState('Operations Admin');

  useEffect(() => {
    const user = authService.getCurrentUser();
    const name = user?.name || user?.username || 'Operations Admin';
    setBikeReturnedBy(name);
    setSimReturnedBy(name);
    setBikeReturnDate(new Date().toISOString().split('T')[0]);
    setBikeReturnTime(new Date().toTimeString().slice(0, 5));
    setSimReturnDate(new Date().toISOString().split('T')[0]);
  }, [activeModal]);

  // Asset Assign state
  const availableAssets = assets.filter((a) => a.status === 'AVAILABLE' || (a.status as string) === 'Available');
  const [assetId, setAssetId] = useState(availableAssets[0]?.id || assets[0]?.id || '');
  const [assetCondition, setAssetCondition] = useState('EXCELLENT');
  const [assetNotes, setAssetNotes] = useState('Issued for delivery shift');

  // Asset Return state
  const [assetAssignmentId, setAssetAssignmentId] = useState(activeAssets[0]?.id || '');
  const [assetReturnCondition, setAssetReturnCondition] = useState('GOOD');
  const [assetReturnNotes, setAssetReturnNotes] = useState('Returned to warehouse stock');

  // Status Change state
  const [newStatus, setNewStatus] = useState('Assigned / Active');
  const [statusReason, setStatusReason] = useState('Normal operational update');
  const [statusEffectiveDate, setStatusEffectiveDate] = useState(new Date().toISOString().split('T')[0]);

  // Leave Workflow state
  const [leaveType, setLeaveType] = useState<'ANNUAL' | 'EMERGENCY' | 'SICK' | 'UNPAID'>('ANNUAL');
  const [leaveStartDate, setLeaveStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [leaveReturnDate, setLeaveReturnDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [leaveReason, setLeaveReason] = useState('Annual home vacation approved');
  const [parkBikeDuringLeave, setParkBikeDuringLeave] = useState(Boolean(currentBikePlate));
  const [parkSimDuringLeave, setParkSimDuringLeave] = useState(false);

  // Return from Leave state
  const [returnFromLeaveDate, setReturnFromLeaveDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnFromLeaveNotes, setReturnFromLeaveNotes] = useState('Resumed regular delivery shift');

  // Exit Workflow state
  const [exitType, setExitType] = useState('Resignation');
  const [exitDate, setExitDate] = useState(new Date().toISOString().split('T')[0]);
  const [exitReason, setExitReason] = useState('Formal end of employment contract');
  const [exitReturnOdometer, setExitReturnOdometer] = useState(1520);
  const [exitSettlementNotes, setExitSettlementNotes] = useState('Assets verified. Ready for final payroll clearance.');
  const [exitHandbackPassport, setExitHandbackPassport] = useState(true);

  if (!activeModal) return null;

  // Handlers
  const handleAssignOrTransferProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      setError('Please select a target project.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const hasActiveProject = Boolean(
        currentProjectName &&
        currentProjectName !== 'Unassigned' &&
        currentProjectName !== '-' &&
        currentProjectName.trim() !== ''
      );

      if (hasActiveProject) {
        // Transfer project atomically
        const res = await masterEmployeeService.transferProject(employeeId, projectId, {
          effectiveDate: projectStartDate,
          transferReason: projectTransferReason,
          employeeCodeOnProject: externalRiderId.trim() || undefined,
          notes: projectNotes,
        });
        setLoading(false);
        if (res.success) {
          onSuccess('Project transferred successfully and status synchronized');
          onClose();
        } else {
          setError(res.error || 'Failed to transfer project');
        }
      } else {
        // First-time project assignment
        const res = await masterEmployeeService.assignProject(
          employeeId,
          projectId,
          projectStartDate,
          externalRiderId.trim() || undefined,
          projectNotes
        );
        setLoading(false);
        if (res.success) {
          onSuccess('Project assigned successfully');
          onClose();
        } else {
          setError(res.error || 'Failed to assign project');
        }
      }
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || 'Operation failed');
    }
  };

  const handleEndProjectAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAssignmentId) {
      setError('No active assignment record found to end');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await masterEmployeeService.endProjectAssignment(activeAssignmentId, {
        endDate: endProjectDate,
        endReason: endProjectReason,
        notes: endProjectNotes,
      });
      setLoading(false);
      if (res.success) {
        onSuccess('Project assignment ended and marked in history');
        onClose();
      } else {
        setError(res.error || 'Failed to end project assignment');
      }
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || 'Operation failed');
    }
  };

  const handleAssignBike = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId) {
      setError('Please select a vehicle to assign.');
      return;
    }

    if (bikeReassignWarning && !forceBikeReassign) {
      setError('Please check the reassignment confirmation box to proceed with assigning this vehicle.');
      return;
    }

    setLoading(true);
    setError(null);
    const res = await masterEmployeeService.assignVehicle(employeeId, vehicleId, {
      startingOdometer: startingOdometer !== '' ? Number(startingOdometer) : undefined,
      condition: bikeCondition.trim() || undefined,
      notes: bikeHandoverNotes.trim() || undefined,
      forceReassign: forceBikeReassign,
    });
    setLoading(false);
    if (res.success) {
      onSuccess('Vehicle assigned successfully');
      onClose();
    } else if (res.reassignmentRequired) {
      setBikeReassignWarning(res.error || 'Reassignment confirmation required for this vehicle.');
      setError(res.error || 'Reassignment confirmation required.');
    } else {
      setError(res.error || 'Failed to assign vehicle');
    }
  };

  const handleReplaceBike = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await masterEmployeeService.replaceVehicle(employeeId, vehicleId, {
      oldReturnOdometer: oldBikeReturnOdo,
      newStartingOdometer: startingOdometer !== '' ? Number(startingOdometer) : undefined,
      swapReason: bikeSwapReason,
      conditionOnReturn: 'Good Condition',
      notes: bikeHandoverNotes,
    });
    setLoading(false);
    if (res.success) {
      onSuccess('Vehicle swapped atomically in 1 step');
      onClose();
    } else {
      setError(res.error || 'Failed to replace vehicle');
    }
  };

  const handleReturnBike = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const targetVehId =
      currentVehicle?.id ||
      activeVehicleAssignment?.vehicle_id ||
      (currentBikePlate && (vehicles || []).find((v: any) => v.plate_number === currentBikePlate || v.plateNumber === currentBikePlate)?.id) ||
      currentBikePlate;

    const res = await masterEmployeeService.returnVehicle(employeeId, {
      vehicleId: targetVehId,
      vehiclePlate: currentBikePlate,
      employeeCode,
      returnDate: bikeReturnDate,
      returnTime: bikeReturnTime,
      returnOdometer,
      conditionOnReturn: bikeReturnCondition,
      returnNotes: bikeReturnNotes,
      returnReason: bikeReturnReason,
      returnRemark: bikeReturnReason,
      returnedTo: bikeReturnedBy,
      returnedBy: bikeReturnedBy,
    });
    setLoading(false);
    if (res.success) {
      window.dispatchEvent(new CustomEvent('erp:vehicles-updated'));
      window.dispatchEvent(new CustomEvent('erp:employees-updated'));
      onSuccess('Vehicle returned from rider and released to fleet depot stock');
      onClose();
    } else {
      setError(res.error || 'Failed to return vehicle');
    }
  };

  const handleAssignSim = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await masterEmployeeService.assignSim(employeeId, simCardId, simNotes);
    setLoading(false);
    if (res.success) {
      onSuccess('SIM Card assigned successfully');
      onClose();
    } else {
      setError(res.error || 'Failed to assign SIM card');
    }
  };

  const handleReplaceSim = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await masterEmployeeService.replaceSim(employeeId, simCardId, {
      swapReason: simSwapReason,
      notes: simNotes,
    });
    setLoading(false);
    if (res.success) {
      onSuccess('SIM Card replaced atomically');
      onClose();
    } else {
      setError(res.error || 'Failed to replace SIM card');
    }
  };

  const handleReturnSim = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await masterEmployeeService.returnSim(employeeId, {
      returnDate: simReturnDate,
      returnReason: simReturnReason,
      returnNotes: simReturnNotes,
      returnedTo: simReturnedBy,
      returnedBy: simReturnedBy,
    });
    setLoading(false);
    if (res.success) {
      onSuccess('SIM card returned from rider and released to available inventory');
      onClose();
    } else {
      setError(res.error || 'Failed to return SIM');
    }
  };

  const handleAssignAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await masterEmployeeService.assignAsset(employeeId, assetId, assetCondition, assetNotes);
    setLoading(false);
    if (res.success) {
      onSuccess('Asset issued successfully');
      onClose();
    } else {
      setError(res.error || 'Failed to issue asset');
    }
  };

  const handleReturnAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await masterEmployeeService.returnAsset(employeeId, assetAssignmentId, {
      conditionOnReturn: assetReturnCondition,
      returnNotes: assetReturnNotes,
      returnedTo: 'Warehouse Stock',
    });
    setLoading(false);
    if (res.success) {
      onSuccess('Asset returned to stock');
      onClose();
    } else {
      setError(res.error || 'Failed to return asset');
    }
  };

  const handleStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await masterEmployeeService.changeEmployeeStatus(
      employeeId,
      newStatus,
      statusReason,
      statusEffectiveDate
    );
    setLoading(false);
    if (res.success) {
      onSuccess(`Status updated to ${newStatus}`);
      onClose();
    } else {
      setError(res.error || 'Failed to change status');
    }
  };

  const handleLeaveStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await masterEmployeeService.startLeave(employeeId, {
      leaveType,
      startDate: leaveStartDate,
      returnExpectedDate: leaveReturnDate,
      reason: leaveReason,
      returnVehicleTemporary: parkBikeDuringLeave,
      returnSimTemporary: parkSimDuringLeave,
    });
    setLoading(false);
    if (res.success) {
      onSuccess('Temporary leave recorded and status synchronized');
      onClose();
    } else {
      setError(res.error || 'Failed to record leave');
    }
  };

  const handleReturnFromLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await masterEmployeeService.returnFromLeave(employeeId, {
      returnDate: returnFromLeaveDate,
      notes: returnFromLeaveNotes,
    });
    setLoading(false);
    if (res.success) {
      onSuccess('Employee successfully returned to active duty');
      onClose();
    } else {
      setError(res.error || 'Failed to return from leave');
    }
  };

  const handleProcessExit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await masterEmployeeService.exitEmployee(employeeId, {
      exitType,
      exitDate,
      exitReason,
      returnVehicleOdometer: exitReturnOdometer,
      settlementNotes: exitSettlementNotes,
      passportReturnedToRider: exitHandbackPassport,
    });
    setLoading(false);
    if (res.success) {
      onSuccess(`Complete exit clearance processed for ${employeeName}`);
      onClose();
    } else {
      setError(res.error || 'Failed to process exit clearance');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden my-auto max-h-[90dvh] flex flex-col">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400">
              {(activeModal === 'PROJECT' || activeModal === 'END_PROJECT') && <Briefcase className="w-5 h-5" />}
              {(activeModal === 'ASSIGN_BIKE' || activeModal === 'REPLACE_BIKE' || activeModal === 'RETURN_BIKE') && (
                <Truck className="w-5 h-5" />
              )}
              {((activeModal as any) === 'ASSIGN_SIM' || (activeModal as any) === 'REPLACE_SIM' || (activeModal as any) === 'RETURN_SIM') && (
                <Smartphone className="w-5 h-5" />
              )}
              {(activeModal === 'ASSIGN_ASSET' || activeModal === 'RETURN_ASSET') && <Package className="w-5 h-5" />}
              {activeModal === 'STATUS' && <Activity className="w-5 h-5" />}
              {(activeModal === 'LEAVE' || activeModal === 'RETURN_LEAVE') && <Calendar className="w-5 h-5" />}
              {activeModal === 'EXIT' && <UserMinus className="w-5 h-5 text-rose-600" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {activeModal === 'PROJECT' && (currentProjectName ? 'Transfer Project' : 'Assign Project')}
                {activeModal === 'END_PROJECT' && 'End Active Project Assignment'}
                {activeModal === 'ASSIGN_BIKE' && 'Assign Vehicle / Bike'}
                {activeModal === 'REPLACE_BIKE' && '1-Step Bike Swap / Replacement'}
                {activeModal === 'RETURN_BIKE' && 'Return Vehicle to Depot'}
                {(activeModal as any) === 'ASSIGN_SIM' && 'Assign SIM Card'}
                {(activeModal as any) === 'REPLACE_SIM' && '1-Step SIM Swap / Replacement'}
                {(activeModal as any) === 'RETURN_SIM' && 'Return SIM Card'}
                {activeModal === 'ASSIGN_ASSET' && 'Issue Custody Equipment'}
                {activeModal === 'RETURN_ASSET' && 'Return Equipment to Warehouse'}
                {activeModal === 'STATUS' && 'Quick Status Switcher'}
                {activeModal === 'LEAVE' && 'Temporary Leave Workflow'}
                {activeModal === 'RETURN_LEAVE' && 'Return to Active Operations'}
                {activeModal === 'EXIT' && 'Rider Exit & Final Clearance'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">{employeeName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body with scrollable content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. PROJECT ASSIGNMENT / TRANSFER */}
          {activeModal === 'PROJECT' && (
            <form onSubmit={handleAssignOrTransferProject} className="space-y-4">
              {currentProjectName && currentProjectName !== 'Unassigned' && currentProjectName !== '-' && (
                <div className="p-3 bg-blue-50/80 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 block">
                      Currently Assigned Project
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white text-xs">{currentProjectName}</span>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-sm">
                    Auto-Closes on Transfer
                  </span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Target Project *
                </label>
                <select
                  required
                  id="target-project-select"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-medium focus:ring-2 focus:ring-blue-500"
                >
                  {allProjectsList.length === 0 ? (
                    <option value="" disabled>
                      {projectsLoading ? 'Loading company projects...' : 'No active projects found'}
                    </option>
                  ) : (
                    allProjectsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Dynamic External Rider ID field */}
              {(() => {
                const selP = allProjectsList.find((p) => p.id === projectId);
                const pName = (selP?.name || '').toLowerCase();
                const specificLabel = selP?.external_id_label || (
                  pName.includes('noon')
                    ? 'NIM ID'
                    : pName.includes('keeta')
                    ? 'Courier ID'
                    : pName.includes('labour') || pName.includes('labor')
                    ? 'Person Code / Labour ID'
                    : 'External Project Employee ID'
                );
                return (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      {specificLabel}
                    </label>
                    <input
                      id="input_external_project_id"
                      type="text"
                      value={externalRiderId}
                      onChange={(e) => setExternalRiderId(e.target.value)}
                      placeholder={`Enter ${specificLabel}, e.g. ${
                        specificLabel === 'Courier ID'
                          ? 'K10294'
                          : specificLabel === 'NIM ID'
                          ? 'N8192'
                          : specificLabel.includes('Person Code')
                          ? 'PC-44021'
                          : '12345678'
                      }`}
                      className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-mono font-bold"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Manual project-specific employee ID (e.g. Noon Minutes → NIM ID, Keeta → Courier ID, Labour → Person Code / Labour ID).
                    </p>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Effective Date
                  </label>
                  <input
                    type="date"
                    value={projectStartDate}
                    onChange={(e) => setProjectStartDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Reason
                  </label>
                  <input
                    type="text"
                    value={projectTransferReason}
                    onChange={(e) => setProjectTransferReason(e.target.value)}
                    placeholder="e.g. Surge demand, rider request"
                    className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-900/50 text-[11px] text-emerald-800 dark:text-emerald-300 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Smart Sync: Employee status automatically updates to "Assigned / Active"</span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                >
                  {loading ? 'Processing...' : currentProjectName ? 'Execute Project Transfer' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          )}

          {/* 1.1. END PROJECT ASSIGNMENT */}
          {activeModal === 'END_PROJECT' && (
            <form onSubmit={handleEndProjectAssignment} className="space-y-4">
              <div className="p-3 bg-rose-50/80 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-400 block">
                    End Active Project Assignment
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white text-xs">
                    {currentProjectName || 'Active Project'}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-rose-700 bg-rose-100 dark:bg-rose-900/60 px-2 py-0.5 rounded-sm">
                  Preserves Complete History
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={endProjectDate}
                    onChange={(e) => setEndProjectDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    End Reason *
                  </label>
                  <select
                    required
                    value={endProjectReason}
                    onChange={(e) => setEndProjectReason(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700"
                  >
                    <option value="Project completed">Project completed</option>
                    <option value="Operational Reallocation">Operational Reallocation</option>
                    <option value="Client Demand Concluded">Client Demand Concluded</option>
                    <option value="Rider Request">Rider Request</option>
                    <option value="Transferred to Standby / Available">Transferred to Standby / Available</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Handover / End Notes
                </label>
                <textarea
                  rows={2}
                  value={endProjectNotes}
                  onChange={(e) => setEndProjectNotes(e.target.value)}
                  placeholder="Details on project conclusion or rider status..."
                  className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                >
                  {loading ? 'Ending...' : 'End Project Assignment'}
                </button>
              </div>
            </form>
          )}

          {/* 2. BIKE ASSIGNMENT */}
          {activeModal === 'ASSIGN_BIKE' && (
            <form onSubmit={handleAssignBike} className="space-y-4">
              {/* Employee Current Bike Alert */}
              {currentBikePlate && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Active Bike Notice:</span> This employee currently holds bike{' '}
                    <span className="font-bold">{currentBikePlate}</span>.
                    Assigning another vehicle will close the current assignment and transfer custody.
                  </div>
                </div>
              )}

              {/* Vehicle Search & Selection */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Search Bike / Vehicle *
                </label>

                {selectedVehicleObj ? (
                  /* Selected Vehicle Preview Card */
                  <div className="p-3 rounded-xl border-2 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                        <Bike className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                            {selectedVehicleObj.plate_emirate || selectedVehicleObj.plateEmirate || 'UAE'}{' '}
                            {selectedVehicleObj.plate_code || selectedVehicleObj.plateCode ? `${selectedVehicleObj.plate_code || selectedVehicleObj.plateCode}-` : ''}
                            {selectedVehicleObj.plate_number || selectedVehicleObj.plateNumber}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                            {selectedVehicleObj.make} {selectedVehicleObj.model}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 font-mono">
                          {(selectedVehicleObj.chassis_number || selectedVehicleObj.chassisNumber || selectedVehicleObj.vin) && (
                            <span>Chassis: {selectedVehicleObj.chassis_number || selectedVehicleObj.chassisNumber || selectedVehicleObj.vin}</span>
                          )}
                          {(selectedVehicleObj.tc_number || selectedVehicleObj.tcNumber) && (
                            <span>TC: {selectedVehicleObj.tc_number || selectedVehicleObj.tcNumber}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setVehicleId('')}
                      className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  /* Vehicle Search Input and Filtered List */
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={bikeSearchQuery}
                        onChange={(e) => setBikeSearchQuery(e.target.value)}
                        placeholder="Search by Plate Number, Chassis Number, or TC Number..."
                        className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                        autoFocus
                      />
                      {bikeSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setBikeSearchQuery('')}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {filteredVehiclesList.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500">
                          No vehicles match &ldquo;{bikeSearchQuery}&rdquo;. Try searching by plate, chassis, or TC number.
                        </div>
                      ) : (
                        filteredVehiclesList.map((v) => {
                          const isAssigned =
                            v.status === 'ASSIGNED' ||
                            v.current_status === 'Assigned' ||
                            v.current_rider_id ||
                            (v as any).assignedRiderId;
                          const riderName =
                            v.current_rider_name || (v as any).assignedRiderName || 'Active Rider';
                          const plateDisplay = `${v.plate_emirate || v.plateEmirate || ''} ${
                            v.plate_code || v.plateCode ? `${v.plate_code || v.plateCode}-` : ''
                          }${v.plate_number || v.plateNumber || v.plate_no}`;

                          return (
                            <div
                              key={v.id}
                              onClick={() => {
                                setVehicleId(v.id);
                                if (isAssigned) {
                                  setBikeReassignWarning(
                                    `Vehicle ${plateDisplay} is currently assigned to ${riderName}. Reassignment confirmation required.`
                                  );
                                } else if (currentBikePlate) {
                                  setBikeReassignWarning(
                                    `Employee currently holds bike ${currentBikePlate}. Assigning will transfer custody.`
                                  );
                                } else {
                                  setBikeReassignWarning(null);
                                }
                              }}
                              className="p-2.5 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 cursor-pointer transition-colors flex items-center justify-between group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-xs shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                  <Bike className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
                                      {plateDisplay}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-medium">
                                      {v.make} {v.model}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                                    {(v.chassis_number || v.chassisNumber || v.vin) && (
                                      <span>Chassis: {v.chassis_number || v.chassisNumber || v.vin}</span>
                                    )}
                                    {(v.tc_number || v.tcNumber) && (
                                      <span>TC: {v.tc_number || v.tcNumber}</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="shrink-0 pl-2 text-right">
                                {isAssigned ? (
                                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-md">
                                    Assigned: {riderName}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-md">
                                    Available
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Reassignment Warning & Confirmation Banner */}
              {selectedVehicleObj && (bikeReassignWarning || currentBikePlate) && (
                <div className="p-3 rounded-xl border border-amber-300 bg-amber-50/80 dark:bg-amber-950/40 dark:border-amber-800 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-900 dark:text-amber-200">
                      <div className="font-bold">Reassignment Required</div>
                      <div className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                        {bikeReassignWarning ||
                          'Assigning this vehicle will terminate previous active assignment records and transfer custody. Assignment history will be preserved.'}
                      </div>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer pt-1 border-t border-amber-200 dark:border-amber-800">
                    <input
                      type="checkbox"
                      checked={forceBikeReassign}
                      onChange={(e) => setForceBikeReassign(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                    />
                    <span className="text-xs font-bold text-amber-950 dark:text-amber-100 select-none">
                      I explicitly confirm reassignment and custody handover
                    </span>
                  </label>
                </div>
              )}

              {/* Starting Odometer & Condition - Shown only after selecting a vehicle */}
              {selectedVehicleObj && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                        Starting Odometer (KM)
                      </label>
                      <div className="relative">
                        <Gauge className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type="number"
                          value={startingOdometer}
                          onChange={(e) => setStartingOdometer(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder={
                            selectedVehicleObj?.current_odometer !== undefined
                              ? `Current: ${selectedVehicleObj.current_odometer} KM`
                              : 'Enter starting KM'
                          }
                          className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-mono font-bold text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                        Condition on Handover
                      </label>
                      <input
                        type="text"
                        value={bikeCondition}
                        onChange={(e) => setBikeCondition(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium"
                        placeholder="e.g. Excellent, Good, Fair (enter condition)"
                      />
                    </div>
                  </div>

                  {/* Handover Notes */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Handover Notes & Checklist
                    </label>
                    <textarea
                      value={bikeHandoverNotes}
                      onChange={(e) => setBikeHandoverNotes(e.target.value)}
                      rows={2}
                      className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium"
                      placeholder="Enter handover notes, equipment, or remarks manually..."
                    />
                  </div>
                </>
              )}

              {/* Footer Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !vehicleId || ((Boolean(bikeReassignWarning) || Boolean(currentBikePlate)) && !forceBikeReassign)}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs text-xs flex items-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {loading ? 'Assigning...' : 'Confirm Vehicle Assignment'}
                </button>
              </div>
            </form>
          )}

          {/* 3. 1-STEP BIKE SWAP / REPLACEMENT */}
          {activeModal === 'REPLACE_BIKE' && (
            <form onSubmit={handleReplaceBike} className="space-y-4">
              <div className="p-3 bg-amber-50/80 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 block">
                    Current Returning Bike
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                    {currentBikePlate || 'Current Vehicle'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Return Odometer</span>
                  <input
                    type="number"
                    value={oldBikeReturnOdo}
                    onChange={(e) => setOldBikeReturnOdo(Number(e.target.value))}
                    className="w-24 px-2 py-0.5 bg-white dark:bg-slate-800 rounded border border-amber-300 dark:border-amber-700 font-mono font-bold text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Select New Replacement Vehicle *
                </label>
                <select
                  required
                  value={vehicleId}
                  onChange={(e) => {
                    setVehicleId(e.target.value);
                    const sel = vehicles.find((v) => v.id === e.target.value);
                    if (sel?.odometer_km || (sel as any)?.odometerKm) {
                      setStartingOdometer(sel?.odometer_km || (sel as any)?.odometerKm);
                    }
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-mono font-bold"
                >
                  {availableVehicles
                    .filter((v) => (v.plate_number || (v as any).plateNumber) !== currentBikePlate)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.plate_number || (v as any).plateNumber} • {v.make} {v.model} ({v.status})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    New Starting Odometer (KM)
                  </label>
                  <input
                    type="number"
                    value={startingOdometer}
                    onChange={(e) => setStartingOdometer(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Swap Reason
                  </label>
                  <input
                    type="text"
                    value={bikeSwapReason}
                    onChange={(e) => setBikeSwapReason(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !vehicleId}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  {loading ? 'Swapping...' : 'Execute 1-Step Swap'}
                </button>
              </div>
            </form>
          )}

          {/* 4. BIKE RETURN (RIDER RETURN TO FLEET DEPOT) */}
          {activeModal === 'RETURN_BIKE' && (
            <form onSubmit={handleReturnBike} className="space-y-4">
              <div className="p-3.5 bg-rose-50/80 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-400 block">
                    Return Vehicle from Rider to Fleet Depot
                  </span>
                  <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/60 px-2 py-0.5 rounded-full">
                    Depot Stock Return
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-base">
                    {currentBikePlate || 'Assigned Vehicle'}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Custodian: <strong>{employeeName}</strong>
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                  Closes rider custody and marks this vehicle as <strong>AVAILABLE</strong> in Vehicle Management. The vehicle remains leased/owned by its vendor (this is <em>not</em> a vendor return).
                </p>
              </div>

              {/* Date & Time Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-500" /> Return Date *</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={bikeReturnDate}
                    onChange={(e) => setBikeReturnDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-500" /> Return Time</span>
                  </label>
                  <input
                    type="time"
                    value={bikeReturnTime}
                    onChange={(e) => setBikeReturnTime(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-medium"
                  />
                </div>
              </div>

              {/* Odometer & Condition */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    <span className="flex items-center gap-1.5"><Gauge className="w-3.5 h-3.5 text-slate-500" /> Return Odometer (KM) *</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={returnOdometer}
                    onChange={(e) => setReturnOdometer(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Condition on Return
                  </label>
                  <select
                    value={bikeReturnCondition}
                    onChange={(e) => setBikeReturnCondition(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-medium"
                  >
                    <option value="Returned in Good Condition">Good Condition</option>
                    <option value="Minor Scratches - Recorded">Minor Scratches</option>
                    <option value="Requires Maintenance Service">Requires Maintenance</option>
                    <option value="Damaged - Accidental Claim">Damaged / Incident</option>
                  </select>
                </div>
              </div>

              {/* Reason & Returned By */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Return Reason / Remark <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={bikeReturnReason}
                    onChange={(e) => setBikeReturnReason(e.target.value)}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-medium"
                  >
                    <option value="Standard Depot Return">Standard Depot Return</option>
                    <option value="Rider Leave / Vacation">Rider Leave / Vacation</option>
                    <option value="Rider Resigned / Offboarded">Rider Resigned / Offboarded</option>
                    <option value="Project Reassignment / Swap">Project Reassignment / Swap</option>
                    <option value="Vehicle Maintenance / Repair Required">Vehicle Maintenance / Repair Required</option>
                    <option value="Accident / Incident Inspection">Accident / Incident Inspection</option>
                    <option value="Other">Other Reason</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-slate-500" /> Returned By (Logged-in User) *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={bikeReturnedBy}
                    onChange={(e) => setBikeReturnedBy(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Return Notes / Inspection Remarks
                </label>
                <input
                  type="text"
                  value={bikeReturnNotes}
                  onChange={(e) => setBikeReturnNotes(e.target.value)}
                  placeholder="e.g. Keys and helmet received, parked in bay 4..."
                  className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <input
                  type="checkbox"
                  id="confirm-return-bike"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500 cursor-pointer"
                />
                <label htmlFor="confirm-return-bike" className="text-xs text-amber-900 dark:text-amber-200 font-bold cursor-pointer">
                  I confirm this vehicle is being received from the rider back to Allied depot stock.
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !confirmed}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Returning...' : 'Confirm Return & Release to Stock'}
                </button>
              </div>
            </form>
          )}

          {/* 6. 1-STEP SIM REPLACEMENT */}
          {(activeModal as any) === 'REPLACE_SIM' && (
            <form onSubmit={handleReplaceSim} className="space-y-4">
              <div className="p-3 bg-sky-50/80 dark:bg-sky-950/40 rounded-xl border border-sky-200 dark:border-sky-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-sky-700 dark:text-sky-400 block">
                    Current Active SIM
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                    {currentSimNumber || 'Current SIM'}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-sm">
                  Auto-Releases to Stock
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Select Replacement SIM *
                </label>
                <select
                  required
                  value={simCardId}
                  onChange={(e) => setSimCardId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-mono font-bold"
                >
                  {availableSims.length === 0 ? (
                    <option value="" disabled>No replacement SIMs available in stock</option>
                  ) : (
                    availableSims
                      .filter((s) => s.mobile_number !== currentSimNumber)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.mobile_number} ({s.provider}) • Plan: {s.plan}
                        </option>
                      ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Swap Reason
                </label>
                <input
                  type="text"
                  value={simSwapReason}
                  onChange={(e) => setSimSwapReason(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !simCardId}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  {loading ? 'Swapping...' : 'Execute 1-Step Swap'}
                </button>
              </div>
            </form>
          )}

          {/* 7. SIM RETURN (RIDER RETURN TO TELECOM STOCK) */}
          {(activeModal as any) === 'RETURN_SIM' && (
            <form onSubmit={handleReturnSim} className="space-y-4">
              <div className="p-3.5 bg-rose-50/80 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-400 block">
                    Return SIM Card from Rider to Telecom Stock
                  </span>
                  <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/60 px-2 py-0.5 rounded-full">
                    Inventory Return
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-base">
                    {currentSimNumber || 'Active SIM'}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Custodian: <strong>{employeeName}</strong>
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                  Closes active custody and makes the SIM <strong>AVAILABLE</strong> in SIM Management. The telecom plan remains active with the provider (this does <em>not</em> cancel the line).
                </p>
              </div>

              {/* Return Date & Reason */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-500" /> Return Date *</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={simReturnDate}
                    onChange={(e) => setSimReturnDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Return Reason / Remark <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={simReturnReason}
                    onChange={(e) => setSimReturnReason(e.target.value)}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-medium"
                  >
                    <option value="Return to Stock">Return to Stock</option>
                    <option value="Rider Left / Resigned">Rider Left / Resigned</option>
                    <option value="Temporary Leave / Vacation">Temporary Leave / Vacation</option>
                    <option value="Project Reassignment">Project Reassignment</option>
                    <option value="Handset Damaged / Defective">Handset Damaged / Defective</option>
                    <option value="Other">Other Reason</option>
                  </select>
                </div>
              </div>

              {/* Returned By */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-slate-500" /> Returned By (Logged-in User) *</span>
                </label>
                <input
                  type="text"
                  required
                  value={simReturnedBy}
                  onChange={(e) => setSimReturnedBy(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Return Remarks / Notes
                </label>
                <input
                  type="text"
                  value={simReturnNotes}
                  onChange={(e) => setSimReturnNotes(e.target.value)}
                  placeholder="e.g. Returned to telecom stock cabinet in working order..."
                  className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  {loading ? 'Returning...' : 'Confirm Return to Inventory'}
                </button>
              </div>
            </form>
          )}

          {/* 8. ASSET ASSIGN */}
          {activeModal === 'ASSIGN_ASSET' && (
            <form onSubmit={handleAssignAsset} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Select Equipment Item *
                </label>
                <select
                  required
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-medium"
                >
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.asset_name} ({a.asset_type}) • {a.brand || ''} • Cond: {a.condition || 'GOOD'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Condition on Handover
                  </label>
                  <select
                    value={assetCondition}
                    onChange={(e) => setAssetCondition(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700"
                  >
                    <option value="EXCELLENT">New / Sealed</option>
                    <option value="GOOD">Good Operational Condition</option>
                    <option value="FAIR">Fair / Functional</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={assetNotes}
                    onChange={(e) => setAssetNotes(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !assetId}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-xs"
                >
                  {loading ? 'Issuing...' : 'Issue Equipment'}
                </button>
              </div>
            </form>
          )}

          {/* 9. ASSET RETURN */}
          {activeModal === 'RETURN_ASSET' && (
            <form onSubmit={handleReturnAsset} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Select Item to Return *
                </label>
                <select
                  required
                  value={assetAssignmentId}
                  onChange={(e) => setAssetAssignmentId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-medium"
                >
                  {activeAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.asset_name} ({a.asset_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Condition on Return
                </label>
                <select
                  value={assetReturnCondition}
                  onChange={(e) => setAssetReturnCondition(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700"
                >
                  <option value="GOOD">Good Condition</option>
                  <option value="FAIR">Fair Condition</option>
                  <option value="DAMAGED">Damaged</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !assetAssignmentId}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs"
                >
                  {loading ? 'Returning...' : 'Return to Warehouse'}
                </button>
              </div>
            </form>
          )}

          {/* 10. STATUS CHANGE WITH QUICK PRESETS */}
          {activeModal === 'STATUS' && (
            <form onSubmit={handleStatusChange} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-2">
                  Quick Presets
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Assigned / Active',
                    'Available / Unassigned',
                    'On Leave',
                    'On Hold',
                    'Absconding',
                    'Terminated',
                    'Exited',
                  ].map(
                    (st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setNewStatus(st)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                          newStatus === st
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        {st}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Reason for Status Change *
                </label>
                <input
                  type="text"
                  required
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="e.g. Completed documentation, Onboarded, Returned to duty..."
                  className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Effective Date
                </label>
                <input
                  type="date"
                  value={statusEffectiveDate}
                  onChange={(e) => setStatusEffectiveDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs"
                >
                  {loading ? 'Updating...' : 'Update Status & Audit'}
                </button>
              </div>
            </form>
          )}

          {/* 11. TEMPORARY LEAVE WORKFLOW */}
          {activeModal === 'LEAVE' && (
            <form onSubmit={handleLeaveStart} className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { key: 'ANNUAL', label: 'Annual Leave' },
                  { key: 'EMERGENCY', label: 'Emergency' },
                  { key: 'SICK', label: 'Medical Sick' },
                  { key: 'UNPAID', label: 'Unpaid Leave' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setLeaveType(item.key as any)}
                    className={`py-2 px-1 text-center rounded-xl font-bold text-xs transition-colors border ${
                      leaveType === item.key
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Leave Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={leaveStartDate}
                    onChange={(e) => setLeaveStartDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Expected Return Date
                  </label>
                  <input
                    type="date"
                    value={leaveReturnDate}
                    onChange={(e) => setLeaveReturnDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Reason / Notes
                </label>
                <input
                  type="text"
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="e.g. Approved 30-day vacation"
                  className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700"
                />
              </div>

              {currentBikePlate && (
                <label className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={parkBikeDuringLeave}
                    onChange={(e) => setParkBikeDuringLeave(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-xs text-slate-700 dark:text-slate-300">
                    Park assigned bike ({currentBikePlate}) back to depot during leave
                  </span>
                </label>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs"
                >
                  {loading ? 'Recording...' : 'Record Leave & Update Status'}
                </button>
              </div>
            </form>
          )}

          {/* 12. RETURN FROM LEAVE */}
          {activeModal === 'RETURN_LEAVE' && (
            <form onSubmit={handleReturnFromLeave} className="space-y-4">
              <div className="p-3 bg-emerald-50/80 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block">
                  Resuming Operations
                </span>
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Status will automatically restore to "Active" / "Assigned"
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Actual Return Date *
                </label>
                <input
                  type="date"
                  required
                  value={returnFromLeaveDate}
                  onChange={(e) => setReturnFromLeaveDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Duty Resumption Notes
                </label>
                <input
                  type="text"
                  value={returnFromLeaveNotes}
                  onChange={(e) => setReturnFromLeaveNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs"
                >
                  {loading ? 'Resuming...' : 'Confirm Return to Duty'}
                </button>
              </div>
            </form>
          )}

          {/* 13. RIDER EXIT & FINAL CLEARANCE (ATOMIC CHECKLIST) */}
          {activeModal === 'EXIT' && (
            <form onSubmit={handleProcessExit} className="space-y-4">
              <div className="p-3 bg-rose-50/80 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/60">
                <div className="flex items-center gap-2 mb-1.5">
                  <ShieldCheck className="w-4 h-4 text-rose-600" />
                  <h4 className="text-xs font-bold text-rose-900 dark:text-rose-200 uppercase tracking-wider">
                    Atomic Exit & Clearance Checklist
                  </h4>
                </div>
                <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Project assignment will be closed automatically</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      {currentBikePlate
                        ? `Assigned vehicle (${currentBikePlate}) will be released to depot`
                        : 'No active vehicle assigned'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      {currentSimNumber
                        ? `SIM card (${currentSimNumber}) will be returned to stock`
                        : 'No active SIM assigned'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      {activeAssets.length > 0
                        ? `${activeAssets.length} custody item(s) will be returned to warehouse`
                        : 'All custody assets verified'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Status will update & timeline/audit records generated</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Exit Classification *
                  </label>
                  <select
                    value={exitType}
                    onChange={(e) => setExitType(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold"
                  >
                    <option value="Resignation">Resignation (Standard)</option>
                    <option value="End of Contract">End of Contract</option>
                    <option value="Terminated">Terminated</option>
                    <option value="Cancelled">Visa Cancelled</option>
                    <option value="Absconding">Absconding / Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Effective Exit Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={exitDate}
                    onChange={(e) => setExitDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700"
                  />
                </div>
              </div>

              {currentBikePlate && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Final Bike Return Odometer ({currentBikePlate})
                  </label>
                  <input
                    type="number"
                    value={exitReturnOdometer}
                    onChange={(e) => setExitReturnOdometer(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-mono font-bold"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Reason & Settlement Notes
                </label>
                <input
                  type="text"
                  value={exitReason}
                  onChange={(e) => setExitReason(e.target.value)}
                  placeholder="e.g. Returned to home country, clearance completed"
                  className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700"
                />
              </div>

              <label className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exitHandbackPassport}
                  onChange={(e) => setExitHandbackPassport(e.target.checked)}
                  className="w-4 h-4 text-rose-600 rounded"
                />
                <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                  Physical passport handed back to employee upon clearance
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  <UserMinus className="w-4 h-4" />
                  {loading ? 'Processing Clearance...' : 'Execute Complete Exit Clearance'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
