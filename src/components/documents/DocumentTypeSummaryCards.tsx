import React from 'react';
import { ExpiryDashboardStats } from '../../services/documentService';
import { DbDocumentType } from '../../types/database';

interface DocumentTypeSummaryCardsProps {
  stats: ExpiryDashboardStats | null;
  docTypes: DbDocumentType[];
  selectedDocTypeId: string;
  onSelectDocType: (typeId: string) => void;
  isLoading?: boolean;
}

export const DocumentTypeSummaryCards: React.FC<DocumentTypeSummaryCardsProps> = ({
  stats,
  docTypes,
  selectedDocTypeId,
  onSelectDocType,
  isLoading = false,
}) => {
  const byType = stats?.byDocumentType || [];
  const totalAllDocs = stats?.totalDocuments || 0;
  const totalExpired = stats?.expired || 0;
  const totalDue40 = stats?.dueIn40Days || 0;

  // Build list of summary cards starting with "All Document Types"
  const summaryCards = [
    {
      id: 'ALL',
      title: 'All Document Types',
      total: totalAllDocs,
      expired: totalExpired,
      due40: totalDue40,
    },
    ...docTypes.map((dt) => {
      const typeStat = byType.find(
        (s) => s.id === dt.id || s.typeName?.toLowerCase() === dt.name?.toLowerCase()
      );
      return {
        id: dt.id,
        title: dt.name,
        total: typeStat?.count || 0,
        expired: typeStat?.expired || 0,
        due40: typeStat?.dueIn40Days || 0,
      };
    }),
  ];

  return (
    <div className="mb-5">
      <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
        {summaryCards.map((card) => {
          const isSelected = selectedDocTypeId === card.id;

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onSelectDocType(card.id)}
              className={`shrink-0 w-52 p-3 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span
                  className={`text-xs font-bold truncate ${
                    isSelected ? 'text-emerald-900 dark:text-emerald-200' : 'text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {card.title}
                </span>
                <span
                  className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                    isSelected
                      ? 'bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {isLoading ? '...' : card.total}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] font-medium pt-1 border-t border-slate-100 dark:border-slate-800/80">
                <span className="text-rose-600 dark:text-rose-400 font-semibold">
                  Expired: {isLoading ? '...' : card.expired}
                </span>
                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                  Due 40d: {isLoading ? '...' : card.due40}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
