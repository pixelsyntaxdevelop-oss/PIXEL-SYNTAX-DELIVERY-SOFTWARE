import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  UserCheck,
  ArrowRightLeft,
  RotateCcw,
  Search,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  PhoneCall,
  User,
  Radio,
  ChevronDown,
  FileUp,
  X,
  Smartphone,
  Check,
} from 'lucide-react';
import { Modal } from '../../common/Modal';
import { apiClient } from '../../../services/apiClient';
import { authService } from '../../../services/authService';
import { SimRecord, SimEmployeeSearchCandidate } from '../../../types/sim';

export interface AssignSimModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message?: string) => void;
  sim?: SimRecord | null;
  mode?: 'ASSIGN' | 'TRANSFER' | 'RETURN' | 'REPLACE';
  preselectedEmployee?: {
    id: string;
    full_name: string;
    employee_code?: string;
    emirates_id?: string;
    current_sim_id?: string;
    current_sim_number?: string;
    has_active_sim?: boolean;
    primary_project?: string;
    project_name?: string;
    current_bike_plate?: string;
  } | null;
  availableSimsList?: SimRecord[];
}

// The generic employee directory does not reliably include live SIM custody.
// Use the SIM-specific tenant-scoped search so assignment warnings display the
// same active holder and mobile number as the SIM lifecycle service.
async function fetchSimCustodyCandidates(query: string): Promise<SimEmployeeSearchCandidate[]> {
  const res = await apiClient.get<SimEmployeeSearchCandidate[]>(
    `/api/erp/sims/employees/search?q=${encodeURIComponent(query)}`
  );
  if (!Array.isArray(res.data)) throw new Error('SIM custody search returned an invalid response');
  return res.data;
}

export const MANDATORY_RETURN_REASONS = [
  'RETURN',
  'REPLACEMENT',
  'DAMAGED',
  'EMPLOYEE EXIT',
  'OTHER',
  'Resignation',
  'Lost',
  'Defective',
  'End of Contract',
  'Project Exit',
];

const MANDATORY_SWAP_REASONS = [
  'Defective SIM Card',
  'Lost SIM Card',
  'Network / Carrier Change',
  'Damaged SIM / No Signal',
  'End of Contract / Rotation',
  'Upgrade to 5G Enterprise Line',
  'Other Operational Reason',
];

