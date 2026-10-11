/**
 * Rich Initial Fleet & Vehicle Operations Dataset
 * Multi-Tenant Delivery Operations ERP
 */

import {
  DbVehicleMasterEnhanced,
  DbVehicleStatusHistory,
  DbVehicleAssignmentRecord,
  DbVehicleOdometerHistory,
  DbVehicleMaintenance,
  DbMaintenanceRule,
  DbFuelEntry,
  DbFuelCard,
  DbVehicleAccident,
  DbVehicleFine,
  DbVehicleExpense,
  DbFleetVendor,
  DbFleetException,
} from '../types/fleet';

export const initialFleetVehicles: DbVehicleMasterEnhanced[] = [];

export const initialFleetAssignments: DbVehicleAssignmentRecord[] = [];

export const initialFleetStatusHistories: DbVehicleStatusHistory[] = [];

export const initialFleetOdometerHistories: DbVehicleOdometerHistory[] = [];

export const initialFleetMaintenance: DbVehicleMaintenance[] = [];

export const initialMaintenanceRules: DbMaintenanceRule[] = [];

export const initialFleetFuelEntries: DbFuelEntry[] = [];

export const initialFleetFuelCards: DbFuelCard[] = [];

export const initialFleetAccidents: DbVehicleAccident[] = [];

export const initialFleetFines: DbVehicleFine[] = [];

export const initialFleetVendors: DbFleetVendor[] = [];

export const initialFleetExceptions: DbFleetException[] = [];
