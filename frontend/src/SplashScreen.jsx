import React, { useState, useEffect } from 'react';

const SplashScreen = ({ onFinished }) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Safety timeout of 4.5 seconds
    const timer = setTimeout(() => {
      handleClose();
    }, 4500);

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
      className={`fixed inset-0 z-50 bg-slate-900 flex items-center justify-center transition-opacity duration-700 ease-out ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <video
        src="/acfc-intro.mp4"
        autoPlay
        muted
        playsInline
        onEnded={handleClose}
        className="max-w-full max-h-full object-contain"
      />
    </div>
  );
};

export default SplashScreen;