export const AssignSimModal: React.FC<AssignSimModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  sim,
  mode: initialMode = 'ASSIGN',
  preselectedEmployee = null,
  availableSimsList = [],
}) => {
  const [currentMode, setCurrentMode] = useState<'ASSIGN' | 'TRANSFER' | 'RETURN' | 'REPLACE'>(
    initialMode
  );

  // Active SIM selection (when sim prop is null, e.g. from Employee Management)
  const [availableSims, setAvailableSims] = useState<SimRecord[]>(availableSimsList);
  const [selectedSimId, setSelectedSimId] = useState<string>(sim?.id || '');
  const [isLoadingAvailableSims, setIsLoadingAvailableSims] = useState(false);
  const [simSearchQuery, setSimSearchQuery] = useState('');

  // Helper function to match SIM records against search queries (supports 0559397067, 559397067, +971559397067, and ICCID)
  const matchSimRecord = (s: SimRecord, query: string): boolean => {
    const cleanQ = query.trim().toLowerCase();
    if (!cleanQ) return false;

    const mob = (s.mobile_number || (s as any).simNumber || (s as any).sim_number || '').trim().toLowerCase();
    const iccid = (s.iccid || (s as any).sim_serial_number || (s as any).serial_number || '').trim().toLowerCase();
    const vendor = (s.provider || (s as any).vendor || '').trim().toLowerCase();

    // 1. Raw string substring match (covers partial ICCID, formatted phone, or vendor)
    if (mob.includes(cleanQ) || iccid.includes(cleanQ) || vendor.includes(cleanQ)) {
      return true;
    }

    // 2. Digits matching (supports 0559397067, 559397067, +971559397067, and numeric ICCID)
    const qDigits = cleanQ.replace(/\D/g, '');
    if (qDigits.length > 0) {
      const mobDigits = mob.replace(/\D/g, '');
      const iccidDigits = iccid.replace(/\D/g, '');

      // Direct digit sequence match
      if (iccidDigits.includes(qDigits)) return true;
      if (mobDigits.includes(qDigits)) return true;

      // UAE phone normalization (0559397067, 559397067, +971559397067 -> core 559397067)
      const getCoreUaeDigits = (d: string) => {
        let s = d;
        if (s.startsWith('971')) return s.slice(3);
        if (s.startsWith('0')) return s.slice(1);
        return s;
      };

      const qCore = getCoreUaeDigits(qDigits);
      const mobCore = getCoreUaeDigits(mobDigits);

      if (qCore && mobCore) {
        if (mobCore.includes(qCore) || qCore.includes(mobCore)) {
          return true;
        }
      }
    }

    return false;
  };

  // Filter available SIM cards by query (only when user has typed in search input)
  const filteredAvailableSims = useMemo(() => {
    const q = simSearchQuery.trim();
    // Do NOT load or display entire inventory when search query is empty
    if (!q) return [];

    return availableSims.filter((s) => {
      // AVAILABLE / UNASSIGNED ONLY
      const isAvailable =
        (s.assignment_status === 'Unassigned' || !s.current_employee_id) &&
        s.service_status !== 'Inactive';
      if (!isAvailable) return false;

      return matchSimRecord(s, q);
    });
  }, [availableSims, simSearchQuery]);

  // Active SIM record (either passed via prop or picked from available pool)
  const activeSim: SimRecord | null =
    sim || availableSims.find((s) => s.id === selectedSimId) || null;

  // Searchable Autocomplete Combobox State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SimEmployeeSearchCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [selectedCandidate, setSelectedCandidate] = useState<SimEmployeeSearchCandidate | null>(
    preselectedEmployee
      ? {
          id: preselectedEmployee.id,
          full_name: preselectedEmployee.full_name,
          employee_code: preselectedEmployee.employee_code || '',
          emirates_id: preselectedEmployee.emirates_id || '—',
          current_sim_id: preselectedEmployee.current_sim_id,
          current_sim_number: preselectedEmployee.current_sim_number,
          has_active_sim: Boolean(
            preselectedEmployee.current_sim_number || preselectedEmployee.current_sim_id
          ),
          primary_project: preselectedEmployee.primary_project || preselectedEmployee.project_name,
          current_bike_plate: preselectedEmployee.current_bike_plate,
        }
      : null
  );
  const comboboxRef = useRef<HTMLDivElement>(null);

  // Replacement SIM pool state (used when currentMode is REPLACE)
  const [selectedReplacementSimId, setSelectedReplacementSimId] = useState<string>('');

  // Form inputs
  const [packageAmount, setPackageAmount] = useState<number>(100);
  const [approvedAmount, setApprovedAmount] = useState<number>(100);
  const [payableAmount, setPayableAmount] = useState<number>(0);
  const [actionDate, setActionDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [undertakingFileName, setUndertakingFileName] = useState<string>('');
  const [returnReason, setReturnReason] = useState(MANDATORY_RETURN_REASONS[0]);
  const [swapReason, setSwapReason] = useState(MANDATORY_SWAP_REASONS[0]);
  const [transferReason, setTransferReason] = useState('');
  const [returnedBy, setReturnedBy] = useState('Operations Admin');
  const [returnTime, setReturnTime] = useState(new Date().toTimeString().slice(0, 5));

  // Execution state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [assignmentConflict, setAssignmentConflict] = useState<{
    type: 'EMPLOYEE_ALREADY_HAS_SIM' | 'SIM_ALREADY_ASSIGNED';
    message: string;
  } | null>(null);
  const [isConfirmingReturnExisting, setIsConfirmingReturnExisting] = useState(false);

  // Sync mode and preselected context on open
  useEffect(() => {
    if (!isOpen) return;
    setCurrentMode(initialMode || 'ASSIGN');
    setErrorMessage(null);
    setAssignmentConflict(null);
    setIsConfirmingReturnExisting(false);
    const user = authService.getCurrentUser();
    setReturnedBy(user?.name || user?.username || 'Operations Admin');
    setReturnTime(new Date().toTimeString().slice(0, 5));

    if (preselectedEmployee) {
      setSelectedCandidate({
        id: preselectedEmployee.id,
        full_name: preselectedEmployee.full_name,
        employee_code: preselectedEmployee.employee_code || '',
        emirates_id: preselectedEmployee.emirates_id || '—',
        current_sim_id: preselectedEmployee.current_sim_id,
        current_sim_number: preselectedEmployee.current_sim_number,
        has_active_sim: Boolean(
          preselectedEmployee.current_sim_number || preselectedEmployee.current_sim_id
        ),
        primary_project: preselectedEmployee.primary_project || preselectedEmployee.project_name,
        current_bike_plate: preselectedEmployee.current_bike_plate,
      });
    } else {
      setSelectedCandidate(null);
    }

    if (sim) {
      setSelectedSimId(sim.id);
      const pkg = Number(sim.monthly_package_amount) || 100;
      const app =
        sim.approved_amount !== undefined ? Number(sim.approved_amount) : pkg;
      setPackageAmount(pkg);
      setApprovedAmount(app);
      setPayableAmount(
        sim.payable_amount !== undefined
          ? Number(sim.payable_amount)
          : Math.max(0, pkg - app)
      );
    } else {
      setSelectedSimId('');
    }
  }, [isOpen, initialMode, sim, preselectedEmployee]);

  // Sync amounts when activeSim changes
  useEffect(() => {
    if (activeSim) {
      const pkg = Number(activeSim.monthly_package_amount) || 100;
      const app =
        activeSim.approved_amount !== undefined
          ? Number(activeSim.approved_amount)
          : pkg;
      setPackageAmount(pkg);
      setApprovedAmount(app);
      setPayableAmount(
        activeSim.payable_amount !== undefined
          ? Number(activeSim.payable_amount)
          : Math.max(0, pkg - app)
      );
    }
  }, [activeSim?.id]);

  // Fetch unassigned SIMs if launched without a pre-selected SIM or in REPLACE mode
  useEffect(() => {
    if (!isOpen) return;
    if (sim && currentMode !== 'REPLACE') return;

    const fetchSims = async () => {
      setIsLoadingAvailableSims(true);
      try {
        const res = await apiClient.get<any>('/api/erp/sims?assignment=UNASSIGNED&pageSize=1000&limit=1000');
        let pool: SimRecord[] = [];
        if (res.data?.items && Array.isArray(res.data.items)) {
          pool = res.data.items;
        } else if (Array.isArray(res.data)) {
          pool = res.data;
        }

        // Filter out inactive or current sim if replacing
        pool = pool.filter(
          (s) =>
            (s.assignment_status === 'Unassigned' || !s.current_employee_id || (s as any).status === 'Available') &&
            s.service_status !== 'Inactive' &&
            (!sim || s.id !== sim.id)
        );

        setAvailableSims(pool);
        // CRITICAL: Do NOT preselect first SIM when launched from Employee Management
        if (pool.length > 0 && !selectedReplacementSimId && currentMode === 'REPLACE') {
          setSelectedReplacementSimId(pool[0].id);
        }
      } catch (err) {
        console.error('Failed to load available SIMs pool:', err);
      } finally {
        setIsLoadingAvailableSims(false);
      }
    };

    fetchSims();
  }, [isOpen, currentMode, sim]);

  // Click outside listener for combobox dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search effect with 150ms debounce - returns matching authoritative employees immediately
  useEffect(() => {
    if (!isOpen || currentMode === 'RETURN' || currentMode === 'REPLACE') return;
    if (selectedCandidate) return;

    const trimmed = searchQuery.trim();
    if (!trimmed) {
      let active = true;
      fetchSimCustodyCandidates('').then((data) => {
        if (!active) return;
        if (data && Array.isArray(data)) {
          const candidates: SimEmployeeSearchCandidate[] = data.map((emp) => ({
            id: emp.id,
            full_name: emp.full_name || (emp as any).name,
            employee_code: emp.employee_code || '',
            emirates_id: emp.emirates_id || '—',
            current_status: emp.current_status || (emp as any).status || 'Active',
            has_active_sim: Boolean(emp.has_active_sim || emp.current_sim_number || emp.current_sim_id),
            current_sim_id: emp.current_sim_id,
            current_sim_number: emp.current_sim_number,
            visa_contractor_type: emp.visa_contractor_type,
            primary_project: emp.primary_project || emp.project_name || (emp as any).current_project_name,
            current_bike_plate: emp.current_bike_plate,
          }));
          setSearchResults(candidates);
        }
      });
      setIsSearching(false);
      return () => {
        active = false;
      };
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await fetchSimCustodyCandidates(trimmed);
        if (data && Array.isArray(data)) {
          const candidates: SimEmployeeSearchCandidate[] = data.map((emp) => ({
            id: emp.id,
            full_name: emp.full_name || (emp as any).name,
            employee_code: emp.employee_code || '',
            emirates_id: emp.emirates_id || '—',
            current_status: emp.current_status || (emp as any).status || 'Active',
            has_active_sim: Boolean(emp.has_active_sim || emp.current_sim_number || emp.current_sim_id),
            current_sim_id: emp.current_sim_id,
            current_sim_number: emp.current_sim_number,
            visa_contractor_type: emp.visa_contractor_type,
            primary_project: emp.primary_project || emp.project_name || (emp as any).current_project_name,
            current_bike_plate: emp.current_bike_plate,
          }));
          setSearchResults(candidates);
          setHighlightedIndex(0);
          setIsDropdownOpen(true);
        } else {
          setSearchResults([]);
        }
      } catch (e) {
        console.error('Failed to search authoritative employees:', e);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen, currentMode, selectedCandidate]);

  // Handle selecting an employee candidate from the dropdown
  const handleSelectCandidate = (emp: SimEmployeeSearchCandidate) => {
    setSelectedCandidate(emp);
    setIsDropdownOpen(false);
    setSearchQuery('');
    setErrorMessage(null);
    setAssignmentConflict(null);
    setIsConfirmingReturnExisting(false);

    const isInvalidSimValue = (val?: string | null) => {
      if (!val) return true;
      const s = String(val).toLowerCase().trim();
      return ['none assigned', 'none', '—', '-', 'null', 'undefined', 'unassigned', ''].includes(s);
    };

    const hasRealActiveSim = Boolean(
      (emp.has_active_sim && !isInvalidSimValue(emp.current_sim_number)) ||
      !isInvalidSimValue(emp.current_sim_number) ||
      !isInvalidSimValue(emp.current_sim_id)
    );

    if (hasRealActiveSim) {
      setAssignmentConflict({
        type: 'EMPLOYEE_ALREADY_HAS_SIM',
        message: `${emp.full_name} (${emp.employee_code}) already has an active primary SIM (${emp.current_sim_number || 'Active Line'}).`,
      });
    }
  };

  // Keyboard navigation for dropdown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isDropdownOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsDropdownOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
        handleSelectCandidate(searchResults[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  const resetForm = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedCandidate(null);
    setSelectedReplacementSimId('');
    setSelectedSimId(sim?.id || '');
    setNotes('');
    setUndertakingFileName('');
    setReturnReason(MANDATORY_RETURN_REASONS[0]);
    setSwapReason(MANDATORY_SWAP_REASONS[0]);
    setTransferReason('');
    setActionDate(new Date().toISOString().slice(0, 10));
    setErrorMessage(null);
    setAssignmentConflict(null);
    setIsConfirmingReturnExisting(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSwitchToReplace = () => {
    setCurrentMode('REPLACE');
    setErrorMessage(null);
    setAssignmentConflict(null);
  };

  const triggerRefresh = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('erp:sims-updated'));
      window.dispatchEvent(new CustomEvent('erp:master-employees-updated'));
      window.dispatchEvent(new CustomEvent('erp:employees-updated'));
      window.dispatchEvent(new CustomEvent('erp:assignments-updated'));
      window.dispatchEvent(new CustomEvent('erp:assets-updated'));
    }
  };

  const handleReturnExistingAndAssign = async () => {
    if (!activeSim || !selectedCandidate) return;
    const existingSimId = selectedCandidate.current_sim_id;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await apiClient.post(`/api/erp/sims/${activeSim.id}/return-and-assign`, {
        employee_id: selectedCandidate.id,
        old_sim_id: existingSimId || undefined,
        return_reason: 'Return existing SIM to assign new SIM',
        assigned_date: actionDate,
        monthly_package_amount: packageAmount,
        approved_amount: approvedAmount,
        payable_amount: payableAmount,
        notes: notes.trim() || undefined,
      });

      if (res.error) {
        setErrorMessage(`Atomic Return & Assign transaction failed: ${res.error}`);
      } else {
        triggerRefresh();
        onSuccess(
          res.data?.message ||
            `Successfully returned existing SIM and assigned ${activeSim.mobile_number} to ${selectedCandidate.full_name}.`
        );
        handleClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to execute Return & Assign transaction.');
    } finally {
      setIsSubmitting(false);
      setIsConfirmingReturnExisting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSim && currentMode !== 'REPLACE') {
      setErrorMessage('Please select an available SIM card.');
      return;
    }
    setErrorMessage(null);

    // Validate inputs per mode
    if (currentMode === 'ASSIGN') {
      if (!selectedCandidate) {
        setErrorMessage('Please search and select an employee / rider before assigning.');
        return;
      }
      const isInvalidSimValue = (val?: string | null) => {
        if (!val) return true;
        const s = String(val).toLowerCase().trim();
        return ['none assigned', 'none', '—', '-', 'null', 'undefined', 'unassigned', ''].includes(s);
      };

      const hasRealActiveSim = Boolean(
        selectedCandidate.has_active_sim &&
        !isInvalidSimValue(selectedCandidate.current_sim_number)
      );

      if (hasRealActiveSim) {
        setAssignmentConflict({
          type: 'EMPLOYEE_ALREADY_HAS_SIM',
          message: `EMPLOYEE_ALREADY_HAS_SIM: ${selectedCandidate.full_name} (${selectedCandidate.employee_code}) already has an active primary SIM (${selectedCandidate.current_sim_number || 'Active Line'}). Overlapping assignments are prohibited.`,
        });
        setErrorMessage(
          `Safety Rule Enforced: ${selectedCandidate.full_name} already has an active primary SIM (${selectedCandidate.current_sim_number || 'Active Line'}). Overlapping assignments are prohibited. Please choose Replace SIM, Return Existing First, or Cancel.`
        );
        return;
      }
    } else if (currentMode === 'TRANSFER') {
      if (!selectedCandidate) {
        setErrorMessage('Please select a destination employee / delivery rider for the transfer.');
        return;
      }
      if (!transferReason.trim()) {
        setErrorMessage('Transfer Reason is mandatory.');
        return;
      }
      if (selectedCandidate.has_active_sim) {
        setErrorMessage(
          `Destination employee ${selectedCandidate.full_name} already has an active SIM (${selectedCandidate.current_sim_number}). Cannot perform direct transfer without returning or replacing.`
        );
        return;
      }
    } else if (currentMode === 'RETURN') {
      if (!returnReason.trim()) {
        setErrorMessage('Return reason is mandatory.');
        return;
      }
      if (!confirmed) {
        setErrorMessage('Please confirm the SIM return to depot stock.');
        return;
      }
    } else if (currentMode === 'REPLACE') {
      if (!swapReason.trim()) {
        setErrorMessage('Swap reason is mandatory for SIM replacement.');
        return;
      }

      if (activeSim && (activeSim.assignment_status === 'Assigned' || activeSim.status === 'Assigned')) {
        if (!selectedReplacementSimId) {
          setErrorMessage('Please select an unassigned replacement SIM from the pool.');
          return;
        }
      } else if (selectedCandidate && selectedCandidate.current_sim_id) {
        // Swapping for an employee who has an active SIM into this current unassigned SIM
      } else {
        setErrorMessage('Replacement context is incomplete. Please ensure both old and new SIMs are specified.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (currentMode === 'ASSIGN') {
        const res = await apiClient.post(`/api/erp/sims/${activeSim!.id}/assign`, {
          employee_id: selectedCandidate!.id,
          employee_name: selectedCandidate!.full_name,
          employee_code: selectedCandidate!.employee_code,
          emirates_id: selectedCandidate!.emirates_id,
          assigned_date: actionDate,
          monthly_package_amount: packageAmount,
          approved_amount: approvedAmount,
          payable_amount: payableAmount,
          notes: notes.trim() || undefined,
        });

        if (res.error) {
          if (res.code === 'EMPLOYEE_ALREADY_HAS_SIM' || res.error.includes('EMPLOYEE_ALREADY_HAS_SIM')) {
            setAssignmentConflict({
              type: 'EMPLOYEE_ALREADY_HAS_SIM',
              message: res.error,
            });
          } else if (res.code === 'SIM_ALREADY_ASSIGNED' || res.error.includes('SIM_ALREADY_ASSIGNED')) {
            setAssignmentConflict({
              type: 'SIM_ALREADY_ASSIGNED',
              message: res.error,
            });
          }
          setErrorMessage(res.error);
        } else {
          triggerRefresh();
          onSuccess(
            res.data?.message ||
              `SIM ${activeSim!.mobile_number} successfully assigned to ${selectedCandidate!.full_name}.`
          );
          handleClose();
        }
      } else if (currentMode === 'TRANSFER') {
        const res = await apiClient.post(`/api/erp/sims/${activeSim!.id}/transfer`, {
          new_employee_id: selectedCandidate!.id,
          new_employee_name: selectedCandidate!.full_name,
          new_employee_code: selectedCandidate!.employee_code,
          new_emirates_id: selectedCandidate!.emirates_id,
          new_project_name: selectedCandidate!.primary_project || selectedCandidate!.project_name,
          new_vehicle_plate: selectedCandidate!.current_bike_plate,
          transfer_date: actionDate,
          transfer_reason: transferReason.trim(),
          notes: notes.trim() || undefined,
        });

        if (res.error) {
          setErrorMessage(res.error);
        } else {
          triggerRefresh();
          onSuccess(
            res.data?.message ||
              `SIM ${activeSim!.mobile_number} successfully transferred to ${selectedCandidate!.full_name}.`
          );
          handleClose();
        }
      } else if (currentMode === 'RETURN') {
        const res = await apiClient.post(`/api/erp/sims/${activeSim!.id}/unassign`, {
          return_date: actionDate,
          return_time: returnTime,
          reason: returnReason,
          return_reason: returnReason,
          returned_by: returnedBy,
          notes: notes.trim() || undefined,
          employee_id: preselectedEmployee?.id || activeSim?.current_employee_id || activeSim?.assigned_to_id,
          employee_code: preselectedEmployee?.employee_code || activeSim?.current_employee_code,
          employee_name: preselectedEmployee?.full_name || activeSim?.current_employee_name || activeSim?.assigned_to_name,
          mobile_number: activeSim?.mobile_number,
        });

        if (res.error) {
          setErrorMessage(res.error);
        } else {
          triggerRefresh();
          onSuccess(
            res.data?.message ||
              `SIM ${activeSim!.mobile_number} returned to inventory pool.`
          );
          handleClose();
        }
      } else if (currentMode === 'REPLACE') {
        let oldSimId = activeSim?.id || '';
        let newSimId = selectedReplacementSimId;
        let empId = activeSim?.current_employee_id;

        if (selectedCandidate && selectedCandidate.current_sim_id) {
          oldSimId = selectedCandidate.current_sim_id;
          newSimId = activeSim?.id || '';
          empId = selectedCandidate.id;
        }

        const res = await apiClient.post('/api/erp/sims/replace', {
          old_sim_id: oldSimId,
          new_sim_id: newSimId,
          employee_id: empId,
          swap_reason: swapReason.trim(),
          swap_date: actionDate,
          notes: notes.trim() || undefined,
        });

        if (res.error) {
          setErrorMessage(res.error);
        } else {
          triggerRefresh();
          onSuccess(
            res.data?.message || 'SIM Line successfully swapped.'
          );
          handleClose();
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Operation failed. Please check server logs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const titles = {
    ASSIGN: activeSim ? `Assign SIM Line — ${activeSim.mobile_number}` : 'Assign SIM Line to User',
    TRANSFER: activeSim ? `Transfer SIM Line — ${activeSim.mobile_number}` : 'Transfer SIM Line',
    RETURN: activeSim ? `Return SIM to Inventory Pool — ${activeSim.mobile_number}` : 'Return SIM',
    REPLACE: activeSim ? `Atomic Replace SIM — ${activeSim.mobile_number}` : 'Atomic Replace SIM',
  };

  const subtitles = {
    ASSIGN: 'Authorize SIM line handover to active workforce member with duplicate assignment prevention.',
    TRANSFER: 'Reallocate SIM from current rider to another delivery team member atomically in a single transaction.',
    RETURN: 'Discharge rider custody and return SIM card to available inventory pool.',
    REPLACE: 'Execute 1-step atomic swap: close old assignment, activate replacement SIM, and sync records.',
  };

  const isCandidateAlreadyAssigned =
    currentMode === 'ASSIGN' &&
    selectedCandidate &&
    Boolean(
      selectedCandidate.has_active_sim &&
      selectedCandidate.current_sim_number &&
      !['none assigned', 'none', '—', '-', 'null', 'undefined', 'unassigned', ''].includes(
        String(selectedCandidate.current_sim_number).toLowerCase().trim()
      )
    );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={titles[currentMode]}
      subtitle={subtitles[currentMode]}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Active SIM Summary Card (only if SIM is pre-selected via props, e.g. from SIM Management) */}
        {sim && activeSim && (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0">
                <PhoneCall className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-900 dark:text-white font-mono text-sm flex items-center gap-2">
                  <span>{activeSim.mobile_number}</span>
                  <span className="text-[10px] font-sans px-2 py-0.5 rounded-full font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    {activeSim.provider || activeSim.vendor || 'ETISALAT'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                  <span>ICCID: {activeSim.iccid || activeSim.sim_serial_number || '—'}</span>
                  <span>•</span>
                  <span>{activeSim.plan || 'Standard Fleet Plan'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  activeSim.assignment_status === 'Assigned' || activeSim.status === 'Assigned'
                    ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                }`}
              >
                {activeSim.assignment_status || (activeSim.status === 'Assigned' ? 'Assigned' : 'Unassigned')}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  activeSim.service_status === 'Active' || activeSim.is_active
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                }`}
              >
                Service: {activeSim.service_status || (activeSim.is_active ? 'Active' : 'Inactive')}
              </span>
            </div>
          </div>
        )}

        {/* Current Holder Display (for Transfer / Return / Replace) */}
        {(currentMode === 'TRANSFER' || currentMode === 'RETURN' || currentMode === 'REPLACE') &&
          activeSim?.current_employee_name && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-1">
              <div className="text-[11px] font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                Current Custodian / Assigned Rider:
              </div>
              <div className="text-slate-900 dark:text-white font-medium text-sm">
                {activeSim.current_employee_name}{' '}
                <span className="font-mono text-xs text-slate-500">
                  ({activeSim.current_employee_code || 'ID: ' + activeSim.current_employee_id})
                </span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-3">
                {activeSim.current_project_name && <span>Project: {activeSim.current_project_name}</span>}
                {activeSim.current_vehicle_plate && <span>Vehicle: {activeSim.current_vehicle_plate}</span>}
                {activeSim.assigned_date && <span>Assigned Since: {activeSim.assigned_date}</span>}
              </div>
            </div>
          )}

        {/* If SIM was not pre-selected (e.g. launched from Employee Management), show searchable SIM selector */}
        {!sim && currentMode === 'ASSIGN' && (
          <div className="space-y-2">
            {activeSim ? (
              /* Selected SIM Card with "Change" button */
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Selected SIM Card <span className="text-rose-500">*</span>
                </label>
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm shrink-0">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                          {activeSim.mobile_number || (activeSim as any).simNumber}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                          {activeSim.provider || (activeSim as any).vendor || 'ETISALAT'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          {activeSim.assignment_status || 'Available'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                        <span>ICCID: {activeSim.iccid || (activeSim as any).sim_serial_number || '—'}</span>
                        <span className="text-slate-400 font-sans">• Package: {activeSim.monthly_package_amount !== undefined ? activeSim.monthly_package_amount : 100} AED</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSimId('');
                      setSimSearchQuery('');
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-white hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 rounded-lg transition-colors shrink-0 cursor-pointer shadow-2xs"
                  >
                    Change
                  </button>
                </div>
              </div>
            ) : (
              /* Searchable SIM Selector */
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Search Available SIM Card <span className="text-rose-500">*</span>
                </label>

                {/* SIM Search Input (Search by SIM/mobile number, ICCID) */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={simSearchQuery}
                    onChange={(e) => setSimSearchQuery(e.target.value)}
                    placeholder="Search SIM number, ICCID or provider..."
                    className="w-full pl-10 pr-9 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                  {simSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setSimSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {isLoadingAvailableSims ? (
                  <div className="p-3 text-center text-slate-400 flex items-center justify-center gap-2 text-xs">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
                    <span>Searching available inventory...</span>
                  </div>
                ) : !simSearchQuery.trim() ? (
                  <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                    Type SIM number (e.g. 0559397067), ICCID, or provider (e.g. DU, ETISALAT) to find matching available SIMs
                  </div>
                ) : filteredAvailableSims.length === 0 ? (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-700 dark:text-amber-300 text-xs">
                    No available SIM matching "{simSearchQuery}". Try another number, ICCID, or provider.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {filteredAvailableSims.map((s) => {
                      const simNumber = s.mobile_number || (s as any).simNumber || (s as any).sim_number || '—';
                      const iccid = s.iccid || (s as any).sim_serial_number || (s as any).serial_number || '—';
                      const vendor = s.provider || (s as any).vendor || 'ETISALAT';
                      const packageAed = s.monthly_package_amount !== undefined ? `${s.monthly_package_amount} AED` : '100 AED';
                      const status = s.assignment_status || 'Available';

                      return (
                        <div
                          key={s.id}
                          onClick={() => {
                            setSelectedSimId(s.id);
                            const pkg = Number(s.monthly_package_amount) || 100;
                            const app = s.approved_amount !== undefined ? Number(s.approved_amount) : pkg;
                            setPackageAmount(pkg);
                            setApprovedAmount(app);
                            setPayableAmount(s.payable_amount !== undefined ? Number(s.payable_amount) : Math.max(0, pkg - app));
                          }}
                          className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-3 group shadow-2xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                              <Smartphone className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                                  {simNumber}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                  {vendor}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 truncate">
                                ICCID: {iccid}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                              {packageAed}
                            </div>
                            <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              {status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Error message banner */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-2 text-rose-800 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <div className="text-xs leading-relaxed font-medium">{errorMessage}</div>
          </div>
        )}

        {/* 1. ASSIGN / TRANSFER: SEARCHABLE USER AUTOCOMPLETE COMBOBOX */}
        {(currentMode === 'ASSIGN' || currentMode === 'TRANSFER') && (
          <div className="space-y-2">
            {selectedCandidate ? (
              /* Selected User Card */
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {currentMode === 'TRANSFER' ? 'Transfer To (Destination User)' : 'User'}{' '}
                  <span className="text-rose-500">*</span>
                </label>
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      {/* Top line (bold / main text): Employee Name */}
                      <div className="font-bold text-slate-900 dark:text-white text-xs truncate">
                        {selectedCandidate.full_name}
                      </div>
                      {/* Second line: Emirates ID + optional Employee Code */}
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                        <span>
                          {selectedCandidate.emirates_id && selectedCandidate.emirates_id !== '—'
                            ? selectedCandidate.emirates_id
                            : selectedCandidate.id}
                        </span>
                        {selectedCandidate.employee_code && (
                          <span className="text-slate-400 font-sans">• {selectedCandidate.employee_code}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCandidate(null);
                      setSearchQuery('');
                      setAssignmentConflict(null);
                      setErrorMessage(null);
                      setIsConfirmingReturnExisting(false);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-white hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 rounded-lg transition-colors shrink-0"
                  >
                    Change
                  </button>
                </div>

                {/* SAFETY RULE WARNING IF EMPLOYEE ALREADY HAS ACTIVE SIM */}
                {(isCandidateAlreadyAssigned ||
                  assignmentConflict?.type === 'EMPLOYEE_ALREADY_HAS_SIM') && (
                  <div className="p-3.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 rounded-xl space-y-2 text-xs">
                    <div className="flex items-start gap-2 text-amber-900 dark:text-amber-200 font-bold">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span>SIM already assigned: </span>
                        <span>
                          {selectedCandidate.full_name} already holds an active SIM (
                          <strong className="font-mono">
                            {selectedCandidate.current_sim_number || 'Active Line'}
                          </strong>
                          ).
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 pl-6 leading-relaxed">
                      Company policy strictly prohibits duplicate active SIM assignments to the same employee. Normal assignment is blocked. Please choose <strong>Replace SIM</strong> to swap lines atomically, or return the existing line first.
                    </p>

                    {isConfirmingReturnExisting ? (
                      <div className="p-2.5 bg-amber-100/80 dark:bg-amber-900/60 rounded-lg space-y-2 border border-amber-300 dark:border-amber-700 ml-6">
                        <div className="text-xs font-semibold text-amber-950 dark:text-amber-100">
                          Execute atomic transaction: Return SIM {selectedCandidate.current_sim_number} to stock AND assign new SIM {activeSim?.mobile_number}?
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={handleReturnExistingAndAssign}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors"
                          >
                            {isSubmitting ? 'Processing Transaction...' : 'Confirm Return & Assign'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsConfirmingReturnExisting(false)}
                            className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-medium transition-colors"
                          >
                            Back
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 pl-6 pt-1">
                        <button
                          type="button"
                          onClick={handleSwitchToReplace}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                          <span>Switch to Replace SIM</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsConfirmingReturnExisting(true)}
                          className="px-3 py-1.5 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-amber-300 dark:border-amber-700 font-bold rounded-lg text-xs transition-colors"
                        >
                          Return Existing &amp; Assign
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Searchable Autocomplete Combobox */
              <div className="relative" ref={comboboxRef}>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {currentMode === 'TRANSFER' ? 'Transfer To (Destination User)' : 'User'}{' '}
                  <span className="text-rose-500">*</span>
                </label>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search employee..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    onKeyDown={handleKeyDown}
                    className="w-full pl-9 pr-9 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-2xs"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                    {isSearching ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
                    ) : (
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${
                          isDropdownOpen ? 'rotate-180' : ''
                        }`}
                      />
                    )}
                  </div>
                </div>

                {/* Dropdown Results Overlay */}
                {isDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {!searchQuery.trim() ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        Type name, employee code (ADL), Emirates ID, or phone to search...
                      </div>
                    ) : isSearching ? (
                      <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
                        <span>Searching active workforce...</span>
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        No matching eligible employees found.
                      </div>
                    ) : (
                      searchResults.map((emp, idx) => (
                        <div
                          key={emp.id}
                          onClick={() => handleSelectCandidate(emp)}
                          className={`px-4 py-3 cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                            highlightedIndex === idx
                              ? 'bg-blue-50/70 dark:bg-blue-950/50'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/80'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            {/* Top line (bold / main text): Employee Name */}
                            <div className="font-bold text-slate-900 dark:text-white text-xs truncate">
                              {emp.full_name}
                            </div>
                            {/* Second line: Emirates ID (or employee ID if Emirates ID not present) */}
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                              <span>
                                {emp.emirates_id && emp.emirates_id !== '—'
                                  ? emp.emirates_id
                                  : emp.id}
                              </span>
                              {emp.employee_code && (
                                <span className="text-slate-400 font-sans">• {emp.employee_code}</span>
                              )}
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className="shrink-0 text-right">
                            {emp.has_active_sim || emp.current_sim_number || emp.current_sim_id ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                <span>SIM already assigned: {emp.current_sim_number || 'Active'}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                <span>Eligible</span>
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. REPLACE SIM: Pool & Reason */}
        {currentMode === 'REPLACE' && (
          <div className="space-y-3">
            {activeSim && (activeSim.assignment_status === 'Assigned' || activeSim.status === 'Assigned') && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Replacement SIM from Pool (Must be Unassigned) <span className="text-rose-500">*</span>
                </label>
                {isLoadingAvailableSims ? (
                  <div className="p-3 text-center text-slate-400 flex items-center justify-center gap-2 text-xs">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
                    <span>Loading available replacement SIM cards...</span>
                  </div>
                ) : availableSims.length === 0 ? (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300">
                    No unassigned SIM cards available in the inventory pool. Please register a new SIM first.
                  </div>
                ) : (
                  <select
                    required
                    value={selectedReplacementSimId}
                    onChange={(e) => setSelectedReplacementSimId(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-mono font-medium focus:ring-2 focus:ring-blue-500"
                  >
                    {availableSims.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.mobile_number} — {s.provider || s.vendor} (Pkg: {s.monthly_package_amount || 0} AED)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {selectedCandidate && selectedCandidate.current_sim_id && (
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-2">
                <div className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Atomic 1-Step SIM Swap Context:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-indigo-100 dark:border-indigo-900">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
                      1. Old Active SIM to Return
                    </span>
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                      {selectedCandidate.current_sim_number}
                    </span>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-indigo-100 dark:border-indigo-900">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
                      2. New SIM Being Issued
                    </span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {activeSim?.mobile_number || 'New SIM'}
                    </span>
                  </div>
                </div>
                <div className="text-[11px] text-indigo-800 dark:text-indigo-300">
                  Target Rider: <strong>{selectedCandidate.full_name}</strong> ({selectedCandidate.employee_code})
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Swap Reason (Mandatory) <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={swapReason}
                onChange={(e) => setSwapReason(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl border border-slate-300 dark:border-slate-700 text-xs focus:ring-2 focus:ring-blue-500"
              >
                {MANDATORY_SWAP_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {currentMode === 'RETURN' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Return Reason (Mandatory) <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold focus:ring-2 focus:ring-blue-500"
                >
                  {MANDATORY_RETURN_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Returned By (ERP Operator) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={returnedBy}
                  onChange={(e) => setReturnedBy(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <input
                type="checkbox"
                id="confirm-return-sim"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
              />
              <label htmlFor="confirm-return-sim" className="text-xs text-amber-900 dark:text-amber-200 font-bold">
                I confirm this SIM is being returned to depot stock.
              </label>
            </div>
          </div>
        )}

        {/* 4. TRANSFER SIM: Reason */}
        {currentMode === 'TRANSFER' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Transfer Reason (Mandatory) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Route realignment / Project transfer"
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl border border-slate-300 dark:border-slate-700 text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* 7. PRESERVE ALL SIM ASSIGN LOGIC: Useful SIM fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              SIM Number
            </label>
            <input
              type="text"
              readOnly
              value={activeSim ? activeSim.mobile_number : 'Select SIM above'}
              className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs cursor-not-allowed font-bold"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Vendor
            </label>
            <input
              type="text"
              readOnly
              value={activeSim ? activeSim.provider || activeSim.vendor || '—' : '—'}
              className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs cursor-not-allowed font-medium"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              SIM Package Amount (AED)
            </label>
            <input
              type="number"
              min="0"
              value={packageAmount}
              onChange={(e) => {
                const val = Number(e.target.value);
                setPackageAmount(val);
                setPayableAmount(Math.max(0, val - approvedAmount));
              }}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-medium focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Approved Amount (AED)
            </label>
            <input
              type="number"
              min="0"
              value={approvedAmount}
              onChange={(e) => {
                const val = Number(e.target.value);
                setApprovedAmount(val);
                setPayableAmount(Math.max(0, packageAmount - val));
              }}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-medium focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Payable Amount (AED)
            </label>
            <input
              type="number"
              min="0"
              value={payableAmount}
              onChange={(e) => setPayableAmount(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-medium focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Assignment Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={actionDate}
              onChange={(e) => setActionDate(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Assignment Note & Handover Undertaking File */}
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Assignment Note (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Add any administrative handover notes or remarks..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Signed Handover Undertaking (Optional File)
            </label>
            <div className="flex items-center gap-2">
              <label className="px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl text-xs font-medium cursor-pointer flex items-center gap-2 transition-colors">
                <FileUp className="w-3.5 h-3.5 text-blue-600" />
                <span>Choose Document</span>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setUndertakingFileName(f.name);
                  }}
                />
              </label>
              {undertakingFileName ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-lg text-xs border border-blue-200 dark:border-blue-800">
                  <span className="truncate max-w-xs">{undertakingFileName}</span>
                  <button
                    type="button"
                    onClick={() => setUndertakingFileName('')}
                    className="hover:text-rose-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <span className="text-[11px] text-slate-400">No file attached</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-blue-600" />
            <span>PostgreSQL Authoritative RPC Transaction</span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                isSubmitting ||
                Boolean(isCandidateAlreadyAssigned) ||
                (currentMode === 'ASSIGN' && (!activeSim || !selectedCandidate)) ||
                (currentMode === 'TRANSFER' && (!activeSim || !selectedCandidate)) ||
                (currentMode === 'RETURN' && (!activeSim || !confirmed)) ||
                (currentMode === 'REPLACE' && (!activeSim || !selectedReplacementSimId))
              }
              className={`px-5 py-2 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                currentMode === 'RETURN'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : currentMode === 'TRANSFER'
                  ? 'bg-purple-600 hover:bg-purple-700'
                  : currentMode === 'REPLACE'
                  ? 'bg-indigo-600 hover:bg-indigo-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing DB Transaction...</span>
                </>
              ) : currentMode === 'RETURN' ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Confirm Atomic Return</span>
                </>
              ) : currentMode === 'TRANSFER' ? (
                <>
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Confirm Line Transfer</span>
                </>
              ) : currentMode === 'REPLACE' ? (
                <>
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Execute 1-Step SIM Swap</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Confirm SIM Assignment</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
