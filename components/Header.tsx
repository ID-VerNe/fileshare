import React from 'react';

interface HeaderProps {
  onBack: () => void;
  title: string;
  subtitle?: string;
  isSubfolder: boolean;
  onUpload?: () => void;
  isUploading: boolean;
  isMobile: boolean;
}

const Header: React.FC<HeaderProps> = ({
  onBack,
  title,
  subtitle,
  isSubfolder,
  onUpload,
  isUploading,
  isMobile
}) => {
  return (
    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 md:px-8 z-20">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center justify-center rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#2a4a82] transition-colors active:scale-95 group"
          title={isSubfolder ? "返回上一级" : "返回首页"}
        >
          <span className="material-icons-outlined text-xl transition-transform group-hover:-translate-x-0.5">arrow_back_ios_new</span>
        </button>
        <div className="flex flex-col">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-tight truncate max-w-[140px] md:max-w-md">{title}</h1>
          {subtitle && (
            <div className="flex items-center gap-1.5 opacity-60">
              <span className="material-icons-outlined text-[12px]">folder</span>
              <span className="text-xs font-medium truncate max-w-[120px] md:max-w-[200px]">
                {subtitle}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 ml-4">
        {/* Action Button Refinement */}
        {onUpload && (
          <button
            onClick={onUpload}
            disabled={isUploading}
            className="flex items-center justify-center gap-2 h-10 px-5 bg-[#2a4a82] hover:bg-[#1e3660] text-white text-sm font-medium rounded-xl shadow-sm active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {isUploading ? (
              <span className="material-icons-outlined animate-spin text-lg">sync</span>
            ) : (
              <span className="material-icons-outlined text-lg">upload</span>
            )}
            <span className="hidden sm:inline">上传文件</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;