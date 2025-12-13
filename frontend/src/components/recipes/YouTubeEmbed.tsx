'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Extract YouTube video ID from various URL formats
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

/**
 * Check if a URL is a YouTube URL
 */
export function isYouTubeUrl(url: string): boolean {
  if (!url) return false;
  return /(?:youtube\.com|youtu\.be)/.test(url);
}

interface YouTubeEmbedProps {
  sourceUrl: string;
  thumbnailUrl?: string;
  title?: string;
  className?: string;
  videoStartSeconds?: number | null;
}

interface Position {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

const MIN_WIDTH = 280;
const MAX_WIDTH = 640;
const DEFAULT_WIDTH = 384;
const ASPECT_RATIO = 16 / 9;

/**
 * YouTube video embed component
 * Shows thumbnail with play button, then embeds video on click
 * On desktop: floats to bottom-left corner when playing, draggable and resizable
 */
export function YouTubeEmbed({ sourceUrl, thumbnailUrl, title, className = '', videoStartSeconds }: YouTubeEmbedProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFloating, setIsFloating] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  // Position and size for floating player
  const [position, setPosition] = useState<Position>({ x: 16, y: 16 });
  const [size, setSize] = useState<Size>({ width: DEFAULT_WIDTH, height: DEFAULT_WIDTH / ASPECT_RATIO });

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number }>({ x: 0, y: 0, posX: 0, posY: 0 });
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number }>({ x: 0, y: 0, width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const videoId = extractYouTubeVideoId(sourceUrl);

  // Check if we're on desktop
  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  // Auto-float on desktop when playing
  useEffect(() => {
    if (isPlaying && isDesktop) {
      setIsFloating(true);
    }
  }, [isPlaying, isDesktop]);

  // Handle drag
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (isResizing) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  }, [position, isResizing]);

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;

    // Calculate new position (from bottom-left)
    const newX = Math.max(0, Math.min(window.innerWidth - size.width - 16, dragStartRef.current.posX + deltaX));
    const newY = Math.max(0, Math.min(window.innerHeight - size.height - 16, dragStartRef.current.posY - deltaY));

    setPosition({ x: newX, y: newY });
  }, [isDragging, size]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle resize
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    };
  }, [size]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const deltaX = e.clientX - resizeStartRef.current.x;

    // Resize from right edge
    let newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, resizeStartRef.current.width + deltaX));
    const newHeight = newWidth / ASPECT_RATIO;

    setSize({ width: newWidth, height: newHeight });
  }, [isResizing]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  // Attach global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      const handleMouseUp = () => setIsDragging(false);

      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleMouseUp);
      // Also handle mouse leaving window
      window.addEventListener('blur', handleMouseUp);
      document.addEventListener('mouseleave', handleMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('blur', handleMouseUp);
        document.removeEventListener('mouseleave', handleMouseUp);
      };
    }
  }, [isDragging, handleDragMove]);

  useEffect(() => {
    if (isResizing) {
      const handleMouseUp = () => setIsResizing(false);

      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleMouseUp);
      // Also handle mouse leaving window
      window.addEventListener('blur', handleMouseUp);
      document.addEventListener('mouseleave', handleMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('blur', handleMouseUp);
        document.removeEventListener('mouseleave', handleMouseUp);
      };
    }
  }, [isResizing, handleResizeMove]);

  if (!videoId) return null;

  // Use provided thumbnail or default YouTube thumbnail
  const thumbnail = thumbnailUrl || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  const handleClose = () => {
    setIsPlaying(false);
    setIsFloating(false);
  };

  const handleDock = () => {
    setIsFloating(false);
  };

  if (isPlaying) {
    // Floating player (desktop only)
    if (isFloating && isDesktop) {
      return (
        <>
          {/* Placeholder to maintain layout */}
          <div className={`aspect-video rounded-lg bg-cream-dark mb-4 flex items-center justify-center ${className}`}>
            <button
              onClick={handleDock}
              className="text-sm text-warm-gray hover:text-gold flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              Video playing below
            </button>
          </div>

          {/* Floating player */}
          <div
            ref={containerRef}
            style={{
              left: position.x,
              bottom: position.y,
              width: size.width,
            }}
            className={`fixed z-50 rounded-lg overflow-hidden shadow-2xl bg-black border border-white/10 ${
              isDragging || isResizing ? 'select-none' : ''
            }`}
          >
            {/* Drag handle / Control bar */}
            <div
              onMouseDown={handleDragStart}
              className={`absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-2 py-1.5 bg-gradient-to-b from-black/80 to-transparent ${
                isDragging ? 'cursor-grabbing' : 'cursor-grab'
              }`}
            >
              {/* Drag indicator */}
              <div className="flex items-center gap-1.5 text-white/60">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="5" cy="6" r="1.5" />
                  <circle cx="12" cy="6" r="1.5" />
                  <circle cx="5" cy="12" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="5" cy="18" r="1.5" />
                  <circle cx="12" cy="18" r="1.5" />
                </svg>
                <span className="text-xs">Drag to move</span>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1">
                {/* Dock button */}
                <button
                  onClick={handleDock}
                  className="w-6 h-6 rounded bg-white/20 text-white hover:bg-white/30 transition-colors flex items-center justify-center"
                  title="Dock video"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </button>
                {/* Close button */}
                <button
                  onClick={handleClose}
                  className="w-6 h-6 rounded bg-white/20 text-white hover:bg-red-500 transition-colors flex items-center justify-center"
                  title="Close video"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Video */}
            <div className="aspect-video relative">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0${videoStartSeconds ? `&start=${videoStartSeconds}` : ''}`}
                title={title || 'YouTube video'}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
              {/* Overlay to capture mouse events during drag/resize */}
              {(isDragging || isResizing) && (
                <div className="absolute inset-0 bg-transparent" />
              )}
            </div>

            {/* Resize handle (right edge) */}
            <div
              onMouseDown={handleResizeStart}
              className={`absolute top-0 right-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 transition-colors ${
                isResizing ? 'bg-white/30' : ''
              }`}
            />

            {/* Resize handle (bottom-right corner) */}
            <div
              onMouseDown={handleResizeStart}
              className={`absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize ${
                isResizing ? '' : 'hover:bg-white/20'
              }`}
            >
              <svg className="w-4 h-4 text-white/40" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM22 14H20V12H22V14ZM18 18H16V16H18V18ZM14 22H12V20H14V22Z" />
              </svg>
            </div>
          </div>
        </>
      );
    }

    // Inline player (mobile or when docked)
    return (
      <div className={`relative aspect-video rounded-lg overflow-hidden bg-black ${className}`}>
        {/* Control bar for inline mode on desktop */}
        {isDesktop && (
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-end px-2 py-1.5 bg-gradient-to-b from-black/80 to-transparent">
            <div className="flex items-center gap-1">
              {/* Float button */}
              <button
                onClick={() => setIsFloating(true)}
                className="w-6 h-6 rounded bg-white/20 text-white hover:bg-white/30 transition-colors flex items-center justify-center"
                title="Float video"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </button>
              {/* Close button */}
              <button
                onClick={handleClose}
                className="w-6 h-6 rounded bg-white/20 text-white hover:bg-red-500 transition-colors flex items-center justify-center"
                title="Close video"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0${videoStartSeconds ? `&start=${videoStartSeconds}` : ''}`}
          title={title || 'YouTube video'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsPlaying(true)}
      className={`relative aspect-video rounded-lg overflow-hidden group cursor-pointer w-full ${className}`}
      aria-label="Play video"
    >
      <img
        src={thumbnail}
        alt={title || 'Video thumbnail'}
        className="w-full h-full object-cover transition-transform group-hover:scale-105"
      />
      {/* Dark overlay on hover */}
      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
      {/* Play button */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-lg group-hover:bg-red-700 group-hover:scale-110 transition-all">
          <svg
            className="w-7 h-7 text-white ml-1"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
      {/* YouTube badge */}
      <div className="absolute bottom-3 right-3 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1.5">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
        Watch video
      </div>
    </button>
  );
}
