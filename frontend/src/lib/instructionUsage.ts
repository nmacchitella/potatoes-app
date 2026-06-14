import { abbreviateUnit, formatQuantity } from './constants';
import { convertIngredient, type UnitSystem } from './unitConversion';
import type { InstructionIngredientUsage, RecipeIngredientInput, RecipeInstructionInput } from '@/types';

export const USAGE_MARKER_RE = /\{\{usage:([A-Za-z0-9_-]+)\}\}/g;

export function formatUsageAmount(
  usage: InstructionIngredientUsage,
  scale = 1,
  unitSystem?: UnitSystem,
): string {
  if (scale === 1 && !unitSystem && usage.base_text) return usage.base_text;
  let quantity = usage.quantity * scale;
  let quantityMax = usage.quantity_max ? usage.quantity_max * scale : undefined;
  let unit = usage.unit;

  if (unitSystem && unit) {
    const converted = convertIngredient(quantity, quantityMax, unit, unitSystem);
    quantity = converted.quantity ?? quantity;
    quantityMax = converted.quantityMax;
    unit = converted.unit;
  }

  let amount = formatQuantity(quantity);
  if (quantityMax) amount = `${amount}-${formatQuantity(quantityMax)}`;
  if (unit) {
    const abbreviated = abbreviateUnit(unit);
    const metricUnits = ['g', 'kg', 'mg', 'ml', 'L'];
    amount = metricUnits.includes(abbreviated) ? `${amount}${abbreviated}` : `${amount} ${abbreviated}`;
  }
  return amount;
}

export function renderInstruction(
  instruction: Pick<RecipeInstructionInput, 'instruction_text' | 'instruction_template' | 'ingredient_usages'>,
  scale = 1,
  unitSystem?: UnitSystem,
): string {
  if (!instruction.instruction_template || !instruction.ingredient_usages?.length) {
    return instruction.instruction_text;
  }
  const usageMap = new Map(instruction.ingredient_usages.map(usage => [usage.usage_key, usage]));
  return instruction.instruction_template.replace(USAGE_MARKER_RE, (marker, key: string) => {
    const usage = usageMap.get(key);
    return usage ? formatUsageAmount(usage, scale, unitSystem) : marker;
  });
}

export function usageReconciliationWarnings(
  instructions: RecipeInstructionInput[],
  ingredients: RecipeIngredientInput[],
): string[] {
  const totals = new Map<string, Map<string, number>>();
  instructions.forEach(instruction => instruction.ingredient_usages?.forEach(usage => {
    const byUnit = totals.get(usage.ingredient_key) || new Map<string, number>();
    const unit = usage.unit || '';
    byUnit.set(unit, (byUnit.get(unit) || 0) + usage.quantity);
    totals.set(usage.ingredient_key, byUnit);
  }));

  const warnings: string[] = [];
  ingredients.forEach(ingredient => {
    if (!ingredient.key || !ingredient.quantity) return;
    const byUnit = totals.get(ingredient.key);
    if (!byUnit) return;
    const ingredientUnit = ingredient.unit || '';
    const usageTotal = byUnit.get(ingredientUnit);
    if (usageTotal !== undefined && Math.abs(usageTotal - ingredient.quantity) > 0.001) {
      warnings.push(`${ingredient.name}: steps use ${formatQuantity(usageTotal)} ${ingredient.unit || ''}, ingredient list has ${formatQuantity(ingredient.quantity)} ${ingredient.unit || ''}`.trim());
    }
    const otherUnits = [...byUnit.keys()].filter(unit => unit !== ingredientUnit);
    if (otherUnits.length > 0) {
      warnings.push(`${ingredient.name}: steps also use ${otherUnits.map(unit => unit || 'no unit').join(', ')}, which cannot be reconciled automatically.`);
    }
  });
  return warnings;
}
