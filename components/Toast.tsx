import React from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
}

const Toast: React.FC<ToastProps> = ({ message, type }) => {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-4 duration-300">
      <div className={`px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-3 border ${
        type === 'success' 
          ? 'bg-primary/90 text-white border-white/20' 
          : 'bg-red-500/90 text-white border-white/20'
      }`}>
        <span className="material-icons-outlined text-xl">
          {type === 'success' ? 'check_circle' : 'error'}
        </span>
        <span className="text-sm font-bold tracking-wide">{message}</span>
      </div>
    </div>
  );
};

export default Toast;