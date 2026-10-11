/**
 * Vehicle Make & Model Live Master Service
 * Provides backend-authoritative master data for vehicle makes and dependent models.
 * Used across UAE fleet operations (motorcycles, vans, cars).
 */

export interface VehicleMake {
  id: string;
  name: string;
  active: boolean;
  vehicle_type?: string;
  created_at: string;
  updated_at: string;
}

export interface VehicleModel {
  id: string;
  make_id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Vehicle Make & Model Live Master Service
 * Provides backend-authoritative master data for vehicle makes and dependent models.
 * Enforces exact canonical references, deduplication, case-insensitivity, and tenant isolation.
 */

export interface VehicleMake {
  id: string;
  tenant_id?: string;
  name: string;
  active: boolean;
  vehicle_type?: string;
  created_at: string;
  updated_at: string;
}

export interface VehicleModel {
  id: string;
  tenant_id?: string;
  make_id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// Exactly 11 UNIQUE canonical active vehicle makes from Allied Fleet Master
const INITIAL_MAKES: VehicleMake[] = [
  { id: 'make_honda', name: 'Honda', active: true, vehicle_type: 'Motorcycle', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'make_bajaj', name: 'Bajaj', active: true, vehicle_type: 'Motorcycle', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'make_toyota', name: 'Toyota', active: true, vehicle_type: 'Van', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'make_hero', name: 'Hero', active: true, vehicle_type: 'Motorcycle', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'make_sanya', name: 'Sanya', active: true, vehicle_type: 'Motorcycle', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'make_suzuki', name: 'Suzuki', active: true, vehicle_type: 'Motorcycle', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'make_folony', name: 'Folony', active: true, vehicle_type: 'Motorcycle', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'make_techno', name: 'Techno', active: true, vehicle_type: 'Motorcycle', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'make_nissan', name: 'Nissan', active: true, vehicle_type: 'Car', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'make_tvs', name: 'TVS', active: true, vehicle_type: 'Motorcycle', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'make_kia', name: 'KIA', active: true, vehicle_type: 'Car', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
];

// Canonical Allied models linked to each make
const INITIAL_MODELS: VehicleModel[] = [
  // 1. Honda
  { id: 'mod_hon_unicorn160', make_id: 'make_honda', name: 'Unicorn 160', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'mod_hon_unicorn', make_id: 'make_honda', name: 'Unicorn', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'mod_hon_cb125f', make_id: 'make_honda', name: 'CB 125F', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'mod_hon_cb150r', make_id: 'make_honda', name: 'CB 150R', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'mod_hon_cd110', make_id: 'make_honda', name: 'CD 110 Dream', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'mod_hon_cg125', make_id: 'make_honda', name: 'CG 125', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'mod_hon_pcx150', make_id: 'make_honda', name: 'PCX 150', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },

  // 2. Bajaj
  { id: 'mod_baj_pul150', make_id: 'make_bajaj', name: 'Pulsar 150', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'mod_baj_pulsar', make_id: 'make_bajaj', name: 'Pulsar', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'mod_baj_ct125', make_id: 'make_bajaj', name: 'CT 125', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'mod_baj_ct100', make_id: 'make_bajaj', name: 'CT 100', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'mod_baj_boxer150', make_id: 'make_bajaj', name: 'Boxer BM 150', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'mod_baj_platina', make_id: 'make_bajaj', name: 'Platina 110', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },

  // 3. Toyota
  { id: 'mod_toy_hiace', make_id: 'make_toyota', name: 'HiAce High Roof 2.8L', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'mod_toy_yaris', make_id: 'make_toyota', name: 'Yaris', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'mod_toy_hilux', make_id: 'make_toyota', name: 'Hilux', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },

  // 4. Hero
  { id: 'mod_hero_hunk', make_id: 'make_hero', name: 'Hunk', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'mod_hero_splendor', make_id: 'make_hero', name: 'Splendor', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'mod_hero_hfdeluxe', make_id: 'make_hero', name: 'HF Deluxe', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'mod_hero_glamour', make_id: 'make_hero', name: 'Glamour', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'mod_hero_thriller', make_id: 'make_hero', name: 'Thriller 150', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },

  // 5. Sanya
  { id: 'mod_san_150', make_id: 'make_sanya', name: 'Sanya 150', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'mod_san_sy150', make_id: 'make_sanya', name: 'SY150', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },

  // 6. Suzuki
  { id: 'mod_suz_gd110', make_id: 'make_suzuki', name: 'GD 110', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'mod_suz_gs150', make_id: 'make_suzuki', name: 'GS 150', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'mod_suz_gixxer', make_id: 'make_suzuki', name: 'Gixxer 155', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },

  // 7. Folony
  { id: 'mod_fol_150', make_id: 'make_folony', name: 'Folony 150', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },

  // 8. Techno
  { id: 'mod_tec_150', make_id: 'make_techno', name: 'Techno 150', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },

  // 9. Nissan
  { id: 'mod_nis_sunny', make_id: 'make_nissan', name: 'Sunny 1.6L SV', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'mod_nis_urvan', make_id: 'make_nissan', name: 'NV350 Urvan', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },

  // 10. TVS
  { id: 'mod_tvs_hlx125', make_id: 'make_tvs', name: 'HLX 125', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'mod_tvs_hlx150', make_id: 'make_tvs', name: 'HLX 150', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'mod_tvs_apache160', make_id: 'make_tvs', name: 'Apache RTR 160', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },

  // 11. KIA
  { id: 'mod_kia_pegas', make_id: 'make_kia', name: 'Pegas', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'mod_kia_rio', make_id: 'make_kia', name: 'Rio', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'mod_kia_cerato', make_id: 'make_kia', name: 'Cerato', active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
];

let makesStore: VehicleMake[] = [...INITIAL_MAKES];
let modelsStore: VehicleModel[] = [...INITIAL_MODELS];

/**
 * Normalization helper: strips excess spaces and treats case variations as identical.
 */
export function normalizeMasterString(input: string): string {
  return (input || '').trim().replace(/\s+/g, ' ');
}

/**
 * Validates and canonicalizes vehicle make names according to Allied rules.
 * Throws explicit descriptive errors when models or engine displacements are supplied as makes.
 */
export function canonicalizeMakeInput(rawName: string): string {
  const normalized = normalizeMasterString(rawName);
  const upper = normalized.toUpperCase();

  if (!upper) {
    throw new Error('Vehicle make name is required');
  }

  // Explicit rejections of models passed as makes
  if (upper === 'HONDA UNICORN' || upper.startsWith('HONDA UNICORN')) {
    throw new Error('Honda Unicorn is a model, not a brand/make. Select Make: Honda, Model: Unicorn 160.');
  }
  if (upper === 'BAJAJ PULSAR' || upper.startsWith('BAJAJ PULSAR') || upper === 'PULSAR' || upper === 'PULSAR 150') {
    throw new Error('Bajaj Pulsar is a model, not a brand/make. Select Make: Bajaj, Model: Pulsar 150.');
  }
  if (upper === 'HERO HUNK' || upper.startsWith('HERO HUNK')) {
    throw new Error('Hero Hunk is a model, not a brand/make. Select Make: Hero, Model: Hunk.');
  }
  if (upper === '150 CC' || upper === '150CC' || upper === '150-CC') {
    throw new Error('150 CC is an engine displacement / unclassified reference, not a vehicle make.');
  }

  // Canonical normalization of old duplicates / typos
  if (upper === 'FOLON' || upper === 'FOLONY') return 'Folony';
  if (upper === 'HONDA') return 'Honda';
  if (upper === 'BAJAJ') return 'Bajaj';
  if (upper === 'TOYOTA') return 'Toyota';
  if (upper === 'HERO') return 'Hero';
  if (upper === 'SANYA') return 'Sanya';
  if (upper === 'SUZUKI') return 'Suzuki';
  if (upper === 'TECHNO') return 'Techno';
  if (upper === 'NISSAN') return 'Nissan';
  if (upper === 'TVS') return 'TVS';
  if (upper === 'KIA') return 'KIA';

  return normalized;
}

/**
 * Normalizes model names to avoid repeating the make name.
 * e.g., "Honda Unicorn 160" under make Honda becomes "Unicorn 160".
 */
export function canonicalizeModelInput(rawName: string, makeName?: string): string {
  let normalized = normalizeMasterString(rawName);
  if (!normalized) {
    throw new Error('Vehicle model name is required');
  }

  if (makeName) {
    const makeUpper = makeName.trim().toUpperCase();
    const modelUpper = normalized.toUpperCase();
    if (modelUpper.startsWith(makeUpper + ' ')) {
      normalized = normalized.slice(makeName.length).trim();
    }
  }

  return normalized;
}

export const vehicleMakeModelService = {
  getMakes(filters?: {
    tenantId?: string;
    q?: string;
    vehicle_type?: string;
    include_inactive?: boolean;
  }): VehicleMake[] {
    let list = [...makesStore];

    // Filter by tenant if tenant-specific makes exist (system records with no tenant_id are visible to all)
    if (filters?.tenantId) {
      list = list.filter((m) => !m.tenant_id || m.tenant_id === filters.tenantId);
    }

    if (!filters?.include_inactive) {
      list = list.filter((m) => m.active);
    }

    if (filters?.vehicle_type && filters.vehicle_type !== 'All') {
      list = list.filter(
        (m) => !m.vehicle_type || m.vehicle_type.toLowerCase() === filters.vehicle_type?.toLowerCase()
      );
    }

    if (filters?.q && filters.q.trim()) {
      const term = filters.q.toLowerCase().trim();
      list = list.filter((m) => m.name.toLowerCase().includes(term));
    }

    return list;
  },

  getMakeById(id: string): VehicleMake | undefined {
    return makesStore.find((m) => m.id === id);
  },

  getMakeByName(name: string, tenantId?: string): VehicleMake | undefined {
    const clean = normalizeMasterString(name).toLowerCase();
    return makesStore.find((m) => {
      const matchName = m.name.toLowerCase() === clean;
      if (!matchName) return false;
      if (tenantId && m.tenant_id && m.tenant_id !== tenantId) return false;
      return true;
    });
  },

  createMake(data: {
    tenantId?: string;
    name: string;
    vehicle_type?: string;
    active?: boolean;
  }): VehicleMake {
    const canonicalName = canonicalizeMakeInput(data.name);

    // Enforce uniqueness (tenant + normalized name)
    const existing = makesStore.find((m) => {
      const sameName = m.name.toLowerCase() === canonicalName.toLowerCase();
      if (!sameName) return false;
      if (data.tenantId && m.tenant_id && m.tenant_id !== data.tenantId) return false;
      return true;
    });

    if (existing) {
      return existing;
    }

    const newMake: VehicleMake = {
      id: `make_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      tenant_id: data.tenantId,
      name: canonicalName,
      active: data.active !== false,
      vehicle_type: data.vehicle_type || 'Motorcycle',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    makesStore.push(newMake);
    return newMake;
  },

  updateMake(id: string, updates: Partial<VehicleMake>): VehicleMake {
    const index = makesStore.findIndex((m) => m.id === id);
    if (index === -1) {
      throw new Error('Make not found');
    }

    if (updates.name) {
      updates.name = canonicalizeMakeInput(updates.name);
    }

    makesStore[index] = {
      ...makesStore[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    return makesStore[index];
  },

  getModels(filters?: {
    tenantId?: string;
    make_id?: string;
    make_name?: string;
    q?: string;
    include_inactive?: boolean;
  }): VehicleModel[] {
    let list = [...modelsStore];

    if (filters?.tenantId) {
      list = list.filter((m) => !m.tenant_id || m.tenant_id === filters.tenantId);
    }

    if (!filters?.include_inactive) {
      list = list.filter((m) => m.active);
    }

    if (filters?.make_id) {
      list = list.filter((m) => m.make_id === filters.make_id);
    } else if (filters?.make_name) {
      const make = this.getMakeByName(filters.make_name, filters?.tenantId);
      if (make) {
        list = list.filter((m) => m.make_id === make.id);
      } else {
        return [];
      }
    }

    if (filters?.q && filters.q.trim()) {
      const term = filters.q.toLowerCase().trim();
      list = list.filter((m) => m.name.toLowerCase().includes(term));
    }

    return list;
  },

  getModelById(id: string): VehicleModel | undefined {
    return modelsStore.find((m) => m.id === id);
  },

  createModel(data: {
    tenantId?: string;
    make_id: string;
    name: string;
    active?: boolean;
  }): VehicleModel {
    const make = makesStore.find((m) => m.id === data.make_id);
    if (!make) {
      throw new Error(`Make with id "${data.make_id}" not found`);
    }

    const canonicalName = canonicalizeModelInput(data.name, make.name);

    // Enforce uniqueness (tenant + make_id + normalized name)
    const existing = modelsStore.find((m) => {
      const match = m.make_id === data.make_id && m.name.toLowerCase() === canonicalName.toLowerCase();
      if (!match) return false;
      if (data.tenantId && m.tenant_id && m.tenant_id !== data.tenantId) return false;
      return true;
    });

    if (existing) {
      return existing;
    }

    const newModel: VehicleModel = {
      id: `mod_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      tenant_id: data.tenantId,
      make_id: data.make_id,
      name: canonicalName,
      active: data.active !== false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    modelsStore.push(newModel);
    return newModel;
  },

  updateModel(id: string, updates: Partial<VehicleModel>): VehicleModel {
    const index = modelsStore.findIndex((m) => m.id === id);
    if (index === -1) {
      throw new Error('Model not found');
    }

    if (updates.name) {
      const make = makesStore.find((m) => m.id === modelsStore[index].make_id);
      updates.name = canonicalizeModelInput(updates.name, make?.name);
    }

    modelsStore[index] = {
      ...modelsStore[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    return modelsStore[index];
  },

  /**
   * Reset to canonical seed (useful for QA verification in demo tenant)
   */
  resetToCanonical(): void {
    makesStore = [...INITIAL_MAKES];
    modelsStore = [...INITIAL_MODELS];
  },
};

