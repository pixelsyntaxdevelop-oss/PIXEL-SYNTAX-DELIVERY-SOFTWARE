import React, { useState, useEffect } from 'react';
import {
  Sliders,
  CheckCircle,
  Plus,
  Trash2,
  HelpCircle,
  Calculator,
  Loader2,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { performanceService } from '../../services/performanceService';
import { ProjectPerformanceConfig, DeliveryPlatform } from '../../types/performance';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  lang?: 'EN' | 'AR';
}

export const ProjectConfigModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  lang = 'EN',
}) => {
  const [configs, setConfigs] = useState<ProjectPerformanceConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [projectId, setProjectId] = useState('proj_noon_1');
  const [projectName, setProjectName] = useState('Noon Minutes - Dubai Hub #01');
  const [platform, setPlatform] = useState<DeliveryPlatform>('NOON_MINUTES');
  const [targetDailyDeliveries, setTargetDailyDeliveries] = useState(20);
  const [minDailyDeliveries, setMinDailyDeliveries] = useState(12);
  const [targetHours, setTargetHours] = useState(9.0);
  const [minHours, setMinHours] = useState(8.0);
  const [targetAcceptance, setTargetAcceptance] = useState(95.0);
  const [targetRating, setTargetRating] = useState(4.8);

  // Weights
  const [weightDeliveries, setWeightDeliveries] = useState(35);
  const [weightHours, setWeightHours] = useState(20);
  const [weightAcceptance, setWeightAcceptance] = useState(15);
  const [weightCompletion, setWeightCompletion] = useState(15);
  const [weightRating, setWeightRating] = useState(15);

  useEffect(() => {
    if (isOpen) {
      loadConfigs();
    }
  }, [isOpen]);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const data = await performanceService.getConfigs();
      setConfigs(data);
      if (data.length > 0) {
        populateForm(data[0]);
      }
    } catch (err: any) {
      console.error('Error loading project configs:', err);
    } finally {
      setLoading(false);
    }
  };

  const populateForm = (cfg: any) => {
    setSelectedConfigId(cfg.id);
    setProjectId(cfg.project_id);
    setProjectName(cfg.project_name);
    setPlatform(cfg.platform);
    setTargetDailyDeliveries(cfg.target_daily_deliveries ?? cfg.daily_delivery_target ?? 22);
    setMinDailyDeliveries(cfg.min_daily_deliveries ?? 15);
    setTargetHours(cfg.target_login_hours_daily ?? 9.0);
    setMinHours(cfg.min_login_hours_daily ?? cfg.min_daily_login_hours ?? 8.0);
    setTargetAcceptance(cfg.target_acceptance_rate ?? cfg.min_acceptance_rate ?? 90);
    setTargetRating(cfg.target_customer_rating ?? 4.8);
    setWeightDeliveries(cfg.weight_deliveries ?? cfg.scoring_weights?.deliveriesVsTarget ?? 35);
    setWeightHours(cfg.weight_hours ?? cfg.scoring_weights?.loginHours ?? 15);
    setWeightAcceptance(cfg.weight_acceptance ?? cfg.scoring_weights?.acceptanceRate ?? 10);
    setWeightCompletion(cfg.weight_completion ?? cfg.scoring_weights?.completionRate ?? 15);
    setWeightRating(cfg.weight_rating ?? cfg.scoring_weights?.customerRating ?? 5);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await performanceService.saveConfig({
        id: selectedConfigId,
        project_id: projectId,
        project_name: projectName,
        platform,
        daily_delivery_target: Number(targetDailyDeliveries),
        monthly_delivery_target: Number(targetDailyDeliveries) * 26,
        min_daily_login_hours: Number(minHours),
        monthly_working_days_target: 26,
        min_acceptance_rate: Number(targetAcceptance),
        min_completion_rate: 95.0,
        max_cancellation_rate: 3.0,
        target_customer_rating: Number(targetRating),
        scoring_weights: {
          deliveriesVsTarget: Number(weightDeliveries),
          loginHours: Number(weightHours),
          acceptanceRate: Number(weightAcceptance),
          completionRate: Number(weightCompletion),
          customerRating: Number(weightRating),
          attendanceRate: 20,
        },
        incentive_rules: [
          {
            id: 'inc_1',
            name: 'Standard Tier Bonus',
            ruleType: 'DELIVERY_TIER',
            bonusAmountAED: 50,
            isActive: true,
          },
        ],
        penalty_rules: [
          {
            id: 'pen_1',
            name: 'Under-hours penalty',
            penaltyType: 'LOW_ACCEPTANCE_PENALTY',
            thresholdPercent: Number(minHours),
            penaltyAmountAED: 25.0,
            description: 'Under hours penalty',
            isActive: true,
          },
        ],
        is_active: true,
      } as any);

      alert('Project performance & incentive rules saved successfully.');
      onSuccess();
      onClose();
    } catch (err: any) {
      alert('Error saving config: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const totalWeight = weightDeliveries + weightHours + weightAcceptance + weightCompletion + weightRating;

  const isAr = lang === 'AR';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isAr
          ? 'إعدادات معايير الأداء وحوافز المشاريع (SLA Targets)'
          : 'Project Performance & Incentive Rules Engine Configuration'
      }
      size="lg"
    >
      {loading ? (
        <div className="py-12 flex justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Project & Platform */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isAr ? 'المشروع' : 'Target Project'}
              </label>
              <select
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  const found = configs.find((c) => c.project_id === e.target.value);
                  if (found) populateForm(found);
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
              >
                <option value="proj_noon_1">Noon Minutes - Dubai Hub #01</option>
                <option value="proj_talabat_1">Talabat Fleet Project</option>
                <option value="proj_deliveroo_1">Deliveroo Logistics Node</option>
                <option value="proj_careem_1">Careem Captains</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isAr ? 'المنصة' : 'Partner Platform'}
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as DeliveryPlatform)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
              >
                <option value="NOON_MINUTES">Noon Minutes</option>
                <option value="TALABAT">Talabat</option>
                <option value="DELIVEROO">Deliveroo</option>
                <option value="CAREEM">Careem</option>
                <option value="AMAZON_FLEX">Amazon Flex</option>
                <option value="CUSTOM">Custom Project Hub</option>
              </select>
            </div>
          </div>

          {/* Operational Targets */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <span className="font-bold text-slate-900 dark:text-white block">
              {isAr ? 'مستهدفات التشغيل اليومية' : 'Daily Operational Targets & Minimum SLA'}
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">Target Drops/day</label>
                <input
                  type="number"
                  value={targetDailyDeliveries}
                  onChange={(e) => setTargetDailyDeliveries(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">Min Drops/day</label>
                <input
                  type="number"
                  value={minDailyDeliveries}
                  onChange={(e) => setMinDailyDeliveries(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">Target Hours/day</label>
                <input
                  type="number"
                  step="0.5"
                  value={targetHours}
                  onChange={(e) => setTargetHours(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">Min Accept %</label>
                <input
                  type="number"
                  value={targetAcceptance}
                  onChange={(e) => setTargetAcceptance(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                />
              </div>
            </div>
          </div>

          {/* Scoring Weights */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white">
                {isAr ? 'أوزان احتساب النقاط (Score Weights)' : 'Performance Score Algorithm Weights'}
              </span>
              <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${totalWeight === 100 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                Total: {totalWeight}% {totalWeight === 100 ? '✓ Balanced' : '⚠️ Must sum to 100'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div>
                <label className="block text-[11px] text-slate-500 mb-0.5">Deliveries (%)</label>
                <input
                  type="number"
                  value={weightDeliveries}
                  onChange={(e) => setWeightDeliveries(Number(e.target.value))}
                  className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-center font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-0.5">Login Hours (%)</label>
                <input
                  type="number"
                  value={weightHours}
                  onChange={(e) => setWeightHours(Number(e.target.value))}
                  className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-center font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-0.5">Acceptance (%)</label>
                <input
                  type="number"
                  value={weightAcceptance}
                  onChange={(e) => setWeightAcceptance(Number(e.target.value))}
                  className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-center font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-0.5">Completion (%)</label>
                <input
                  type="number"
                  value={weightCompletion}
                  onChange={(e) => setWeightCompletion(Number(e.target.value))}
                  className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-center font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-0.5">Rating (%)</label>
                <input
                  type="number"
                  value={weightRating}
                  onChange={(e) => setWeightRating(Number(e.target.value))}
                  className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-center font-bold"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || totalWeight !== 100}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-xs"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              {isAr ? 'حفظ معايير المشروع' : 'Save Rules & Target SLAs'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
