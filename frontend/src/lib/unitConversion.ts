/**
 * Unit Conversion System
 *
 * Converts between metric and imperial units for recipe ingredients.
 * Supports volume and weight conversions with smart rounding.
 */

export type UnitSystem = 'metric' | 'imperial';

// Unit definitions with conversion factors
interface UnitDefinition {
  type: 'volume' | 'weight' | 'count' | 'other';
  system: UnitSystem | 'both';
  baseUnit: string; // Base unit for conversions (ml for volume, g for weight)
  toBase: number; // Multiplier to convert to base unit
  aliases: string[];
}

const unitDefinitions: Record<string, UnitDefinition> = {
  // Metric Volume
  'ml': { type: 'volume', system: 'metric', baseUnit: 'ml', toBase: 1, aliases: ['milliliter', 'millilitre', 'milliliters', 'millilitres'] },
  'L': { type: 'volume', system: 'metric', baseUnit: 'ml', toBase: 1000, aliases: ['l', 'liter', 'litre', 'liters', 'litres'] },
  'cl': { type: 'volume', system: 'metric', baseUnit: 'ml', toBase: 10, aliases: ['centiliter', 'centilitre'] },
  'dl': { type: 'volume', system: 'metric', baseUnit: 'ml', toBase: 100, aliases: ['deciliter', 'decilitre'] },

  // Imperial Volume
  'cup': { type: 'volume', system: 'imperial', baseUnit: 'ml', toBase: 236.588, aliases: ['cups', 'c'] },
  'tbsp': { type: 'volume', system: 'imperial', baseUnit: 'ml', toBase: 14.787, aliases: ['tablespoon', 'tablespoons', 'T', 'Tbsp'] },
  'tsp': { type: 'volume', system: 'imperial', baseUnit: 'ml', toBase: 4.929, aliases: ['teaspoon', 'teaspoons', 't'] },
  'fl oz': { type: 'volume', system: 'imperial', baseUnit: 'ml', toBase: 29.574, aliases: ['fluid ounce', 'fluid ounces', 'fl. oz', 'floz'] },
  'pint': { type: 'volume', system: 'imperial', baseUnit: 'ml', toBase: 473.176, aliases: ['pints', 'pt'] },
  'quart': { type: 'volume', system: 'imperial', baseUnit: 'ml', toBase: 946.353, aliases: ['quarts', 'qt'] },
  'gallon': { type: 'volume', system: 'imperial', baseUnit: 'ml', toBase: 3785.41, aliases: ['gallons', 'gal'] },

  // Metric Weight
  'g': { type: 'weight', system: 'metric', baseUnit: 'g', toBase: 1, aliases: ['gram', 'grams', 'gr'] },
  'kg': { type: 'weight', system: 'metric', baseUnit: 'g', toBase: 1000, aliases: ['kilogram', 'kilograms', 'kilo', 'kilos'] },
  'mg': { type: 'weight', system: 'metric', baseUnit: 'g', toBase: 0.001, aliases: ['milligram', 'milligrams'] },

  // Imperial Weight
  'oz': { type: 'weight', system: 'imperial', baseUnit: 'g', toBase: 28.3495, aliases: ['ounce', 'ounces'] },
  'lb': { type: 'weight', system: 'imperial', baseUnit: 'g', toBase: 453.592, aliases: ['lbs', 'pound', 'pounds'] },

  // Count-based (no conversion)
  'piece': { type: 'count', system: 'both', baseUnit: 'piece', toBase: 1, aliases: ['pieces', 'pc', 'pcs'] },
  'whole': { type: 'count', system: 'both', baseUnit: 'piece', toBase: 1, aliases: [] },
  'clove': { type: 'count', system: 'both', baseUnit: 'piece', toBase: 1, aliases: ['cloves'] },
  'slice': { type: 'count', system: 'both', baseUnit: 'piece', toBase: 1, aliases: ['slices'] },
  'bunch': { type: 'count', system: 'both', baseUnit: 'piece', toBase: 1, aliases: ['bunches'] },
  'sprig': { type: 'count', system: 'both', baseUnit: 'piece', toBase: 1, aliases: ['sprigs'] },
  'pinch': { type: 'count', system: 'both', baseUnit: 'piece', toBase: 1, aliases: ['pinches'] },
  'dash': { type: 'count', system: 'both', baseUnit: 'piece', toBase: 1, aliases: ['dashes'] },
  'handful': { type: 'count', system: 'both', baseUnit: 'piece', toBase: 1, aliases: ['handfuls'] },
  'can': { type: 'count', system: 'both', baseUnit: 'piece', toBase: 1, aliases: ['cans'] },
  'package': { type: 'count', system: 'both', baseUnit: 'piece', toBase: 1, aliases: ['packages', 'pkg'] },
  'stick': { type: 'count', system: 'both', baseUnit: 'piece', toBase: 1, aliases: ['sticks'] },
};

