import React, { useState, useEffect, useRef } from 'react';

const SplashScreen = ({ onFinished }) => {
  const [fadeOut, setFadeOut] = useState(false);
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    // Safety fallback timeout set to 8 seconds
    const safetyTimer = setTimeout(() => {
      handleClose();
    }, 8000);

    const video = videoRef.current;
    if (video) {
      // Try to play with audio enabled first
      video.muted = false;
      const playPromise = video.play();
      
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Playback with audio blocked, falling back to muted:', err);
          video.muted = true;
          video.play().catch((playErr) => {
            console.error('Muted playback also failed:', playErr);
            setHasError(true);
          });
        });
      }
    }

    return () => clearTimeout(safetyTimer);
  }, []);

  const handleClose = () => {
    setFadeOut(true);
    // Wait for the transition to finish before calling onFinished
    setTimeout(() => {
      onFinished();
    }, 700);
  };

  const handleInteraction = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
    }
  };

  return (
    <div
      onClick={handleInteraction}
      onTouchStart={handleInteraction}
      className={`fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center transition-opacity duration-700 ease-out cursor-pointer ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {hasError ? (
        <div className="flex flex-col items-center gap-6 select-none animate-pulse">
          <img src="/icons/icon-512.png" className="w-32 h-32 object-contain" alt="ACFC Logo" />
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
        </div>
      ) : (
        <video
          ref={videoRef}
          src="/acfc-intro.mp4"
          playsInline
          webkit-playsinline="true"
          preload="auto"
          onEnded={handleClose}
          onError={() => setHasError(true)}
          className="w-full h-full object-cover"
        />
      )}
    </div>
  );
};

export default SplashScreen;
