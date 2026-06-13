'use client';

import { useEffect } from 'react';

const editableSelector = 'input, textarea, select, [contenteditable="true"]';

export default function MobileKeyboardDismiss() {
  useEffect(() => {
    const dismissKeyboard = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') return;

      const activeElement = document.activeElement;
      const target = event.target;

      if (
        !(activeElement instanceof HTMLElement) ||
        !activeElement.matches(editableSelector) ||
        !(target instanceof Element) ||
        target.closest(editableSelector)
      ) {
        return;
      }

      activeElement.blur();
    };

    document.addEventListener('pointerdown', dismissKeyboard, true);
    return () => document.removeEventListener('pointerdown', dismissKeyboard, true);
  }, []);

  return null;
}
