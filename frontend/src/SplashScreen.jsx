import React, { useState, useEffect } from 'react';

const SplashScreen = ({ onFinished }) => {
  const [fadeOut, setFadeOut] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Exact 4 seconds timeout for the fade-out, regardless of whether video ends
    const timer = setTimeout(() => {
      handleClose();
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setFadeOut(true);
    // Wait for the transition to finish before calling onFinished
    setTimeout(() => {
      onFinished();
    }, 700);
  };

  return (
    <div
      className={`fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center transition-opacity duration-700 ease-out ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {hasError ? (
        <div className="flex flex-col items-center gap-6 select-none animate-pulse">
          <img src="/icons/icon-512.png" className="w-32 h-32 object-contain" alt="ACFC Logo" />
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
        </div>
      ) : (
        <video
          src="/acfc-intro.mp4"
          autoPlay
          muted
          playsInline
          webkit-playsinline="true"
          preload="auto"
          onError={() => setHasError(true)}
          className="w-full h-full object-cover"
        />
      )}
    </div>
  );
};

export default SplashScreen;
