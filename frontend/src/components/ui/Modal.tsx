'use client';

import { useEffect, useCallback, useRef } from 'react';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';
type ModalPosition = 'center' | 'top' | 'bottom-sheet';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: ModalSize;
  position?: ModalPosition;
  className?: string;
  blur?: boolean;
  closeOnEscape?: boolean;
  closeOnBackdropClick?: boolean;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

export default function Modal({
  isOpen,
  onClose,
  children,
  size = 'md',
  position = 'center',
  className = '',
  blur = false,
  closeOnEscape = true,
  closeOnBackdropClick = true,
}: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, closeOnEscape]);

  // Lock body scroll and manage focus when modal opens
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';

      // Focus the modal content for accessibility
      setTimeout(() => {
        contentRef.current?.focus();
      }, 0);
    } else {
      document.body.style.overflow = '';

      // Restore focus to previously focused element
      previousActiveElement.current?.focus();
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleBackdropClick = useCallback(() => {
    if (closeOnBackdropClick) {
      onClose();
    }
  }, [closeOnBackdropClick, onClose]);

  if (!isOpen) return null;

  const getPositionClasses = () => {
    switch (position) {
      case 'top':
        return 'items-start justify-center pt-[15vh]';
      case 'bottom-sheet':
        return 'items-end md:items-center justify-center';
      case 'center':
      default:
        return 'items-center justify-center';
    }
  };

  const getContentClasses = () => {
    const base = `relative w-full ${sizeClasses[size]} ${className}`;
    if (position === 'bottom-sheet') {
      return `${base} mx-0 md:mx-4`;
    }
    return `${base} mx-4`;
  };

  return (
    <div className={`fixed inset-0 z-50 flex ${getPositionClasses()}`}>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 ${blur ? 'backdrop-blur-sm' : ''}`}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Content */}
      <div
        ref={contentRef}
        className={getContentClasses()}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}
