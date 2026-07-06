import React, { useState, useEffect, useRef } from 'react';

const SplashScreen = ({ onFinished }) => {
  const [phase, setPhase] = useState('lanzamiento'); // 'lanzamiento' or 'video'
  const [fadeOut, setFadeOut] = useState(false);
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    if (phase === 'video') {
      const video = videoRef.current;
      if (video) {
        video.muted = false;
        video.volume = 1.0;
        video.play().catch((playErr) => {
          console.error('Video playback failed:', playErr);
          setHasError(true);
        });
      }

      // Safety fallback timeout of 12 seconds starting when video phase starts
      const safetyTimer = setTimeout(() => {
        handleClose();
      }, 12000);

      return () => clearTimeout(safetyTimer);
    }
  }, [phase]);

  const handleClose = () => {
    setFadeOut(true);
    // Wait for the transition to finish before calling onFinished
    setTimeout(() => {
      onFinished();
    }, 700);
  };

  const startVideo = () => {
    setPhase('video');
  };

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center p-4 transition-opacity duration-700 ease-out ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {phase === 'lanzamiento' ? (
        <div className="flex flex-col items-center gap-8 select-none max-w-sm text-center">
          <img
            src="/icons/icon-512.png"
            className="w-40 h-40 object-contain animate-pulse drop-shadow-[0_0_20px_rgba(79,70,229,0.2)]"
            alt="ACFC Logo"
          />
          <button
            onClick={startVideo}
            className="px-8 py-3.5 bg-gradient-to-r from-brand to-indigo-600 hover:from-indigo-600 hover:to-brand text-white font-bold rounded-xl shadow-[0_4px_20px_rgba(79,70,229,0.3)] transition-all transform hover:scale-105 active:scale-95 text-sm tracking-wider"
          >
            ENTRAR A LA COCINA
          </button>
        </div>
      ) : hasError ? (
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
          className="w-full h-full object-fill"
        />
      )}
    </div>
  );
};

export default SplashScreen;
