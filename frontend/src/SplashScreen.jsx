import React, { useState, useEffect, useRef } from 'react';

const SplashScreen = ({ onFinished }) => {
  const [fadeOut, setFadeOut] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef(null);

  useEffect(() => {
    // Safety fallback timeout set to 12 seconds
    const safetyTimer = setTimeout(() => {
      handleClose();
    }, 12000);

    const video = videoRef.current;
    if (video) {
      video.muted = true;
      video.play().catch((playErr) => {
        console.error('Muted autoplay failed:', playErr);
        setHasError(true);
      });
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
      setIsMuted(false);
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
        <>
          <video
            ref={videoRef}
            src="/acfc-intro.mp4"
            muted={isMuted}
            autoPlay
            playsInline
            webkit-playsinline="true"
            preload="auto"
            onEnded={handleClose}
            onError={() => setHasError(true)}
            className="w-full h-full object-cover"
          />
          {isMuted && (
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md text-white text-xs font-semibold px-4 py-2.5 rounded-full flex items-center gap-2 select-none animate-bounce shadow-lg pointer-events-none border border-white/10">
              <span>🔊</span> Toca para activar sonido
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SplashScreen;