// Build alias lookup
const unitAliasMap: Record<string, string> = {};
Object.entries(unitDefinitions).forEach(([unit, def]) => {
  unitAliasMap[unit.toLowerCase()] = unit;
  def.aliases.forEach(alias => {
    unitAliasMap[alias.toLowerCase()] = unit;
  });
});

/**
 * Normalize a unit string to its canonical form
 */
export function normalizeUnit(unit: string): string | null {
  if (!unit) return null;
  const normalized = unit.toLowerCase().trim();
  return unitAliasMap[normalized] || null;
}

/**
 * Get unit definition
 */
export function getUnitDefinition(unit: string): UnitDefinition | null {
  const normalized = normalizeUnit(unit);
  if (!normalized) return null;
  return unitDefinitions[normalized] || null;
}

/**
 * Check if a unit can be converted
 */
export function isConvertibleUnit(unit: string): boolean {
  const def = getUnitDefinition(unit);
  if (!def) return false;
  return def.type === 'volume' || def.type === 'weight';
}

/**
 * Get the system of a unit
 */
export function getUnitSystem(unit: string): UnitSystem | 'both' | null {
  const def = getUnitDefinition(unit);
  return def?.system || null;
}

// Preferred units for each system and type
const preferredUnits: Record<UnitSystem, Record<string, { unit: string; threshold: number }[]>> = {
  metric: {
    volume: [
      { unit: 'L', threshold: 1000 },
      { unit: 'ml', threshold: 0 },
    ],
    weight: [
      { unit: 'kg', threshold: 1000 },
      { unit: 'g', threshold: 0 },
    ],
  },
  imperial: {
    volume: [
      { unit: 'gallon', threshold: 3785 },
      { unit: 'quart', threshold: 946 },
      { unit: 'pint', threshold: 473 },
      { unit: 'cup', threshold: 118 }, // Half cup threshold
      { unit: 'fl oz', threshold: 29 },
      { unit: 'tbsp', threshold: 14 },
      { unit: 'tsp', threshold: 0 },
    ],
    weight: [
      { unit: 'lb', threshold: 453 },
      { unit: 'oz', threshold: 0 },
    ],
  },
};

/**
 * Smart rounding for ingredient quantities
 */
function smartRound(value: number): number {
  if (value >= 100) {
    return Math.round(value);
  } else if (value >= 10) {
    return Math.round(value * 2) / 2; // Round to 0.5
  } else if (value >= 1) {
    return Math.round(value * 4) / 4; // Round to 0.25
  } else if (value >= 0.25) {
    return Math.round(value * 4) / 4; // Round to 0.25
  } else if (value >= 0.125) {
    return Math.round(value * 8) / 8; // Round to 0.125 (1/8)
  } else {
    return Math.round(value * 100) / 100;
  }
}

/**
 * Convert a quantity from one unit to another system
 */
export function convertUnit(
  quantity: number,
  fromUnit: string,
  targetSystem: UnitSystem
): { quantity: number; unit: string } | null {
  const fromDef = getUnitDefinition(fromUnit);
  if (!fromDef) return null;

  // If it's a count or the unit system matches, no conversion needed
  if (fromDef.type === 'count' || fromDef.type === 'other') {
    return { quantity, unit: normalizeUnit(fromUnit) || fromUnit };
  }

  if (fromDef.system === targetSystem || fromDef.system === 'both') {
    return { quantity, unit: normalizeUnit(fromUnit) || fromUnit };
  }

  // Convert to base unit first (ml or g)
  const baseValue = quantity * fromDef.toBase;

  // Find the best target unit
  const typePrefs = preferredUnits[targetSystem][fromDef.type];
  if (!typePrefs) return null;

  let bestUnit = typePrefs[typePrefs.length - 1].unit; // Default to smallest
  for (const pref of typePrefs) {
    if (baseValue >= pref.threshold) {
      bestUnit = pref.unit;
      break;
    }
  }

  // Convert from base to target unit
  const targetDef = unitDefinitions[bestUnit];
  if (!targetDef) return null;

  const convertedValue = baseValue / targetDef.toBase;

  return {
    quantity: smartRound(convertedValue),
    unit: bestUnit,
  };
}

