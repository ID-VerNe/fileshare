import React from 'react';
import type { DriveItem, BreadcrumbItem } from '../types';

interface FileBrowserProps {
  files: DriveItem[];
  displayedFiles: DriveItem[];
  selectedFile: DriveItem | null;
  onFileSelect: (file: DriveItem) => void;
  onFolderDoubleClick: (folder: DriveItem) => void;
  isLoading: boolean;
  searchQuery: string;
  isUploading: boolean;
  uploadProgress: number;
  uploadingFileName: string | null;
  folderPath: BreadcrumbItem[];
  onBreadcrumbClick: (index: number) => void;
  formatBytes: (bytes: number) => string;
  isMobile: boolean;
}

const FileBrowser: React.FC<FileBrowserProps> = ({
  displayedFiles,
  selectedFile,
  onFileSelect,
  onFolderDoubleClick,
  isLoading,
  searchQuery,
  isUploading,
  uploadProgress,
  uploadingFileName,
  folderPath,
  onBreadcrumbClick,
  formatBytes,
  isMobile
}) => {
  return (
    <aside className={`w-full flex-shrink-0 border-r border-slate-200 dark:border-slate-800 md:w-80 lg:w-[320px] transition-transform duration-300 ease-in-out ${selectedFile && isMobile ? '-translate-x-full absolute h-full z-0' : 'translate-x-0 relative z-10'}`}>
      <div className="flex h-full flex-col bg-slate-50/50 dark:bg-slate-900/50">
        
        {/* Upload Progress */}
        {isUploading && (
          <div className="flex-shrink-0 border-b border-slate-200 dark:border-slate-800 p-4 bg-[#eff4fa] dark:bg-[#1e3660]/20 animate-in slide-in-from-top duration-300">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#2a4a82] dark:text-blue-400 flex items-center gap-1.5">
                  <span className="material-icons-outlined animate-spin text-[16px]">sync</span>
                  Uploading...
                </h3>
                <span className="text-[10px] font-bold text-[#2a4a82] bg-white px-2 py-0.5 rounded-md shadow-sm">{uploadProgress}%</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="truncate text-[11px] font-medium text-slate-600 dark:text-slate-300">{uploadingFileName}</p>
                <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="h-full bg-[#2a4a82] transition-all duration-300 ease-out" style={{ width: `${uploadProgress}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Breadcrumbs - Clean White Background */}
        <div className="flex-shrink-0 px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center h-12">
          <div className="flex items-center gap-1 text-[11px] font-medium overflow-x-auto no-scrollbar">
            <button
              onClick={() => onBreadcrumbClick(-1)}
              className={`flex items-center gap-1 transition-colors px-2 py-1.5 rounded-lg whitespace-nowrap ${folderPath.length === 0
                ? 'text-[#2a4a82] bg-[#eff4fa] dark:bg-[#1e3660]/30'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
            >
              <span className="material-icons-outlined text-[14px]">home</span>
              <span>Home</span>
            </button>
            {folderPath.map((item, index) => (
              <React.Fragment key={item.id}>
                <span className="text-slate-300 dark:text-slate-600">/</span>
                <button
                  onClick={() => onBreadcrumbClick(index)}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors whitespace-nowrap ${index === folderPath.length - 1
                    ? 'text-[#2a4a82] bg-[#eff4fa] dark:bg-[#1e3660]/30'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                >
                  <span>{item.name}</span>
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* List Refinement */}
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar bg-white dark:bg-slate-900">
          {displayedFiles.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 animate-in fade-in duration-500 opacity-60">
              <span className="material-icons-outlined text-4xl text-slate-300 dark:text-slate-600 mb-3">inventory_2</span>
              <p className="text-[13px] font-medium text-slate-600 dark:text-slate-400">{searchQuery ? 'No results found' : 'Folder is empty'}</p>
            </div>
          )}

          <ul className="flex flex-col gap-0.5">
            {displayedFiles.map((item) => (
              <li key={item.id}>
                <div
                  className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-all duration-200 border border-transparent cursor-pointer group ${selectedFile?.id === item.id
                    ? 'bg-[#eff4fa] dark:bg-[#1e3660]/30 text-[#2a4a82] dark:text-white'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                    }`}
                  onClick={() => item.folder ? onFolderDoubleClick(item) : onFileSelect(item)}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    {item.folder ? (
                      <span className="material-icons-outlined text-[20px] text-[#2a4a82] opacity-80">folder</span>
                    ) : (
                      <span className={`material-icons-outlined text-[20px] opacity-60 ${
                        item.file?.mimeType?.includes('image') ? 'text-indigo-500' :
                        item.file?.mimeType?.includes('video') ? 'text-rose-500' :
                        item.file?.mimeType?.includes('pdf') ? 'text-orange-500' : 'text-slate-500'
                      }`}>
                        {item.file?.mimeType?.includes('image') ? 'image' :
                         item.file?.mimeType?.includes('video') ? 'movie' :
                         item.file?.mimeType?.includes('pdf') ? 'picture_as_pdf' : 'description'}
                      </span>
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className={`truncate font-medium text-[13px] tracking-tight ${selectedFile?.id === item.id ? 'font-semibold' : ''}`}>{item.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 hidden md:block">
                      {item.folder ? '' : formatBytes(item.size)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
};

export default FileBrowser;