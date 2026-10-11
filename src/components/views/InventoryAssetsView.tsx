import React, { useState } from 'react';
import {
  Package,
  Search,
  Plus,
  Download,
  ShieldCheck,
  RotateCcw,
  Boxes,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { InventoryItem } from '../../types/erp';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';

const INITIAL_INVENTORY: InventoryItem[] = [
  { id: 'inv_1', itemCode: 'INV-BAG-01', itemName: 'Insulated Delivery Thermal Bag (Talabat Spec)', category: 'DELIVERY_BAG', totalStock: 1200, assignedStock: 980, availableStock: 200, damagedStock: 20, unitValueAED: 180, supplier: 'Apex Gear Supplies' },
  { id: 'inv_2', itemCode: 'INV-HLM-02', itemName: 'DOT Certified Safety Rider Helmet (High Vis)', category: 'HELMET', totalStock: 1500, assignedStock: 1350, availableStock: 140, damagedStock: 10, unitValueAED: 250, supplier: 'SafetyFirst UAE' },
  { id: 'inv_3', itemCode: 'INV-GPS-03', itemName: 'Queclink 4G Hardwired GPS Vehicle Tracker', category: 'GPS_TRACKER', totalStock: 800, assignedStock: 740, availableStock: 50, damagedStock: 10, unitValueAED: 450, supplier: 'Telematics Tech Dubai' },
  { id: 'inv_4', itemCode: 'INV-UNF-04', itemName: 'Reflective Rider Jacket & Polo Uniform Set', category: 'UNIFORM', totalStock: 3000, assignedStock: 2600, availableStock: 380, damagedStock: 20, unitValueAED: 120, supplier: 'Textile UAE Works' },
  { id: 'inv_5', itemCode: 'INV-PHN-05', itemName: 'Ruggedized Android Phone (Careem App Pre-loaded)', category: 'SMARTPHONE', totalStock: 500, assignedStock: 480, availableStock: 15, damagedStock: 5, unitValueAED: 650, supplier: 'Samsung Enterprise' },
];

export const InventoryAssetsView: React.FC<{ lang: 'EN' | 'AR' }> = ({ lang }) => {
  const [items, setItems] = useState<InventoryItem[]>(INITIAL_INVENTORY);
  const [activeTab, setActiveTab] = useState<'stock' | 'returns' | 'security'>('stock');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState<'UNIFORM' | 'HELMET' | 'DELIVERY_BAG' | 'GPS_TRACKER' | 'SMARTPHONE'>('DELIVERY_BAG');
  const [totalStock, setTotalStock] = useState(100);
  const [unitValue, setUnitValue] = useState(200);

  const filtered = items.filter((i) => {
    return (
      i.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName) return;

    const newItem: InventoryItem = {
      id: `inv_${Date.now()}`,
      itemCode: `INV-${category.substring(0, 3)}-0${items.length + 1}`,
      itemName,
      category,
      totalStock: Number(totalStock),
      assignedStock: 0,
      availableStock: Number(totalStock),
      damagedStock: 0,
      unitValueAED: Number(unitValue),
      supplier: 'Primary Logistics Supplier',
    };

    setItems([newItem, ...items]);
    setIsAddModalOpen(false);
    setItemName('');
  };

  const totalInventoryValue = items.reduce((acc, curr) => acc + curr.totalStock * curr.unitValueAED, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-600" />
            {lang === 'EN' ? 'Inventory, Gear & Rider Security Deposits' : 'المخزون والعهدة ومعدات السائقين والضمان'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {lang === 'EN'
              ? 'Manage helmets, delivery bags, GPS devices, mobile phones, company uniforms, return reports, and security clearances.'
              : 'متابعة المعدات الموزعة على المناديب وإرجاع العهد والضمانات المالية.'}
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs flex items-center gap-2 shadow-xs transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" /> Add Inventory Item
        </button>
      </div>

      {/* Sub Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-4 text-xs font-bold">
        {[
          { id: 'stock', label: 'Inventory Stock Management' },
          { id: 'returns', label: 'Company Return Reports' },
          { id: 'security', label: 'Rider Inventory Security Deposits' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`pb-2 border-b-2 transition-colors ${
              activeTab === t.id
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-[10px] uppercase font-bold text-slate-400">Total Asset Value</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">AED {totalInventoryValue.toLocaleString()}</p>
          <span className="text-[10px] text-slate-500">Across 5 Primary Asset Classes</span>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-[10px] uppercase font-bold text-slate-400">Assigned Out to Fleet</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {items.reduce((acc, curr) => acc + curr.assignedStock, 0)} Units
          </p>
          <span className="text-[10px] text-emerald-600 font-bold">89.2% Utilization</span>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-[10px] uppercase font-bold text-slate-400">In Depot (Available)</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            {items.reduce((acc, curr) => acc + curr.availableStock, 0)} Units
          </p>
          <span className="text-[10px] text-slate-500">Ready for onboarding</span>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-[10px] uppercase font-bold text-slate-400">Damaged / Write-off</p>
          <p className="text-2xl font-bold text-rose-600 mt-1">
            {items.reduce((acc, curr) => acc + curr.damagedStock, 0)} Units
          </p>
          <span className="text-[10px] text-slate-500">Insurance claim pending</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="relative w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search item, code, or category..."
            className="w-full bg-slate-100 dark:bg-slate-800 pl-9 pr-4 py-1.5 rounded-md text-xs border border-transparent focus:border-blue-500 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="p-3 pl-4">Item Code &amp; Name</th>
                <th className="p-3">Category</th>
                <th className="p-3">Total Stock</th>
                <th className="p-3">Assigned out</th>
                <th className="p-3">Available</th>
                <th className="p-3">Damaged</th>
                <th className="p-3">Unit Value</th>
                <th className="p-3 text-right pr-4">Supplier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-3 pl-4">
                    <p className="font-bold text-slate-900 dark:text-white">{item.itemName}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{item.itemCode}</p>
                  </td>
                  <td className="p-3">
                    <Badge variant="info">{item.category}</Badge>
                  </td>
                  <td className="p-3 font-bold">{item.totalStock}</td>
                  <td className="p-3 font-bold text-blue-600 dark:text-blue-400">{item.assignedStock}</td>
                  <td className="p-3 font-bold text-emerald-600 dark:text-emerald-400">{item.availableStock}</td>
                  <td className="p-3 font-bold text-rose-600 dark:text-rose-400">{item.damagedStock}</td>
                  <td className="p-3 font-mono font-bold">AED {item.unitValueAED}</td>
                  <td className="p-3 text-right pr-4 text-slate-500 font-medium">{item.supplier}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Inventory Item"
        subtitle="Register new equipment or gear stock"
      >
        <form onSubmit={handleAddItem} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold mb-1">Item Name *</label>
            <input
              type="text"
              required
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. High Vis Reflective Helmet"
              className="w-full bg-slate-100 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full bg-slate-100 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700"
              >
                <option value="UNIFORM">UNIFORM</option>
                <option value="HELMET">HELMET</option>
                <option value="DELIVERY_BAG">DELIVERY_BAG</option>
                <option value="GPS_TRACKER">GPS_TRACKER</option>
                <option value="SMARTPHONE">SMARTPHONE</option>
              </select>
            </div>
            <div>
              <label className="block font-bold mb-1">Initial Stock Qty</label>
              <input
                type="number"
                value={totalStock}
                onChange={(e) => setTotalStock(Number(e.target.value))}
                className="w-full bg-slate-100 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold mb-1">Unit Value (AED)</label>
            <input
              type="number"
              value={unitValue}
              onChange={(e) => setUnitValue(Number(e.target.value))}
              className="w-full bg-slate-100 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 font-bold rounded-lg"
            >
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg">
              Save Inventory Item
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
