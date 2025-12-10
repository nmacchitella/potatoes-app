'use client';

import type { RecipeInstructionInput } from '@/types';

interface RecipeInstructionsEditProps {
  instructions: RecipeInstructionInput[];
  onChange: (instructions: RecipeInstructionInput[]) => void;
  compact?: boolean;
}

export function RecipeInstructionsEdit({
  instructions,
  onChange,
  compact = false,
}: RecipeInstructionsEditProps) {
  const addInstruction = () => {
    onChange([...instructions, { step_number: instructions.length + 1, instruction_text: '' }]);
  };

  const removeInstruction = (index: number) => {
    const updated = instructions.filter((_, i) => i !== index);
    onChange(updated.map((inst, i) => ({ ...inst, step_number: i + 1 })));
  };

  const updateInstruction = (index: number, field: keyof RecipeInstructionInput, value: any) => {
    const updated = [...instructions];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  if (compact) {
    return (
      <div className="space-y-3">
        {instructions.map((inst, idx) => (
          <div key={idx} className="flex gap-3 group">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold text-white text-xs font-medium flex items-center justify-center mt-1">
              {idx + 1}
            </span>
            <div className="flex-1">
              <textarea
                value={inst.instruction_text}
                onChange={e => updateInstruction(idx, 'instruction_text', e.target.value)}
                placeholder="Instruction step..."
                rows={2}
                className="w-full text-sm bg-cream rounded px-3 py-2 focus:ring-1 focus:ring-gold outline-none resize-none"
              />
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  value={inst.duration_minutes || ''}
                  onChange={e => updateInstruction(idx, 'duration_minutes', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="Time"
                  className="w-14 text-xs bg-cream rounded px-2 py-1 focus:ring-1 focus:ring-gold outline-none"
                />
                <span className="text-xs text-warm-gray">min</span>
              </div>
            </div>
            <button
              onClick={() => removeInstruction(idx)}
              className="text-warm-gray hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity mt-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
        <button
          onClick={addInstruction}
          className="text-xs text-gold hover:text-gold-dark flex items-center gap-1 mt-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add step
        </button>
      </div>
    );
  }

  // Full editing style
  return (
    <div className="space-y-4">
      {instructions.map((inst, index) => (
        <div key={index} className="flex gap-3 md:gap-4 items-start">
          <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gold text-white font-bold flex items-center justify-center mt-2 text-sm">
            {index + 1}
          </span>
          <textarea
            value={inst.instruction_text}
            onChange={e => updateInstruction(index, 'instruction_text', e.target.value)}
            placeholder="Describe this step..."
            rows={2}
            className="input-field flex-1 min-w-0"
          />
          <button
            type="button"
            onClick={() => removeInstruction(index)}
            className="text-warm-gray hover:text-red-500 p-2 mt-2"
          >
            &times;
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addInstruction}
        className="text-gold hover:underline text-sm"
      >
        + Add step
      </button>
    </div>
  );
}