/**
 * Format a quantity nicely (fractions for imperial)
 */
export function formatQuantity(quantity: number, unit: string, system: UnitSystem): string {
  const unitDef = getUnitDefinition(unit);

  // For imperial volume, show fractions
  if (system === 'imperial' && unitDef?.type === 'volume') {
    return formatAsFraction(quantity);
  }

  // For metric or weight, show decimals
  if (Number.isInteger(quantity)) {
    return quantity.toString();
  }

  // Smart decimal formatting
  if (quantity >= 10) {
    return quantity.toFixed(0);
  } else if (quantity >= 1) {
    return quantity % 1 === 0 ? quantity.toString() : quantity.toFixed(1);
  } else {
    return quantity.toFixed(2).replace(/\.?0+$/, '');
  }
}

/**
 * Convert a number to a fraction string (for imperial)
 */
function formatAsFraction(value: number): string {
  const wholePart = Math.floor(value);
  const fractionalPart = value - wholePart;

  // Common fractions
  const fractions: [number, string][] = [
    [0, ''],
    [0.125, '1/8'],
    [0.25, '1/4'],
    [0.333, '1/3'],
    [0.375, '3/8'],
    [0.5, '1/2'],
    [0.625, '5/8'],
    [0.667, '2/3'],
    [0.75, '3/4'],
    [0.875, '7/8'],
    [1, ''],
  ];

  // Find closest fraction
  let closestFraction = '';
  let minDiff = 1;
  for (const [frac, str] of fractions) {
    const diff = Math.abs(fractionalPart - frac);
    if (diff < minDiff) {
      minDiff = diff;
      closestFraction = str;
    }
  }

  if (wholePart === 0 && closestFraction) {
    return closestFraction;
  } else if (closestFraction) {
    return `${wholePart} ${closestFraction}`;
  } else {
    return wholePart.toString();
  }
}

/**
 * Convert an ingredient to the target unit system
 */
export function convertIngredient(
  quantity: number | null | undefined,
  quantityMax: number | null | undefined,
  unit: string | null | undefined,
  targetSystem: UnitSystem
): {
  quantity: number | undefined;
  quantityMax: number | undefined;
  unit: string | undefined;
  displayQuantity: string;
  displayQuantityMax: string | undefined;
} {
  if (!quantity || !unit) {
    return {
      quantity: quantity || undefined,
      quantityMax: quantityMax || undefined,
      unit: unit || undefined,
      displayQuantity: quantity?.toString() || '',
      displayQuantityMax: quantityMax?.toString() || undefined,
    };
  }

  const converted = convertUnit(quantity, unit, targetSystem);
  let convertedMax = quantityMax ? convertUnit(quantityMax, unit, targetSystem) : null;

  if (!converted) {
    return {
      quantity,
      quantityMax: quantityMax || undefined,
      unit,
      displayQuantity: quantity.toString(),
      displayQuantityMax: quantityMax?.toString() || undefined,
    };
  }

  // Ensure max uses same unit as min
  if (convertedMax && convertedMax.unit !== converted.unit) {
    // Re-convert max to same unit
    const fromDef = getUnitDefinition(unit);
    const toDef = getUnitDefinition(converted.unit);
    if (fromDef && toDef && quantityMax) {
      const baseValue = quantityMax * fromDef.toBase;
      convertedMax = {
        quantity: smartRound(baseValue / toDef.toBase),
        unit: converted.unit,
      };
    }
  }

  return {
    quantity: converted.quantity,
    quantityMax: convertedMax?.quantity || undefined,
    unit: converted.unit,
    displayQuantity: formatQuantity(converted.quantity, converted.unit, targetSystem),
    displayQuantityMax: convertedMax ? formatQuantity(convertedMax.quantity, convertedMax.unit, targetSystem) : undefined,
  };
}

/**
 * Check if two units are in different systems
 */
export function needsConversion(unit: string, targetSystem: UnitSystem): boolean {
  const system = getUnitSystem(unit);
  if (!system || system === 'both') return false;
  return system !== targetSystem;
}
