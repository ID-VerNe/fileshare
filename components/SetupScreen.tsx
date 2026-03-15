import React from 'react';
import Spinner from './Spinner';

interface SetupScreenProps {
  itemId: string;
  setItemId: (id: string) => void;
  isLoading: boolean;
  error: string | null;
  onFetch: () => void;
  onAdminAuth: () => void;
}

const SetupScreen: React.FC<SetupScreenProps> = ({
  itemId,
  setItemId,
  isLoading,
  error,
  onFetch,
  onAdminAuth
}) => {
  return (
    <main className="flex-grow flex items-center justify-center p-6 md:p-8 bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
      <div className="w-full max-w-md mx-auto animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out">
        {/* Header - Refined Typography */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">文件共享</h1>
          <p className="text-sm font-medium text-slate-500 tracking-wide uppercase">Secure Cloud Bridge</p>
        </div>

        {/* Card - Solid White, Subtle Shadow, 24px/32px Padding */}
        <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex flex-col gap-6">
            
            {/* Input Group */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1" htmlFor="itemId">
                Access Code
              </label>
              <input
                id="itemId"
                type="text"
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onFetch();
                }}
                placeholder="请输入您的取件码"
                className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2a4a82]/20 focus:border-[#2a4a82] transition-all"
                disabled={isLoading}
              />
            </div>

            {/* Action Button - Zenith Blue */}
            <button
              onClick={onFetch}
              disabled={isLoading || !itemId}
              className="group relative w-full h-12 flex items-center justify-center bg-[#2a4a82] hover:bg-[#1e3660] text-white font-medium rounded-xl shadow-sm hover:shadow-md active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Spinner /> 
                  <span className="text-sm tracking-wide">正在连接...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm tracking-wide">获取文件</span>
                  <span className="material-icons-outlined text-lg transition-transform group-hover:translate-x-1">arrow_forward</span>
                </div>
              )}
            </button>
            
          </div>

          {/* Error State */}
          {error && (
            <div className="mt-6 bg-red-50 border border-red-100 p-4 rounded-xl flex items-start gap-3 animate-in shake duration-500">
              <span className="material-icons-outlined text-red-500 mt-0.5">error_outline</span>
              <div>
                <p className="text-xs font-bold text-red-800 uppercase tracking-wider mb-1">Error Detected</p>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center flex flex-col items-center gap-4">
          <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
            <span>© 2026 文件共享服务</span>
            <div className="w-1 h-1 rounded-full bg-slate-300"></div>
            <button
              onClick={onAdminAuth}
              className="font-medium hover:text-[#2a4a82] transition-colors"
            >
              管理后台
            </button>
          </div>
        </div>      </div>
    </main>
  );
};

export default SetupScreen;