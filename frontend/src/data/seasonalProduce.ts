export interface ProduceItem {
  name: string;
  emoji: string;
}

export interface SeasonalMonth {
  fruits: ProduceItem[];
  vegetables: ProduceItem[];
}

// Mediterranean / Italian-climate seasonal produce by month
const seasonalProduce: Record<number, SeasonalMonth> = {
  1: { // January
    fruits: [
      { name: 'Oranges', emoji: '🍊' },
      { name: 'Clementines', emoji: '🍊' },
      { name: 'Lemons', emoji: '🍋' },
      { name: 'Kiwi', emoji: '🥝' },
      { name: 'Apples', emoji: '🍎' },
      { name: 'Pears', emoji: '🍐' },
    ],
    vegetables: [
      { name: 'Broccoli', emoji: '🥦' },
      { name: 'Cauliflower', emoji: '🥬' },
      { name: 'Cabbage', emoji: '🥬' },
      { name: 'Artichokes', emoji: '🌿' },
      { name: 'Radicchio', emoji: '🥗' },
      { name: 'Fennel', emoji: '🌿' },
      { name: 'Leeks', emoji: '🧅' },
      { name: 'Chicory', emoji: '🥬' },
    ],
  },
  2: { // February
    fruits: [
      { name: 'Oranges', emoji: '🍊' },
      { name: 'Lemons', emoji: '🍋' },
      { name: 'Kiwi', emoji: '🥝' },
      { name: 'Apples', emoji: '🍎' },
      { name: 'Pears', emoji: '🍐' },
    ],
    vegetables: [
      { name: 'Broccoli', emoji: '🥦' },
      { name: 'Cauliflower', emoji: '🥬' },
      { name: 'Artichokes', emoji: '🌿' },
      { name: 'Spinach', emoji: '🥬' },
      { name: 'Radicchio', emoji: '🥗' },
      { name: 'Fennel', emoji: '🌿' },
      { name: 'Cabbage', emoji: '🥬' },
    ],
  },
  3: { // March
    fruits: [
      { name: 'Oranges', emoji: '🍊' },
      { name: 'Lemons', emoji: '🍋' },
      { name: 'Kiwi', emoji: '🥝' },
      { name: 'Apples', emoji: '🍎' },
    ],
    vegetables: [
      { name: 'Artichokes', emoji: '🌿' },
      { name: 'Asparagus', emoji: '🌿' },
      { name: 'Spinach', emoji: '🥬' },
      { name: 'Peas', emoji: '🫛' },
      { name: 'Broccoli', emoji: '🥦' },
      { name: 'Radishes', emoji: '🔴' },
      { name: 'Lettuce', emoji: '🥬' },
    ],
  },
  4: { // April
    fruits: [
      { name: 'Strawberries', emoji: '🍓' },
      { name: 'Lemons', emoji: '🍋' },
      { name: 'Oranges', emoji: '🍊' },
    ],
    vegetables: [
      { name: 'Artichokes', emoji: '🌿' },
      { name: 'Asparagus', emoji: '🌿' },
      { name: 'Peas', emoji: '🫛' },
      { name: 'Fava beans', emoji: '🫘' },
      { name: 'Spinach', emoji: '🥬' },
      { name: 'Lettuce', emoji: '🥬' },
      { name: 'Radishes', emoji: '🔴' },
    ],
  },
  5: { // May
    fruits: [
      { name: 'Strawberries', emoji: '🍓' },
      { name: 'Cherries', emoji: '🍒' },
      { name: 'Apricots', emoji: '🍑' },
      { name: 'Lemons', emoji: '🍋' },
    ],
    vegetables: [
      { name: 'Zucchini', emoji: '🥒' },
      { name: 'Peas', emoji: '🫛' },
      { name: 'Fava beans', emoji: '🫘' },
      { name: 'Asparagus', emoji: '🌿' },
      { name: 'Lettuce', emoji: '🥬' },
      { name: 'Green beans', emoji: '🫘' },
    ],
  },
  6: { // June
    fruits: [
      { name: 'Cherries', emoji: '🍒' },
      { name: 'Apricots', emoji: '🍑' },
      { name: 'Peaches', emoji: '🍑' },
      { name: 'Strawberries', emoji: '🍓' },
      { name: 'Plums', emoji: '🫐' },
      { name: 'Melons', emoji: '🍈' },
    ],
    vegetables: [
      { name: 'Zucchini', emoji: '🥒' },
      { name: 'Tomatoes', emoji: '🍅' },
      { name: 'Peppers', emoji: '🫑' },
      { name: 'Eggplant', emoji: '🍆' },
      { name: 'Cucumbers', emoji: '🥒' },
      { name: 'Green beans', emoji: '🫘' },
    ],
  },
  7: { // July
    fruits: [
      { name: 'Peaches', emoji: '🍑' },
      { name: 'Watermelon', emoji: '🍉' },
      { name: 'Melons', emoji: '🍈' },
      { name: 'Plums', emoji: '🫐' },
      { name: 'Apricots', emoji: '🍑' },
      { name: 'Figs', emoji: '🟤' },
    ],
    vegetables: [
      { name: 'Tomatoes', emoji: '🍅' },
      { name: 'Zucchini', emoji: '🥒' },
      { name: 'Peppers', emoji: '🫑' },
      { name: 'Eggplant', emoji: '🍆' },
      { name: 'Cucumbers', emoji: '🥒' },
      { name: 'Green beans', emoji: '🫘' },
    ],
  },
  8: { // August
    fruits: [
      { name: 'Watermelon', emoji: '🍉' },
      { name: 'Peaches', emoji: '🍑' },
      { name: 'Figs', emoji: '🟤' },
      { name: 'Grapes', emoji: '🍇' },
      { name: 'Melons', emoji: '🍈' },
      { name: 'Plums', emoji: '🫐' },
    ],
    vegetables: [
      { name: 'Tomatoes', emoji: '🍅' },
      { name: 'Peppers', emoji: '🫑' },
      { name: 'Eggplant', emoji: '🍆' },
      { name: 'Zucchini', emoji: '🥒' },
      { name: 'Corn', emoji: '🌽' },
      { name: 'Cucumbers', emoji: '🥒' },
    ],
  },
  9: { // September
    fruits: [
      { name: 'Grapes', emoji: '🍇' },
      { name: 'Figs', emoji: '🟤' },
      { name: 'Plums', emoji: '🫐' },
      { name: 'Pears', emoji: '🍐' },
      { name: 'Apples', emoji: '🍎' },
    ],
    vegetables: [
      { name: 'Tomatoes', emoji: '🍅' },
      { name: 'Peppers', emoji: '🫑' },
      { name: 'Eggplant', emoji: '🍆' },
      { name: 'Pumpkin', emoji: '🎃' },
      { name: 'Mushrooms', emoji: '🍄' },
      { name: 'Zucchini', emoji: '🥒' },
    ],
  },
  10: { // October
    fruits: [
      { name: 'Apples', emoji: '🍎' },
      { name: 'Pears', emoji: '🍐' },
      { name: 'Grapes', emoji: '🍇' },
      { name: 'Persimmons', emoji: '🍊' },
      { name: 'Pomegranate', emoji: '🔴' },
      { name: 'Chestnuts', emoji: '🌰' },
    ],
    vegetables: [
      { name: 'Pumpkin', emoji: '🎃' },
      { name: 'Mushrooms', emoji: '🍄' },
      { name: 'Broccoli', emoji: '🥦' },
      { name: 'Cauliflower', emoji: '🥬' },
      { name: 'Radicchio', emoji: '🥗' },
      { name: 'Fennel', emoji: '🌿' },
    ],
  },
  11: { // November
    fruits: [
      { name: 'Apples', emoji: '🍎' },
      { name: 'Pears', emoji: '🍐' },
      { name: 'Persimmons', emoji: '🍊' },
      { name: 'Pomegranate', emoji: '🔴' },
      { name: 'Kiwi', emoji: '🥝' },
      { name: 'Chestnuts', emoji: '🌰' },
      { name: 'Oranges', emoji: '🍊' },
    ],
    vegetables: [
      { name: 'Pumpkin', emoji: '🎃' },
      { name: 'Broccoli', emoji: '🥦' },
      { name: 'Cauliflower', emoji: '🥬' },
      { name: 'Artichokes', emoji: '🌿' },
      { name: 'Radicchio', emoji: '🥗' },
      { name: 'Fennel', emoji: '🌿' },
      { name: 'Cabbage', emoji: '🥬' },
    ],
  },
  12: { // December
    fruits: [
      { name: 'Oranges', emoji: '🍊' },
      { name: 'Clementines', emoji: '🍊' },
      { name: 'Kiwi', emoji: '🥝' },
      { name: 'Apples', emoji: '🍎' },
      { name: 'Pears', emoji: '🍐' },
      { name: 'Persimmons', emoji: '🍊' },
    ],
    vegetables: [
      { name: 'Broccoli', emoji: '🥦' },
      { name: 'Cauliflower', emoji: '🥬' },
      { name: 'Cabbage', emoji: '🥬' },
      { name: 'Artichokes', emoji: '🌿' },
      { name: 'Radicchio', emoji: '🥗' },
      { name: 'Fennel', emoji: '🌿' },
      { name: 'Chicory', emoji: '🥬' },
      { name: 'Leeks', emoji: '🧅' },
    ],
  },
};

export function getSeasonalProduce(month?: number): SeasonalMonth {
  const m = month ?? (new Date().getMonth() + 1);
  return seasonalProduce[m] ?? seasonalProduce[1];
}

export function getMonthName(month?: number): string {
  const m = month ?? (new Date().getMonth() + 1);
  const names = [
    '', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return names[m] ?? 'January';
}
