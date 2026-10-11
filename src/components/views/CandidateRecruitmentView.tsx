import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  RotateCcw,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Briefcase,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Shield,
  FileCheck,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Info,
  Layers,
  Lock,
  UserPlus,
  Save,
  Trash2,
  Smartphone,
  Truck,
  CreditCard,
  Package,
  Boxes,
  FileText,
  ExternalLink,
  UserCheck,
  Filter,
  Check,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { CandidateRecord, NavigationModule } from '../../types/erp';
import { candidateService } from '../../services/candidateService';

interface CandidateRecruitmentViewProps {
  onNavigateModule?: (module: NavigationModule) => void;
  lang?: 'EN' | 'AR';
}

export const INITIAL_CANDIDATES: CandidateRecord[] = [];

export const CandidateRecruitmentView: React.FC<CandidateRecruitmentViewProps> = ({
  onNavigateModule,
  lang = 'EN',
}) => {
  // Cloud Database Persistence via candidateService
  const [candidates, setCandidates] = useState<CandidateRecord[]>([]);

  useEffect(() => {
    candidateService.getCandidates().then((data) => {
      setCandidates(data || []);
    }).catch((err) => {
      console.warn('Error fetching candidate pipeline:', err);
      setCandidates([]);
    });
  }, []);

  // Sidebar Filter by Stage

  const [selectedStageFilter, setSelectedStageFilter] = useState<string>('ALL');

  // Search and Header Filters
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterCurrentStage, setFilterCurrentStage] = useState('All Stages');
  const [filterCurrentStatus, setFilterCurrentStatus] = useState('All');
  const [pageSize, setPageSize] = useState('15 records');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Modal State for New Candidate / Stage Update
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'NEW' | 'UPDATE_STAGE'>('NEW');
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateRecord | null>(null);

  // Form inputs
  const [newFullName, setNewFullName] = useState('');
  const [newUniqueId, setNewUniqueId] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newPassport, setNewPassport] = useState('');
  const [newLicensePackage, setNewLicensePackage] = useState('Visa Only');
  const [newTotalPackage, setNewTotalPackage] = useState('6000');
  const [newAdvance, setNewAdvance] = useState('1000');

  // Stage details update state
  const [stageToUpdate, setStageToUpdate] = useState<'STAGE_1' | 'STAGE_2' | 'STAGE_3' | 'STAGE_4' | 'STAGE_5' | 'STAGE_6'>('STAGE_2');
  const [newStageStatus, setNewStageStatus] = useState<'Open' | 'Completed' | 'Not Started' | 'Skipped'>('Completed');

  // Filter Logic
  const filteredCandidates = candidates.filter((cand) => {
    const keywordMatch =
      cand.fullName.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      cand.uniqueId.includes(searchKeyword) ||
      cand.cnicPassport.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      cand.mobile.includes(searchKeyword) ||
      cand.candidateId.includes(searchKeyword);

    let stageMatch = true;
    if (selectedStageFilter !== 'ALL') {
      if (selectedStageFilter === 'STAGE_1') stageMatch = cand.currentStageCode === 'STAGE_1';
      else if (selectedStageFilter === 'STAGE_2') stageMatch = cand.currentStageCode === 'STAGE_2';
      else if (selectedStageFilter === 'STAGE_3') stageMatch = cand.currentStageCode === 'STAGE_3';
      else if (selectedStageFilter === 'STAGE_4') stageMatch = cand.currentStageCode === 'STAGE_4';
      else if (selectedStageFilter === 'STAGE_5') stageMatch = cand.currentStageCode === 'STAGE_5';
      else if (selectedStageFilter === 'STAGE_6') stageMatch = cand.currentStageCode === 'STAGE_6';
    }

    let currentStageDropdownMatch = true;
    if (filterCurrentStage !== 'All Stages') {
      currentStageDropdownMatch = cand.currentStage === filterCurrentStage;
    }

    let statusMatch = true;
    if (filterCurrentStatus !== 'All') {
      statusMatch = cand.stageStatus === filterCurrentStatus;
    }

    return keywordMatch && stageMatch && currentStageDropdownMatch && statusMatch;
  });

  // Stage Summary Counts
  const notStartedCount = candidates.filter((c) => c.stageStatus === 'Not Started').length;
  const openCount = candidates.filter((c) => c.stageStatus === 'Open').length;
  const completedCount = candidates.filter((c) => c.stageStatus === 'Completed').length;
  const skippedCount = candidates.filter((c) => c.stageStatus === 'Skipped').length;

  // Sidebar Stage Specific Counts
  const stage1Count = candidates.filter((c) => c.currentStageCode === 'STAGE_1').length;
  const stage2Count = candidates.filter((c) => c.currentStageCode === 'STAGE_2').length;
  const stage3Count = candidates.filter((c) => c.currentStageCode === 'STAGE_3').length;
  const stage4Count = candidates.filter((c) => c.currentStageCode === 'STAGE_4').length;
  const stage5Count = candidates.filter((c) => c.currentStageCode === 'STAGE_5').length;
  const stage6Count = candidates.filter((c) => c.currentStageCode === 'STAGE_6').length;

  // Actions
  const handleOpenNewModal = () => {
    setNewFullName('');
    setNewUniqueId(`784${Math.floor(100000000000 + Math.random() * 900000000000)}`);
    setNewMobile('050' + Math.floor(1000000 + Math.random() * 9000000));
    setNewPassport('P' + Math.floor(1000000 + Math.random() * 9000000));
    setNewLicensePackage('Visa Only');
    setNewTotalPackage('6000');
    setNewAdvance('1000');
    setModalMode('NEW');
    setIsModalOpen(true);
  };

  const handleCreateCandidate = (e: React.FormEvent) => {
    e.preventDefault();
    const nextIdNumber = candidates.length > 0 ? Math.max(...candidates.map((c) => parseInt(c.candidateId) || 120)) + 1 : 128;
    const tot = parseFloat(newTotalPackage) || 6000;
    const adv = parseFloat(newAdvance) || 1000;

    const newRecord: CandidateRecord = {
      id: `cand_${nextIdNumber}`,
      candidateId: nextIdNumber.toString(),
      fullName: newFullName || 'New Candidate',
      uniqueId: newUniqueId,
      cnicPassport: newPassport,
      mobile: newMobile,
      createdDate: new Date().toISOString().split('T')[0],
      interview: 'Pass',
      status: 'Active',
      licensePackageType: newLicensePackage,
      totalPackage: tot,
      advance: adv,
      balance: Math.max(0, tot - adv),
      perMonthDeduction: 0,
      currentStage: 'Visa Deal & Documentation',
      currentStageCode: 'STAGE_2',
      stageStatus: 'Open',
      stage1Status: 'Completed',
      stage2Status: 'Open',
      stage3Status: 'Not Started',
      stage4Status: 'Not Started',
      stage5Status: 'Not Started',
      stage6Status: 'Not Started',
      visaProcess: {
        current: 'Not started',
        completed: '—',
        elapsed: '—',
        next: 'Offer Letter',
      },
      dlProcess: {
        current: 'Not started',
        completed: '—',
        elapsed: '—',
        next: 'Eye Test',
      },
    };

    setCandidates([newRecord, ...candidates]);
    candidateService.createCandidate(newRecord).catch((e) => console.warn('Candidate sync status:', e));
    setIsModalOpen(false);
  };

  const handleOpenStageUpdate = (cand: CandidateRecord) => {
    setSelectedCandidate(cand);
    setStageToUpdate(cand.currentStageCode);
    setNewStageStatus('Completed');
    setModalMode('UPDATE_STAGE');
    setIsModalOpen(true);
  };

  const handleUpdateStageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCandidate) return;

    setCandidates((prev) =>
      prev.map((c) => {
        if (c.id === selectedCandidate.id) {
          let updatedCurrentStage = c.currentStage;
          let updatedCurrentStageCode = c.currentStageCode;
          let updatedStageStatus = c.stageStatus;

          let s1 = c.stage1Status;
          let s2 = c.stage2Status;
          let s3 = c.stage3Status;
          let s4 = c.stage4Status;
          let s5 = c.stage5Status;
          let s6 = c.stage6Status;

          if (stageToUpdate === 'STAGE_1') s1 = newStageStatus;
          if (stageToUpdate === 'STAGE_2') s2 = newStageStatus;
          if (stageToUpdate === 'STAGE_3') s3 = newStageStatus;
          if (stageToUpdate === 'STAGE_4') s4 = newStageStatus;
          if (stageToUpdate === 'STAGE_5') s5 = newStageStatus;
          if (stageToUpdate === 'STAGE_6') s6 = newStageStatus;

          // Advance to next stage automatically if marked Completed
          if (newStageStatus === 'Completed') {
            if (stageToUpdate === 'STAGE_1') {
              s2 = 'Open';
              updatedCurrentStage = 'Visa Deal & Documentation';
              updatedCurrentStageCode = 'STAGE_2';
            } else if (stageToUpdate === 'STAGE_2') {
              s3 = 'Open';
              updatedCurrentStage = 'Visa & ID Process';
              updatedCurrentStageCode = 'STAGE_3';
            } else if (stageToUpdate === 'STAGE_3') {
              s4 = 'Open';
              updatedCurrentStage = 'Driving License';
              updatedCurrentStageCode = 'STAGE_4';
            } else if (stageToUpdate === 'STAGE_4') {
              s5 = 'Open';
              updatedCurrentStage = 'RTA / Food Permit';
              updatedCurrentStageCode = 'STAGE_5';
            } else if (stageToUpdate === 'STAGE_5') {
              s6 = 'Open';
              updatedCurrentStage = 'Permits & Document Validation';
              updatedCurrentStageCode = 'STAGE_6';
            } else if (stageToUpdate === 'STAGE_6') {
              updatedStageStatus = 'Completed';
            }
          }

          const updatedCandidateObj = {
            ...c,
            currentStage: updatedCurrentStage,
            currentStageCode: updatedCurrentStageCode,
            stageStatus: updatedStageStatus,
            stage1Status: s1,
            stage2Status: s2,
            stage3Status: s3,
            stage4Status: s4,
            stage5Status: s5,
            stage6Status: s6,
          };
          candidateService.updateCandidate(c.id, updatedCandidateObj).catch((e) => console.warn('Candidate update sync:', e));
          return updatedCandidateObj;
        }
        return c;
      })
    );
    setIsModalOpen(false);
  };

  const handleCloseApplication = (candId: string) => {
    if (confirm('Are you sure you want to close this candidate application?')) {
      setCandidates((prev) =>
        prev.map((c) => (c.id === candId ? { ...c, status: 'Closed', stageStatus: 'Skipped' } : c))
      );
    }
  };

  const handleConvertToEmployee = (cand: CandidateRecord) => {
    alert(`Candidate "${cand.fullName}" has been processed and converted to Employee!`);
    if (onNavigateModule) {
      onNavigateModule('employees_list');
    }
  };

  // Active Stage Detail View State
  const [activeStageCandidate, setActiveStageCandidate] = useState<CandidateRecord | null>(null);
  const [activeStageNumber, setActiveStageNumber] = useState<number | null>(null); // 1, 2, 3, 4, 5, 6
  const [stageSuccessToast, setStageSuccessToast] = useState<string | null>(null);

  // Form states for Stage 1 (Employee Initial Process)
  const [stage1FirstName, setStage1FirstName] = useState('');
  const [stage1LastName, setStage1LastName] = useState('');
  const [stage1Gender, setStage1Gender] = useState('Male');
  const [stage1Dob, setStage1Dob] = useState('1995-11-25');
  const [stage1Nationality, setStage1Nationality] = useState('Pakistan');
  const [stage1UniqueId, setStage1UniqueId] = useState('');
  const [stage1PassportNo, setStage1PassportNo] = useState('');
  const [stage1PersonalPhone, setStage1PersonalPhone] = useState('0000000000000');
  const [stage1Address, setStage1Address] = useState('Dubai');
  const [stage1EmergencyContact, setStage1EmergencyContact] = useState('Ahmed');
  const [stage1EmergencyPhone, setStage1EmergencyPhone] = useState('0555379091');
  const [stage1PassportPossession, setStage1PassportPossession] = useState('In Office');
  const [stage1ReportingManager, setStage1ReportingManager] = useState('System User');
  const [stage1Shift, setStage1Shift] = useState('Morning Shift');
  const [stage1Team, setStage1Team] = useState('Delivery Team');
  const [stage1DateOfJoining, setStage1DateOfJoining] = useState('2026-07-30');
  const [stage1Department, setStage1Department] = useState('Operations');
  const [stage1Designation, setStage1Designation] = useState('Bike Rider');
  const [stage1InterviewStatus, setStage1InterviewStatus] = useState<'Pass' | 'Fail' | 'Pending'>('Pass');

  // Form states for Stage 2 (Visa Deal & Documentation)
  const [stage2Company, setStage2Company] = useState('Allied Delivery Services L.L.C');
  const [stage2GeneralNote, setStage2GeneralNote] = useState('');
  const [stage2LicenseType, setStage2LicenseType] = useState('Visa Only');
  const [stage2TotalPkg, setStage2TotalPkg] = useState('6000.00');
  const [stage2Advance, setStage2Advance] = useState('2000.00');
  const [stage2Balance, setStage2Balance] = useState('4000.00');
  const [stage2ReferralName, setStage2ReferralName] = useState('');
  const [stage2ReferralBonus, setStage2ReferralBonus] = useState('0.00');
  const [stage2JoiningBonus, setStage2JoiningBonus] = useState('0.00');
  const [stage2PerMonthDeduction, setStage2PerMonthDeduction] = useState('0.00');

  // Handlers for opening full-screen stage views
  const handleOpenDetailedStage = (candidate: CandidateRecord, stageNum: number) => {
    setActiveStageCandidate(candidate);
    setActiveStageNumber(stageNum);
    setStageSuccessToast(null);

    // Populate Stage 1 fields
    const names = candidate.fullName.split(' ');
    setStage1FirstName(names[0] || candidate.fullName);
    setStage1LastName(names.slice(1).join(' ') || '');
    setStage1UniqueId(candidate.uniqueId);
    setStage1PassportNo(candidate.cnicPassport || 'P1234567');
    setStage1PersonalPhone(candidate.mobile);

    // Populate Stage 2 fields
    setStage2LicenseType(candidate.licensePackageType);
    setStage2TotalPkg(candidate.totalPackage.toFixed(2));
    setStage2Advance(candidate.advance.toFixed(2));
    setStage2Balance(candidate.balance.toFixed(2));
    setStage2PerMonthDeduction(candidate.perMonthDeduction.toFixed(2));
  };

  const handleSaveStage1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStageCandidate) return;

    const updatedFullName = `${stage1FirstName} ${stage1LastName}`.trim();
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === activeStageCandidate.id
          ? {
              ...c,
              fullName: updatedFullName || c.fullName,
              uniqueId: stage1UniqueId || c.uniqueId,
              cnicPassport: stage1PassportNo || c.cnicPassport,
              mobile: stage1PersonalPhone || c.mobile,
              interview: stage1InterviewStatus,
              stage1Status: 'Completed',
            }
          : c
      )
    );

    setStageSuccessToast('Success: Candidate updated successfully!');
    setTimeout(() => setStageSuccessToast(null), 3000);
  };

  const handleSaveStage2 = (moveNext: boolean) => {
    if (!activeStageCandidate) return;

    const tot = parseFloat(stage2TotalPkg) || 0;
    const adv = parseFloat(stage2Advance) || 0;
    const bal = Math.max(0, tot - adv);
    const pmd = parseFloat(stage2PerMonthDeduction) || 0;

    setCandidates((prev) =>
      prev.map((c) => {
        if (c.id === activeStageCandidate.id) {
          const nextStage2Status = moveNext ? 'Completed' : 'Open';
          const nextStage3Status = moveNext ? 'Open' : c.stage3Status;
          const nextCurrentStage = moveNext ? 'Visa & ID Process' : c.currentStage;
          const nextCurrentCode = moveNext ? 'STAGE_3' : c.currentStageCode;

          return {
            ...c,
            licensePackageType: stage2LicenseType,
            totalPackage: tot,
            advance: adv,
            balance: bal,
            perMonthDeduction: pmd,
            stage2Status: nextStage2Status,
            stage3Status: nextStage3Status,
            currentStage: nextCurrentStage,
            currentStageCode: nextCurrentCode,
          };
        }
        return c;
      })
    );

    setStageSuccessToast('Stage 2 saved successfully.');
    if (moveNext) {
      setTimeout(() => {
        setActiveStageNumber(3);
        setStageSuccessToast(null);
      }, 1000);
    } else {
      setTimeout(() => setStageSuccessToast(null), 3000);
    }
  };

  const handleSaveStage3 = (moveNext: boolean) => {
    if (!activeStageCandidate) return;
    setCandidates((prev) =>
      prev.map((c) => {
        if (c.id === activeStageCandidate.id) {
          return {
            ...c,
            stage3Status: 'Completed',
            stage4Status: moveNext ? 'Open' : c.stage4Status,
            currentStage: moveNext ? 'Driving License' : 'Visa & ID Process',
            currentStageCode: moveNext ? 'STAGE_4' : 'STAGE_3',
          };
        }
        return c;
      })
    );
    setStageSuccessToast('Stage 3 saved successfully.');
    if (moveNext) {
      setTimeout(() => {
        setActiveStageNumber(4);
        setStageSuccessToast(null);
      }, 1000);
    } else {
      setTimeout(() => setStageSuccessToast(null), 3000);
    }
  };

  const handleClearFilters = () => {
    setSearchKeyword('');
    setSelectedStageFilter('ALL');
    setFilterCurrentStage('All Stages');
    setFilterCurrentStatus('All');
    setFromDate('');
    setToDate('');
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1700px] mx-auto bg-slate-100 dark:bg-slate-950 min-h-screen">
      {/* Toast Alert Banner */}
      {stageSuccessToast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white font-bold text-xs px-4 py-3 rounded-lg shadow-xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span>{stageSuccessToast}</span>
        </div>
      )}

      {/* FULL-PAGE DETAILED STAGE EDIT VIEW (If activeStageNumber is set) */}
      {activeStageNumber !== null && activeStageCandidate && (
        <div className="space-y-6 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          {/* Top Stage Navigation & Back Button */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
            <button
              onClick={() => {
                setActiveStageNumber(null);
                setActiveStageCandidate(null);
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Candidate List</span>
            </button>

            {/* Stage Selector Pills */}
            <div className="flex items-center gap-1 overflow-x-auto text-xs font-bold">
              {[
                { num: 1, label: 'Stage 1: Initial Info' },
                { num: 2, label: 'Stage 2: Visa Deal' },
                { num: 3, label: 'Stage 3: Visa & ID' },
                { num: 4, label: 'Stage 4: Driving License' },
                { num: 5, label: 'Stage 5: RTA Permit' },
                { num: 6, label: 'Stage 6: Validation' },
              ].map((stg) => (
                <button
                  key={stg.num}
                  onClick={() => setActiveStageNumber(stg.num)}
                  className={`px-3 py-1.5 rounded-lg border transition-all ${
                    activeStageNumber === stg.num
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {stg.label}
                </button>
              ))}
            </div>
          </div>

          {/* STAGE 1 VIEW: Employee Initial Process */}
          {activeStageNumber === 1 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                  Employee Initial Process
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Edit mode: Candidate information can be updated. Current stage: Stage 1.
                </p>
              </div>

              <div className="bg-sky-500 text-white px-4 py-2.5 rounded-lg text-xs font-bold flex items-center justify-between shadow-xs">
                <span>Edit Mode: Candidate information can be updated. Current stage: Stage 1.</span>
                <span className="bg-white/20 px-2 py-0.5 rounded text-[11px]">Active Stage</span>
              </div>

              <form onSubmit={handleSaveStage1} className="space-y-6 text-xs">
                {/* 1. Login Details */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 bg-slate-50/50 dark:bg-slate-800/30">
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm border-b pb-2 border-slate-200 dark:border-slate-800">
                    Login Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        Username
                      </label>
                      <input
                        type="text"
                        value={stage1UniqueId}
                        readOnly
                        className="w-full bg-slate-200 dark:bg-slate-800 p-2 rounded border border-slate-300 dark:border-slate-700 font-mono text-slate-700 dark:text-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        Work Phone Number
                      </label>
                      <input
                        type="text"
                        value="0000000000000"
                        onChange={() => {}}
                        className="w-full bg-white dark:bg-slate-900 p-2 rounded border border-slate-300 dark:border-slate-700 font-mono text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        Email
                      </label>
                      <input
                        type="email"
                        value={`${stage1FirstName.toLowerCase()}123@gmail.com`}
                        onChange={() => {}}
                        className="w-full bg-white dark:bg-slate-900 p-2 rounded border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Personal Details */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4 bg-slate-50/50 dark:bg-slate-800/30">
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm border-b pb-2 border-slate-200 dark:border-slate-800">
                    Personal Details
                  </h3>

                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 font-bold text-lg border border-slate-300">
                      {stage1FirstName.charAt(0) || 'C'}
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        Profile Picture
                      </label>
                      <input type="file" className="text-xs text-slate-500" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        First Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={stage1FirstName}
                        onChange={(e) => setStage1FirstName(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 p-2 rounded border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={stage1LastName}
                        onChange={(e) => setStage1LastName(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 p-2 rounded border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        Gender
                      </label>
                      <select
                        value={stage1Gender}
                        onChange={(e) => setStage1Gender(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 p-2 rounded border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        value={stage1Dob}
                        onChange={(e) => setStage1Dob(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 p-2 rounded border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        Nationality
                      </label>
                      <select
                        value={stage1Nationality}
                        onChange={(e) => setStage1Nationality(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 p-2 rounded border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                      >
                        <option value="Pakistan">Pakistan</option>
                        <option value="India">India</option>
                        <option value="Bangladesh">Bangladesh</option>
                        <option value="Nepal">Nepal</option>
                        <option value="United Arab Emirates">United Arab Emirates</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        Unique Id / Emirates ID
                      </label>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={stage1UniqueId}
                          onChange={(e) => setStage1UniqueId(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 p-2 rounded border border-slate-300 dark:border-slate-700 font-mono text-slate-800 dark:text-slate-100"
                        />
                        <button
                          type="button"
                          onClick={() => alert('Unique ID verified.')}
                          className="px-2 py-1 bg-amber-500 text-white rounded text-[10px] font-bold shrink-0"
                        >
                          Change Unique ID
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        Passport Number
                      </label>
                      <input
                        type="text"
                        value={stage1PassportNo}
                        onChange={(e) => setStage1PassportNo(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 p-2 rounded border border-slate-300 dark:border-slate-700 font-mono text-slate-800 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        Personal Phone Number
                      </label>
                      <input
                        type="text"
                        value={stage1PersonalPhone}
                        onChange={(e) => setStage1PersonalPhone(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 p-2 rounded border border-slate-300 dark:border-slate-700 font-mono text-slate-800 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        Address
                      </label>
                      <input
                        type="text"
                        value={stage1Address}
                        onChange={(e) => setStage1Address(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 p-2 rounded border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        Emergency Contact Name
                      </label>
                      <input
                        type="text"
                        value={stage1EmergencyContact}
                        onChange={(e) => setStage1EmergencyContact(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 p-2 rounded border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        Emergency Contact Number
                      </label>
                      <input
                        type="text"
                        value={stage1EmergencyPhone}
                        onChange={(e) => setStage1EmergencyPhone(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 p-2 rounded border border-slate-300 dark:border-slate-700 font-mono text-slate-800 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        Passport Possession
                      </label>
                      <select
                        value={stage1PassportPossession}
                        onChange={(e) => setStage1PassportPossession(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 p-2 rounded border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                      >
                        <option value="In Office">In Office</option>
                        <option value="With Candidate">With Candidate</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 3. Work Details */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4 bg-slate-50/50 dark:bg-slate-800/30">
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm border-b pb-2 border-slate-200 dark:border-slate-800">
                    Work Details
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        Reporting Manager
                      </label>
                      <select
                        value={stage1ReportingManager}
                        onChange={(e) => setStage1ReportingManager(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 p-2 rounded border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                      >
                        <option value="System User">
                          System User ()
                        </option>
                        <option value="System User">
                          System User ()
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        Schedule
                      </label>
                      <select
                        value={stage1Shift}
                        onChange={(e) => setStage1Shift(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 p-2 rounded border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                      >
                        <option value="Morning Shift">Morning Shift</option>
                        <option value="Night Shift">Night Shift</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        Team
                      </label>
                      <select
                        value={stage1Team}
                        onChange={(e) => setStage1Team(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 p-2 rounded border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                      >
                        <option value="Delivery Team">Delivery Team</option>
                        <option value="Operations Team">Operations Team</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        Date of Joining
                      </label>
                      <input
                        type="date"
                        value={stage1DateOfJoining}
                        onChange={(e) => setStage1DateOfJoining(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 p-2 rounded border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        Branch
                      </label>
                      <input
                        type="text"
                        value="ALLIED DELIVERY SERVICES L.L.C"
                        readOnly
                        className="w-full bg-slate-100 dark:bg-slate-800 p-2 rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        Department
                      </label>
                      <select
                        value={stage1Department}
                        onChange={(e) => setStage1Department(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 p-2 rounded border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                      >
                        <option value="Operations">Operations</option>
                        <option value="HR">HR</option>
                        <option value="Accounts">Accounts</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        Designation
                      </label>
                      <select
                        value={stage1Designation}
                        onChange={(e) => setStage1Designation(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 p-2 rounded border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                      >
                        <option value="Bike Rider">Bike Rider</option>
                        <option value="Car Driver">Car Driver</option>
                        <option value="Supervisor">Supervisor</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        Interview Status
                      </label>
                      <select
                        value={stage1InterviewStatus}
                        onChange={(e) => setStage1InterviewStatus(e.target.value as 'Pass' | 'Fail' | 'Pending')}
                        className="w-full bg-white dark:bg-slate-900 p-2 rounded border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold text-emerald-600"
                      >
                        <option value="Pass">Pass</option>
                        <option value="Fail">Fail</option>
                        <option value="Pending">Pending</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Form Buttons matching Video */}
                <div className="flex items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>Update</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveStageNumber(null);
                      setActiveStageCandidate(null);
                    }}
                    className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all shadow-md"
                  >
                    <span>Back</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* STAGE 2 VIEW: Visa Deal & Documentation */}
          {activeStageNumber === 2 && (
            <div className="space-y-6">
              {/* Header Box matching video at timestamp 02:30 */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                    Stage 2 – Visa Deal & Documentation
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    All fields marked * are mandatory. Document types are dynamic from DB (Landlord/DocType, etc).
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-right">
                    <p className="font-bold text-slate-900 dark:text-white text-sm">
                      {activeStageCandidate.fullName}
                    </p>
                    <p className="font-mono text-slate-500 text-xs">
                      {activeStageCandidate.uniqueId}
                    </p>
                  </div>

                  <button
                    onClick={() => alert(`Printing ticket for ${activeStageCandidate.fullName}...`)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5"
                  >
                    <span>+ Print Ticket</span>
                  </button>
                </div>
              </div>

              {/* Collapsible Blue Header Bar: General Information */}
              <div className="border border-blue-200 dark:border-blue-900 rounded-xl overflow-hidden shadow-xs">
                <div className="bg-blue-600 text-white px-4 py-3 font-bold text-xs flex items-center justify-between">
                  <span>General Information</span>
                  <ChevronDown className="w-4 h-4" />
                </div>

                <div className="p-4 bg-white dark:bg-slate-900 space-y-4 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        Company *
                      </label>
                      <input
                        type="text"
                        value={stage2Company}
                        onChange={(e) => setStage2Company(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-300 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        General Note
                      </label>
                      <input
                        type="text"
                        placeholder="Enter note..."
                        value={stage2GeneralNote}
                        onChange={(e) => setStage2GeneralNote(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        License Package Type *
                      </label>
                      <select
                        value={stage2LicenseType}
                        onChange={(e) => setStage2LicenseType(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-300 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100"
                      >
                        <option value="Visa Only">Visa Only</option>
                        <option value="License & Visa">License & Visa</option>
                        <option value="Full Package">Full Package</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        Total Package Amount *
                      </label>
                      <input
                        type="number"
                        value={stage2TotalPkg}
                        onChange={(e) => setStage2TotalPkg(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-300 dark:border-slate-700 font-mono font-bold text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        Advance Amount
                      </label>
                      <input
                        type="number"
                        value={stage2Advance}
                        onChange={(e) => setStage2Advance(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-300 dark:border-slate-700 font-mono font-bold text-emerald-600 dark:text-emerald-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        Balance Amount
                      </label>
                      <input
                        type="number"
                        value={stage2Balance}
                        onChange={(e) => setStage2Balance(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-300 dark:border-slate-700 font-mono font-bold text-rose-600 dark:text-rose-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        Referral Name
                      </label>
                      <input
                        type="text"
                        value={stage2ReferralName}
                        onChange={(e) => setStage2ReferralName(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        Referral Bonus
                      </label>
                      <input
                        type="text"
                        value={stage2ReferralBonus}
                        onChange={(e) => setStage2ReferralBonus(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-300 dark:border-slate-700 font-mono text-slate-800 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        Joining Bonus
                      </label>
                      <input
                        type="text"
                        value={stage2JoiningBonus}
                        onChange={(e) => setStage2JoiningBonus(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-300 dark:border-slate-700 font-mono text-slate-800 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                        Per Month Deduction
                      </label>
                      <input
                        type="number"
                        value={stage2PerMonthDeduction}
                        onChange={(e) => setStage2PerMonthDeduction(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-300 dark:border-slate-700 font-mono text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Employee Documents Required Box matching video at timestamp 02:34 */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
                <div className="bg-slate-900 text-white px-4 py-3 font-bold text-xs">
                  Employee Documents Required
                </div>

                <div className="p-4 bg-white dark:bg-slate-900 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {[
                    'Passport Copy',
                    'National ID Front Side',
                    'National ID Back Side',
                    'Old Emirates ID Front Side',
                    'Old Emirates ID Back Side',
                    'Driving License Front Side',
                    'Driving License Back Side',
                    'Cancellation Paper',
                    'Bank Payment Receipt',
                    'Contract Copy',
                    'Loan Papers',
                    'Other Documents',
                  ].map((docLabel) => (
                    <div
                      key={docLabel}
                      className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/60 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-slate-800 dark:text-slate-200">{docLabel}</p>
                        <p className="text-[10px] text-slate-400">Multiple files allowed</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="file" className="text-[10px] text-slate-500 w-44" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Form Actions matching video */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => handleSaveStage2(false)}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-md"
                >
                  Save
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveStage2(true)}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-2"
                >
                  <span>Save & Move to Stage 3</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 3 VIEW: Visa & ID Process */}
          {activeStageNumber === 3 && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  Stage 3 – Visa & ID Process
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Manage Medical, EVisa, Emirates ID Typing, Stamping, and Health Insurance for{' '}
                  <strong>{activeStageCandidate.fullName}</strong>.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <p className="font-bold text-slate-900 dark:text-white">1. Offer Letter Status</p>
                  <select className="w-full p-2 bg-white dark:bg-slate-900 rounded border border-slate-300 dark:border-slate-700">
                    <option>Signed & Uploaded</option>
                    <option>Pending Signature</option>
                  </select>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <p className="font-bold text-slate-900 dark:text-white">2. EVisa Entry Permit</p>
                  <select className="w-full p-2 bg-white dark:bg-slate-900 rounded border border-slate-300 dark:border-slate-700">
                    <option>EVisa Issued</option>
                    <option>In Typing</option>
                  </select>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <p className="font-bold text-slate-900 dark:text-white">3. Medical Fitness Test</p>
                  <select className="w-full p-2 bg-white dark:bg-slate-900 rounded border border-slate-300 dark:border-slate-700">
                    <option>Passed</option>
                    <option>Scheduled</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => handleSaveStage3(true)}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-2"
                >
                  <span>Save & Move to Stage 4</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 4, 5, 6 Views */}
          {activeStageNumber >= 4 && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  Stage {activeStageNumber} – Recruitment Execution
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Candidate: <strong>{activeStageCandidate.fullName}</strong> ({activeStageCandidate.uniqueId})
                </p>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                  Stage {activeStageNumber} Verification Complete
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  All documents and permits for Stage {activeStageNumber} are verified against UAE MoHRE and RTA guidelines.
                </p>
                <button
                  onClick={() => {
                    setCandidates((prev) =>
                      prev.map((c) =>
                        c.id === activeStageCandidate.id ? { ...c, stageStatus: 'Completed' } : c
                      )
                    );
                    setStageSuccessToast('Candidate successfully updated!');
                    setTimeout(() => {
                      setActiveStageNumber(null);
                      setActiveStageCandidate(null);
                    }, 1000);
                  }}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs hover:bg-emerald-700 shadow-md"
                >
                  Complete & Finish Candidate Onboarding
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CANDIDATE LIST TABLE VIEW (Rendered when activeStageNumber is null) */}
      {activeStageNumber === null && (
        <div className="space-y-6">
      {/* Header Bar matching Screenshot 1 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>Candidate List</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            View recruitment progress and stage-wise status
          </p>
        </div>

        {/* Action Buttons Top Right */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleOpenNewModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ New Candidate</span>
          </button>

          <button
            onClick={handleOpenNewModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
          >
            <Users className="w-4 h-4" />
            <span>Bulk Create</span>
          </button>

          <button
            onClick={() => alert('Exporting Candidate Recruitment Excel File...')}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handleClearFilters}
            className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-xs font-bold transition-all shadow-xs"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Top 4 Counter Cards Matching Screenshot 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Box 1: Not Started */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            <span>Not Started</span>
          </div>
          <p className="text-2xl font-black text-slate-800 dark:text-slate-200 mt-2">
            {notStartedCount}
          </p>
        </div>

        {/* Box 2: Open */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>Open</span>
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">
            {openCount}
          </p>
        </div>

        {/* Box 3: Completed */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Completed</span>
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
            {completedCount}
          </p>
        </div>

        {/* Box 4: Skipped */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>Skipped</span>
          </div>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2">
            {skippedCount}
          </p>
        </div>
      </div>

      {/* Main Content Layout: Left Sidebar + Right Search/Table Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT SIDEBAR: Recruitment Stages Filter Box */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-sky-600" />
                <span>Recruitment Stages</span>
              </h2>
              <p className="text-[10px] text-slate-400 mt-0.5">Filter by current stage</p>
            </div>
          </div>

          <div className="space-y-1 text-xs font-semibold">
            {/* All Candidates Button */}
            <button
              onClick={() => setSelectedStageFilter('ALL')}
              className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${
                selectedStageFilter === 'ALL'
                  ? 'bg-sky-500 text-white shadow-xs font-bold'
                  : 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>All Candidates</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] ${
                  selectedStageFilter === 'ALL'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                }`}
              >
                {candidates.length}
              </span>
            </button>

            {/* Stage 1 */}
            <button
              onClick={() => setSelectedStageFilter('STAGE_1')}
              className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-all text-left ${
                selectedStageFilter === 'STAGE_1'
                  ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-200 border border-sky-300 dark:border-sky-800 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <div>
                <p className="text-[11px] font-bold">Stage 1</p>
                <p className="text-[10px] font-normal text-slate-400">General Information (Legacy)</p>
              </div>
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[10px] font-mono">
                {stage1Count}
              </span>
            </button>

            {/* Stage 2 */}
            <button
              onClick={() => setSelectedStageFilter('STAGE_2')}
              className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-all text-left ${
                selectedStageFilter === 'STAGE_2'
                  ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-200 border border-sky-300 dark:border-sky-800 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <div>
                <p className="text-[11px] font-bold">Stage 2</p>
                <p className="text-[10px] font-normal text-slate-400">Visa Deal & Documentation</p>
              </div>
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[10px] font-mono">
                {stage2Count}
              </span>
            </button>

            {/* Stage 3 */}
            <button
              onClick={() => setSelectedStageFilter('STAGE_3')}
              className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-all text-left ${
                selectedStageFilter === 'STAGE_3'
                  ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-200 border border-sky-300 dark:border-sky-800 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <div>
                <p className="text-[11px] font-bold">Stage 3</p>
                <p className="text-[10px] font-normal text-slate-400">Visa & ID Process</p>
              </div>
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[10px] font-mono">
                {stage3Count}
              </span>
            </button>

            {/* Stage 4 */}
            <button
              onClick={() => setSelectedStageFilter('STAGE_4')}
              className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-all text-left ${
                selectedStageFilter === 'STAGE_4'
                  ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-200 border border-sky-300 dark:border-sky-800 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <div>
                <p className="text-[11px] font-bold">Stage 4</p>
                <p className="text-[10px] font-normal text-slate-400">Driving License</p>
              </div>
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[10px] font-mono">
                {stage4Count}
              </span>
            </button>

            {/* Stage 5 */}
            <button
              onClick={() => setSelectedStageFilter('STAGE_5')}
              className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-all text-left ${
                selectedStageFilter === 'STAGE_5'
                  ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-200 border border-sky-300 dark:border-sky-800 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <div>
                <p className="text-[11px] font-bold">Stage 5</p>
                <p className="text-[10px] font-normal text-slate-400">RTA / Food Permit</p>
              </div>
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[10px] font-mono">
                {stage5Count}
              </span>
            </button>

            {/* Stage 6 */}
            <button
              onClick={() => setSelectedStageFilter('STAGE_6')}
              className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-all text-left ${
                selectedStageFilter === 'STAGE_6'
                  ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-200 border border-sky-300 dark:border-sky-800 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <div>
                <p className="text-[11px] font-bold">Stage 6</p>
                <p className="text-[10px] font-normal text-slate-400">Permits & Document Validation</p>
              </div>
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[10px] font-mono">
                {stage6Count}
              </span>
            </button>
          </div>
        </div>

        {/* RIGHT PANEL: Search Filters Box & Progress Table */}
        <div className="lg:col-span-9 space-y-6">
          {/* Search Filters Box Matching Screenshot 1 */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-600 uppercase tracking-wider">
              <Filter className="w-3.5 h-3.5" /> Search Filters
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  KEYWORD
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Name, UniqueId, passport or mobile"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 pl-8 pr-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  CURRENT STAGE
                </label>
                <select
                  value={filterCurrentStage}
                  onChange={(e) => setFilterCurrentStage(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 p-1.5 rounded border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-hidden"
                >
                  <option value="All Stages">All Stages</option>
                  <option value="General Information (Legacy)">Stage 1: General Information</option>
                  <option value="Visa Deal & Documentation">Stage 2: Visa Deal & Documentation</option>
                  <option value="Visa & ID Process">Stage 3: Visa & ID Process</option>
                  <option value="Driving License">Stage 4: Driving License</option>
                  <option value="RTA / Food Permit">Stage 5: RTA / Food Permit</option>
                  <option value="Permits & Document Validation">Stage 6: Permits & Validation</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  CURRENT STATUS
                </label>
                <select
                  value={filterCurrentStatus}
                  onChange={(e) => setFilterCurrentStatus(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 p-1.5 rounded border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-hidden"
                >
                  <option value="All">All</option>
                  <option value="Open">Open</option>
                  <option value="Completed">Completed</option>
                  <option value="Not Started">Not Started</option>
                  <option value="Skipped">Skipped</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  PAGE SIZE
                </label>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 p-1.5 rounded border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-hidden"
                >
                  <option value="15 records">15 records</option>
                  <option value="25 records">25 records</option>
                  <option value="50 records">50 records</option>
                  <option value="100 records">100 records</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  FROM DATE
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 p-1.5 rounded border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  TO DATE
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 p-1.5 rounded border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-hidden"
                />
              </div>

              <div className="sm:col-span-2 flex items-end">
                <button
                  onClick={() => {}}
                  className="w-full py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Apply Filters</span>
                </button>
              </div>
            </div>
          </div>

          {/* Candidate Recruitment Progress Section Header */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-sky-600" />
                  <span>Candidate Recruitment Progress</span>
                </h3>
                <p className="text-[10px] text-slate-400">Scroll horizontally to view all stage columns</p>
              </div>
              <span className="text-[11px] font-semibold text-slate-500">
                Showing {filteredCandidates.length} of {candidates.length}
              </span>
            </div>

            {/* Scrollable Table Matching Screenshot 1, 2, 3 */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                <thead className="bg-slate-900 text-white text-[10px] font-bold tracking-wider uppercase border-b border-slate-800">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Candidate</th>
                    <th className="p-3">UniqueId</th>
                    <th className="p-3">CNIC / Passport</th>
                    <th className="p-3">Mobile</th>
                    <th className="p-3">Created</th>
                    <th className="p-3">Interview</th>
                    <th className="p-3">Candidate Status</th>
                    <th className="p-3">License Package Type</th>
                    <th className="p-3 text-right">Total Package</th>
                    <th className="p-3 text-right">Advance</th>
                    <th className="p-3 text-right">Balance</th>
                    <th className="p-3 text-right">Per Month Deduction</th>
                    <th className="p-3">Current Stage</th>
                    <th className="p-3">Current Status</th>
                    <th className="p-3 text-center">Stage 1<br/><span className="text-[9px] font-normal opacity-70">General Information (Legacy)</span></th>
                    <th className="p-3 text-center">Stage 2<br/><span className="text-[9px] font-normal opacity-70">Visa Deal & Documentation</span></th>
                    <th className="p-3 text-center">Stage 3<br/><span className="text-[9px] font-normal opacity-70">Visa & ID Process</span></th>
                    <th className="p-3 text-center">Stage 4<br/><span className="text-[9px] font-normal opacity-70">Driving License</span></th>
                    <th className="p-3 text-center">Stage 5<br/><span className="text-[9px] font-normal opacity-70">RTA / Food Permit</span></th>
                    <th className="p-3 text-center">Stage 6<br/><span className="text-[9px] font-normal opacity-70">Permits & Validation</span></th>
                    <th className="p-3">Visa Status Process</th>
                    <th className="p-3">Driving License Process</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredCandidates.map((cand, idx) => (
                    <tr
                      key={cand.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="p-3 font-medium text-slate-500">{idx + 1}</td>

                      {/* Candidate Column */}
                      <td className="p-3">
                        <p className="font-bold text-slate-900 dark:text-white leading-tight">
                          {cand.fullName}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          Candidate ID: {cand.candidateId}
                        </p>
                      </td>

                      <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {cand.uniqueId}
                      </td>

                      <td className="p-3 font-mono text-[11px] text-slate-500">
                        {cand.cnicPassport}
                      </td>

                      <td className="p-3 font-mono text-[11px]">{cand.mobile}</td>

                      <td className="p-3 text-[11px] font-mono text-slate-500">
                        {cand.createdDate}
                      </td>

                      {/* Interview */}
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold">
                          {cand.interview}
                        </span>
                      </td>

                      {/* Candidate Status */}
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            cand.status === 'Active'
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-400 text-white'
                          }`}
                        >
                          {cand.status}
                        </span>
                      </td>

                      <td className="p-3 text-[11px] font-medium">{cand.licensePackageType}</td>

                      {/* Package Amounts */}
                      <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {cand.totalPackage.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        {cand.advance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-mono text-rose-600 dark:text-rose-400 font-bold">
                        {cand.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-500">
                        {cand.perMonthDeduction.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Current Stage */}
                      <td className="p-3">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">
                          {cand.currentStage}
                        </p>
                        <p className="text-[9px] font-mono text-slate-400">{cand.currentStageCode}</p>
                      </td>

                      {/* Current Status */}
                      <td className="p-3">
                        <span className="px-2.5 py-1 bg-amber-500 text-white rounded text-[10px] font-bold">
                          {cand.stageStatus}
                        </span>
                      </td>

                      {/* Stage 1 */}
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold block mb-1">
                          {cand.stage1Status}
                        </span>
                        <button
                          onClick={() => handleOpenDetailedStage(cand, 1)}
                          className="text-[10px] text-sky-600 hover:underline font-bold"
                        >
                          Open Stage
                        </button>
                      </td>

                      {/* Stage 2 */}
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold block mb-1 ${
                            cand.stage2Status === 'Open'
                              ? 'bg-amber-500 text-white'
                              : cand.stage2Status === 'Completed'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-900 text-white'
                          }`}
                        >
                          {cand.stage2Status}
                        </span>
                        {cand.stage2Status === 'Open' && (
                          <span className="inline-block px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded text-[9px] font-bold mb-1">
                            ● Current
                          </span>
                        )}
                        <br />
                        <button
                          onClick={() => handleOpenDetailedStage(cand, 2)}
                          className="text-[10px] text-sky-600 hover:underline font-bold"
                        >
                          Open Stage
                        </button>
                      </td>

                      {/* Stage 3 */}
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold block mb-1 ${
                            cand.stage3Status === 'Open'
                              ? 'bg-amber-500 text-white'
                              : cand.stage3Status === 'Completed'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-900 text-white'
                          }`}
                        >
                          {cand.stage3Status}
                        </span>
                        <button
                          onClick={() => handleOpenDetailedStage(cand, 3)}
                          className="text-[10px] text-sky-600 hover:underline font-bold"
                        >
                          Open Stage
                        </button>
                      </td>

                      {/* Stage 4 */}
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold block mb-1 ${
                            cand.stage4Status === 'Open'
                              ? 'bg-amber-500 text-white'
                              : cand.stage4Status === 'Completed'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-900 text-white'
                          }`}
                        >
                          {cand.stage4Status}
                        </span>
                        <button
                          onClick={() => handleOpenDetailedStage(cand, 4)}
                          className="text-[10px] text-sky-600 hover:underline font-bold"
                        >
                          Open Stage
                        </button>
                      </td>

                      {/* Stage 5 */}
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold block mb-1 ${
                            cand.stage5Status === 'Open'
                              ? 'bg-amber-500 text-white'
                              : cand.stage5Status === 'Completed'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-900 text-white'
                          }`}
                        >
                          {cand.stage5Status}
                        </span>
                        <button
                          onClick={() => handleOpenDetailedStage(cand, 5)}
                          className="text-[10px] text-sky-600 hover:underline font-bold"
                        >
                          Open Stage
                        </button>
                      </td>

                      {/* Stage 6 */}
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold block mb-1 ${
                            cand.stage6Status === 'Open'
                              ? 'bg-amber-500 text-white'
                              : cand.stage6Status === 'Completed'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-900 text-white'
                          }`}
                        >
                          {cand.stage6Status}
                        </span>
                        <button
                          onClick={() => handleOpenDetailedStage(cand, 6)}
                          className="text-[10px] text-sky-600 hover:underline font-bold"
                        >
                          Open Stage
                        </button>
                      </td>

                      {/* Visa Status Process */}
                      <td className="p-3 text-[10px]">
                        <p>
                          <span className="font-bold">Current:</span> {cand.visaProcess.current}
                        </p>
                        <p>
                          <span className="font-bold">Completed:</span> {cand.visaProcess.completed}
                        </p>
                        <p>
                          <span className="font-bold">Elapsed:</span> {cand.visaProcess.elapsed}
                        </p>
                        <p className="text-blue-600 font-semibold">
                          <span>Next:</span> {cand.visaProcess.next}
                        </p>
                      </td>

                      {/* Driving License Process */}
                      <td className="p-3 text-[10px]">
                        <p>
                          <span className="font-bold">Current:</span> {cand.dlProcess.current}
                        </p>
                        <p>
                          <span className="font-bold">Completed:</span> {cand.dlProcess.completed}
                        </p>
                        <p>
                          <span className="font-bold">Elapsed:</span> {cand.dlProcess.elapsed}
                        </p>
                        <p className="text-blue-600 font-semibold">
                          <span>Next:</span> {cand.dlProcess.next}
                        </p>
                      </td>

                      {/* Action Buttons Matching Screenshot 3 */}
                      <td className="p-3 text-center">
                        <div className="flex flex-col gap-1 items-stretch min-w-[130px]">
                          <button
                            onClick={() => handleOpenDetailedStage(cand, parseInt(cand.currentStageCode.replace('STAGE_', '')) || 2)}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold flex items-center justify-center gap-1 shadow-2xs"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Open Current Stage</span>
                          </button>

                          <button
                            onClick={() => handleOpenStageUpdate(cand)}
                            className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded text-[10px] font-bold flex items-center justify-center gap-1"
                          >
                            <Layers className="w-3 h-3 text-amber-500" />
                            <span>Stage...</span>
                          </button>

                          <button
                            onClick={() => handleCloseApplication(cand.id)}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold flex items-center justify-center gap-1 shadow-2xs"
                          >
                            <XCircle className="w-3 h-3" />
                            <span>Close Application</span>
                          </button>

                          <button
                            onClick={() => handleConvertToEmployee(cand)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold flex items-center justify-center gap-1 shadow-2xs"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Employee...</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Page 1 of 9 — Total: {filteredCandidates.length}
              </span>

              <div className="flex items-center gap-1">
                <button className="px-3 py-1 bg-sky-500 text-white rounded text-xs font-bold">
                  @page 1
                </button>
                <button className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs">
                  @page 2
                </button>
                <button className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs">
                  @page 3
                </button>
                <button className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs">
                  Next &gt;
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    )}

      {/* MODAL: CREATE CANDIDATE OR UPDATE STAGE */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-sky-600" />
                <span>
                  {modalMode === 'NEW' ? 'Create New Candidate' : `Update Stage: ${selectedCandidate?.fullName}`}
                </span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {modalMode === 'NEW' ? (
              <form onSubmit={handleCreateCandidate} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Candidate Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="e.g. Muhammad Adnan"
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-100 focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                      Emirates ID / UniqueId
                    </label>
                    <input
                      type="text"
                      value={newUniqueId}
                      onChange={(e) => setNewUniqueId(e.target.value)}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-100 focus:outline-hidden font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                      Passport No
                    </label>
                    <input
                      type="text"
                      value={newPassport}
                      onChange={(e) => setNewPassport(e.target.value)}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-100 focus:outline-hidden font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                      Mobile Number
                    </label>
                    <input
                      type="text"
                      value={newMobile}
                      onChange={(e) => setNewMobile(e.target.value)}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-100 focus:outline-hidden font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                      License Package Type
                    </label>
                    <select
                      value={newLicensePackage}
                      onChange={(e) => setNewLicensePackage(e.target.value)}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-100 focus:outline-hidden"
                    >
                      <option value="Visa Only">Visa Only</option>
                      <option value="License & Visa">License & Visa</option>
                      <option value="Full Package">Full Package</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                      Total Package (AED)
                    </label>
                    <input
                      type="number"
                      value={newTotalPackage}
                      onChange={(e) => setNewTotalPackage(e.target.value)}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-100 focus:outline-hidden font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                      Advance Paid (AED)
                    </label>
                    <input
                      type="number"
                      value={newAdvance}
                      onChange={(e) => setNewAdvance(e.target.value)}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-100 focus:outline-hidden font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 shadow-sm"
                  >
                    Save Candidate
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleUpdateStageSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    Select Stage to Advance
                  </label>
                  <select
                    value={stageToUpdate}
                    onChange={(e) => setStageToUpdate(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-100 focus:outline-hidden font-semibold"
                  >
                    <option value="STAGE_1">Stage 1: General Information (Legacy)</option>
                    <option value="STAGE_2">Stage 2: Visa Deal & Documentation</option>
                    <option value="STAGE_3">Stage 3: Visa & ID Process</option>
                    <option value="STAGE_4">Stage 4: Driving License</option>
                    <option value="STAGE_5">Stage 5: RTA / Food Permit</option>
                    <option value="STAGE_6">Stage 6: Permits & Document Validation</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                    New Status for {stageToUpdate}
                  </label>
                  <select
                    value={newStageStatus}
                    onChange={(e) => setNewStageStatus(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-100 focus:outline-hidden"
                  >
                    <option value="Completed">Completed (Advance to next stage)</option>
                    <option value="Open font-bold text-amber-600">Open (In Progress)</option>
                    <option value="Not Started">Not Started</option>
                    <option value="Skipped">Skipped</option>
                  </select>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700 shadow-sm"
                  >
                    Update Stage Status
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
