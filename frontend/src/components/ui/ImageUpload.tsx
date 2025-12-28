'use client';

import { useState, useRef, useCallback } from 'react';
import { recipeApi, getErrorMessage } from '@/lib/api';

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  onClear: () => void;
  recipeId?: string;
  disabled?: boolean;
  className?: string;
  onFileSelect?: (file: File | null) => void;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export default function ImageUpload({
  value,
  onChange,
  onClear,
  recipeId,
  disabled = false,
  className = '',
  onFileSelect,
}: ImageUploadProps) {
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Invalid file type. Use JPEG, PNG, WebP, or GIF.';
    }
    if (file.size > MAX_SIZE) {
      return 'File too large. Maximum size is 10MB.';
    }
    return null;
  };

  const handleFileSelect = useCallback(async (file: File) => {
    setError('');

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Create preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setPreviewFile(file);

    // If we have a recipe ID, upload immediately
    if (recipeId) {
      setIsUploading(true);
      try {
        const result = await recipeApi.uploadImage(recipeId, file);
        onChange(result.url);
        setPreviewFile(null);
        setPreviewUrl(null);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to upload image'));
        setPreviewFile(null);
        setPreviewUrl(null);
      } finally {
        setIsUploading(false);
      }
    } else {
      // No recipe ID yet - notify parent about the pending file
      onFileSelect?.(file);
    }
  }, [recipeId, onChange, onFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled || isUploading) return;

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [disabled, isUploading, handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  }, [disabled, isUploading]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleUrlSubmit = () => {
    if (!urlInput.trim()) return;

    // Basic URL validation
    try {
      new URL(urlInput);
      onChange(urlInput);
      setUrlInput('');
      setError('');
    } catch {
      setError('Please enter a valid URL');
    }
  };

  const handleClear = () => {
    setPreviewFile(null);
    setPreviewUrl(null);
    setUrlInput('');
    setError('');
    onFileSelect?.(null);
    onClear();
  };

  // Get the pending file for new recipes (no recipeId yet)
  const getPendingFile = (): File | null => previewFile;

  // Expose getPendingFile through a ref or callback if needed
  // For now, we'll handle this in the parent component

  const displayUrl = previewUrl || value;

  return (
    <div className={className}>
      {/* Mode toggle */}
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            mode === 'upload'
              ? 'bg-gold text-white'
              : 'bg-cream-dark text-charcoal hover:bg-border'
          }`}
          disabled={disabled}
        >
          Upload
        </button>
        <button
          type="button"
          onClick={() => setMode('url')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            mode === 'url'
              ? 'bg-gold text-white'
              : 'bg-cream-dark text-charcoal hover:bg-border'
          }`}
          disabled={disabled}
        >
          URL
        </button>
      </div>

      {/* Current image preview */}
      {displayUrl && (
        <div className="relative mb-3 aspect-[4/3] rounded-lg overflow-hidden bg-cream-dark">
          <img
            src={displayUrl}
            alt="Recipe cover"
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled || isUploading}
            className="absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors disabled:opacity-50"
            aria-label="Remove image"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {isUploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* Upload mode */}
      {mode === 'upload' && !displayUrl && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
          className={`
            aspect-[4/3] rounded-lg border-2 border-dashed transition-colors cursor-pointer
            flex flex-col items-center justify-center gap-2
            ${isDragging ? 'border-gold bg-gold/10' : 'border-border hover:border-gold/50'}
            ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            capture="environment"
            onChange={handleFileInputChange}
            className="hidden"
            disabled={disabled || isUploading}
          />

          {isUploading ? (
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <svg className="w-10 h-10 text-warm-gray-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-warm-gray">
                {isDragging ? 'Drop image here' : 'Tap to take photo or choose image'}
              </p>
              <p className="text-xs text-warm-gray-light">
                JPEG, PNG, WebP, GIF up to 10MB
              </p>
            </>
          )}
        </div>
      )}

      {/* URL mode */}
      {mode === 'url' && !displayUrl && (
        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
            placeholder="https://example.com/image.jpg"
            className="input-field flex-1"
            disabled={disabled}
          />
          <button
            type="button"
            onClick={handleUrlSubmit}
            disabled={disabled || !urlInput.trim()}
            className="btn-primary px-4 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="mt-2 text-sm text-red-500">{error}</p>
      )}

      {/* Note for new recipes */}
      {mode === 'upload' && !recipeId && previewFile && (
        <p className="mt-2 text-xs text-warm-gray">
          Image will be uploaded when you save the recipe.
        </p>
      )}
    </div>
  );
}

// Export a version that exposes the pending file for new recipe creation
export function useImageUpload() {
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  return {
    pendingFile,
    setPendingFile,
  };
}
