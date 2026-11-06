// One lookup from server action name (or a local form id) to its form spec.
import { goalSave } from './form-specs-goal.js';
import { contributionGui, contributionRut, holdingSet, priceManualAdd } from './form-specs-ledger-and-market.js';
import { budgetSave, configSave } from './form-specs-budget-and-settings.js';

const SPECS = {
  goal_save: goalSave,
  contribution_gui: contributionGui,
  contribution_rut: contributionRut,
  holding_set: holdingSet,
  price_manual_add: priceManualAdd,
  budget_save: budgetSave,
  config_save: configSave
};

export const specFor = (name) => SPECS[name];
