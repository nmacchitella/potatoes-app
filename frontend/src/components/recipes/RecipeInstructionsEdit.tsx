'use client';

import type {
  InstructionIngredientUsage,
  RecipeIngredientInput,
  RecipeInstructionInput,
} from '@/types';
import { USAGE_MARKER_RE, usageReconciliationWarnings } from '@/lib/instructionUsage';

interface RecipeInstructionsEditProps {
  instructions: RecipeInstructionInput[];
  ingredients: RecipeIngredientInput[];
  onChange: (instructions: RecipeInstructionInput[]) => void;
  compact?: boolean;
}

type TemplateToken = { type: 'text'; value: string } | { type: 'usage'; key: string };

const newKey = (prefix: string) => `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;

function parseTemplate(template: string): TemplateToken[] {
  const tokens: TemplateToken[] = [];
  let lastIndex = 0;
  for (const match of template.matchAll(USAGE_MARKER_RE)) {
    tokens.push({ type: 'text', value: template.slice(lastIndex, match.index) });
    tokens.push({ type: 'usage', key: match[1] });
    lastIndex = match.index! + match[0].length;
  }
  tokens.push({ type: 'text', value: template.slice(lastIndex) });
  return tokens;
}

function serializeTokens(tokens: TemplateToken[]): string {
  return tokens.map(token => token.type === 'text' ? token.value : `{{usage:${token.key}}}`).join('');
}

export function RecipeInstructionsEdit({
  instructions,
  ingredients,
  onChange,
  compact = false,
}: RecipeInstructionsEditProps) {
  const updateInstruction = (index: number, changes: Partial<RecipeInstructionInput>) => {
    const updated = [...instructions];
    updated[index] = { ...updated[index], ...changes };
    onChange(updated);
  };

  const addInstruction = () => {
    onChange([...instructions, {
      key: newKey('instruction'),
      step_number: instructions.length + 1,
      instruction_text: '',
      ingredient_usages: [],
    }]);
  };

  const removeInstruction = (index: number) => {
    onChange(instructions.filter((_, i) => i !== index).map((instruction, i) => ({
      ...instruction,
      step_number: i + 1,
    })));
  };

  const updateTemplateToken = (instructionIndex: number, tokenIndex: number, value: string) => {
    const instruction = instructions[instructionIndex];
    if (!instruction.instruction_template && !instruction.ingredient_usages?.length) {
      updateInstruction(instructionIndex, { instruction_text: value });
      return;
    }
    const tokens = parseTemplate(instruction.instruction_template || instruction.instruction_text);
    tokens[tokenIndex] = { type: 'text', value };
    updateInstruction(instructionIndex, { instruction_template: serializeTokens(tokens) });
  };

  const updateUsage = (instructionIndex: number, usageKey: string, changes: Partial<InstructionIngredientUsage>) => {
    const instruction = instructions[instructionIndex];
    updateInstruction(instructionIndex, {
      ingredient_usages: (instruction.ingredient_usages || []).map(usage =>
        usage.usage_key === usageKey ? { ...usage, ...changes } : usage
      ),
    });
  };

  const addUsage = (instructionIndex: number) => {
    const ingredient = ingredients.find(item => item.key && item.name.trim());
    if (!ingredient?.key) return;
    const instruction = instructions[instructionIndex];
    const usageKey = newKey('amount');
    const template = instruction.instruction_template || instruction.instruction_text;
    updateInstruction(instructionIndex, {
      instruction_template: `${template}${template && !template.endsWith(' ') ? ' ' : ''}{{usage:${usageKey}}}`,
      ingredient_usages: [
        ...(instruction.ingredient_usages || []),
        {
          usage_key: usageKey,
          ingredient_key: ingredient.key,
          ingredient_name: ingredient.name,
          quantity: ingredient.quantity || 1,
          quantity_max: ingredient.quantity_max,
          unit: ingredient.unit,
          sort_order: instruction.ingredient_usages?.length || 0,
        },
      ],
    });
  };

  const removeUsage = (instructionIndex: number, usageKey: string) => {
    const instruction = instructions[instructionIndex];
    const template = (instruction.instruction_template || instruction.instruction_text)
      .replace(`{{usage:${usageKey}}}`, '');
    const remainingUsages = (instruction.ingredient_usages || []).filter(usage => usage.usage_key !== usageKey);
    updateInstruction(instructionIndex, {
      instruction_text: remainingUsages.length === 0 ? template : instruction.instruction_text,
      instruction_template: remainingUsages.length === 0 ? undefined : template,
      ingredient_usages: remainingUsages,
    });
  };

  const warnings = usageReconciliationWarnings(instructions, ingredients);
  const availableIngredients = ingredients.filter(ingredient => ingredient.key && ingredient.name.trim());

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {instructions.map((instruction, instructionIndex) => {
        const tokens = parseTemplate(instruction.instruction_template || instruction.instruction_text);
        const usages = new Map((instruction.ingredient_usages || []).map(usage => [usage.usage_key, usage]));

        return (
          <div key={instruction.key || instructionIndex} className="flex gap-3 group items-start">
            <span className={`${compact ? 'w-6 h-6 text-xs mt-1' : 'w-8 h-8 text-sm mt-2'} flex-shrink-0 rounded-full bg-gold text-white font-medium flex items-center justify-center`}>
              {instructionIndex + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-cream p-2 min-h-[44px]">
                {tokens.map((token, tokenIndex) => {
                  if (token.type === 'text') {
                    return (
                      <textarea
                        key={`text-${tokenIndex}`}
                        value={token.value}
                        onChange={event => updateTemplateToken(instructionIndex, tokenIndex, event.target.value)}
                        placeholder={tokens.length === 1 ? 'Describe this step...' : 'Text...'}
                        rows={1}
                        className="flex-1 min-w-[120px] bg-transparent text-sm text-charcoal outline-none resize-none"
                      />
                    );
                  }

                  const usage = usages.get(token.key);
                  if (!usage) return null;
                  return (
                    <span key={token.key} className="inline-flex flex-wrap items-center gap-1 rounded-full border border-gold/40 bg-white px-2 py-1 text-xs">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={usage.quantity}
                        onChange={event => updateUsage(instructionIndex, token.key, { quantity: Number(event.target.value) || 1, base_text: undefined })}
                        className="w-12 bg-transparent text-right outline-none"
                        aria-label="Usage quantity"
                      />
                      <span className="text-warm-gray">-</span>
                      <input
                        type="number"
                        min={usage.quantity}
                        step="0.01"
                        value={usage.quantity_max || ''}
                        onChange={event => updateUsage(instructionIndex, token.key, { quantity_max: event.target.value ? Number(event.target.value) : undefined, base_text: undefined })}
                        placeholder="max"
                        className="w-12 bg-transparent outline-none"
                        aria-label="Usage maximum quantity"
                      />
                      <input
                        value={usage.unit || ''}
                        onChange={event => updateUsage(instructionIndex, token.key, { unit: event.target.value || undefined, base_text: undefined })}
                        placeholder="unit"
                        className="w-14 bg-transparent outline-none"
                        aria-label="Usage unit"
                      />
                      <select
                        value={usage.ingredient_key}
                        onChange={event => {
                          const selected = ingredients.find(item => item.key === event.target.value);
                          updateUsage(instructionIndex, token.key, {
                            ingredient_key: event.target.value,
                            ingredient_name: selected?.name,
                          });
                        }}
                        className="max-w-28 bg-transparent outline-none text-gold-dark"
                        aria-label="Linked ingredient"
                      >
                        {availableIngredients.map(ingredient => (
                          <option key={ingredient.key} value={ingredient.key}>{ingredient.name}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => removeUsage(instructionIndex, token.key)} className="text-warm-gray hover:text-red-500" aria-label="Remove scalable amount">
                        &times;
                      </button>
                    </span>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => addUsage(instructionIndex)}
                  disabled={availableIngredients.length === 0}
                  className="text-xs text-gold hover:text-gold-dark disabled:opacity-40"
                >
                  + Scalable amount
                </button>
                {compact && (
                  <>
                    <input
                      type="number"
                      value={instruction.duration_minutes || ''}
                      onChange={event => updateInstruction(instructionIndex, { duration_minutes: event.target.value ? Number(event.target.value) : undefined })}
                      placeholder="Time"
                      className="w-14 text-xs bg-cream rounded px-2 py-1 focus:ring-1 focus:ring-gold outline-none"
                    />
                    <span className="text-xs text-warm-gray">min</span>
                  </>
                )}
              </div>
            </div>
            <button type="button" onClick={() => removeInstruction(instructionIndex)} className="text-warm-gray hover:text-red-500 p-1 mt-1">
              &times;
            </button>
          </div>
        );
      })}
      <button type="button" onClick={addInstruction} className="text-xs text-gold hover:text-gold-dark">
        + Add step
      </button>
      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <p className="font-medium mb-1">Ingredient usage totals may need review</p>
          {warnings.map(warning => <p key={warning}>{warning}</p>)}
        </div>
      )}
    </div>
  );
}
