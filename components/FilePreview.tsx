import React, { useState, useEffect } from 'react';
import type { DriveItem } from '../types';
import Spinner from './Spinner';

interface FilePreviewProps {
  file: DriveItem;
  isMobile: boolean;
  onClose: () => void;
  onDownload: () => void;
  onCopyLink: () => void;
  formatBytes: (bytes: number) => string;
}

const FilePreview: React.FC<FilePreviewProps> = ({
  file,
  isMobile,
  onClose,
  onDownload,
  onCopyLink,
  formatBytes
}) => {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isTextLoading, setIsTextLoading] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  
  const downloadUrl = file['@microsoft.graph.downloadUrl'] || '';
  
  // 获取最佳可用预览图
  const getPreviewUrl = () => {
    if (file.thumbnails && file.thumbnails.length > 0) {
      // 优先使用大尺寸缩略图，比原图小但清晰度够
      return file.thumbnails[0].large?.url || file.thumbnails[0].medium?.url || downloadUrl;
    }
    return downloadUrl;
  };

  const isTextFile = file.name.toLowerCase().endsWith('.txt') || 
                     file.name.toLowerCase().endsWith('.md') || 
                     file.name.toLowerCase().endsWith('.js') || 
                     file.name.toLowerCase().endsWith('.json') ||
                     file.name.toLowerCase().endsWith('.css');

  useEffect(() => {
    if (isTextFile && downloadUrl) {
      setIsTextLoading(true);
      setTextContent(null);
      fetch(downloadUrl)
        .then(res => res.text())
        .then(text => {
          setTextContent(text);
          setIsTextLoading(false);
        })
        .catch(() => {
          setTextContent("加载文本内容失败。");
          setIsTextLoading(false);
        });
    }
  }, [downloadUrl, isTextFile]);

  const renderPreviewContent = () => {
    if (file.file?.mimeType?.startsWith('image/')) {
      const previewUrl = getPreviewUrl();
      return (
        <div className="relative group w-full h-full flex items-center justify-center p-2 md:p-4">
          <div className="absolute -inset-10 bg-gradient-to-tr from-[#2a4a82]/5 to-blue-400/5 rounded-full blur-3xl opacity-30"></div>
          
          {/* 背景模糊占位 */}
          {!imgLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner />
            </div>
          )}

          <img
            src={previewUrl}
            alt={file.name}
            onLoad={() => setImgLoaded(true)}
            className={`max-w-full max-h-full object-contain rounded-xl shadow-2xl ring-1 ring-black/5 bg-white dark:bg-slate-800 transition-opacity duration-700 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
          
          {/* 查看原图提示（如果当前是缩略图） */}
          {imgLoaded && previewUrl !== downloadUrl && (
            <div className="absolute bottom-4 right-4 group-hover:opacity-100 opacity-0 transition-opacity">
              <a 
                href={downloadUrl} 
                target="_blank" 
                rel="noreferrer"
                className="px-3 py-1.5 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold rounded-lg hover:bg-black/80 transition-all flex items-center gap-1.5"
              >
                <span className="material-icons-outlined text-sm">fullscreen</span>
                查看原图
              </a>
            </div>
          )}
        </div>
      );
    }

    if (file.file?.mimeType?.startsWith('video/')) {
      return (
        <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-black w-full max-w-4xl aspect-video ring-1 ring-white/10 mx-auto">
          <video
            src={downloadUrl}
            controls
            className="w-full h-full"
            autoPlay={false}
            preload="metadata"
            playsInline
          />
        </div>
      );
    }

    const officeExtensions = ['.docx', '.xlsx', '.pptx', '.doc', '.xls', '.ppt'];
    const isPDF = file.file?.mimeType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    
    if (isPDF) {
      return (
        <div className="w-full h-full max-w-5xl flex flex-col bg-white rounded-2xl shadow-lg overflow-hidden ring-1 ring-black/5 mx-auto">
          <iframe
            src={`/api/proxy.php?fileId=${encodeURIComponent(file.id)}`}
            className="w-full h-full border-none bg-white"
            title={file.name}
          />
          <div className="bg-slate-50 dark:bg-slate-800 px-4 py-2 border-t border-slate-100 dark:border-slate-700 flex justify-center items-center gap-2">
            <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest text-emerald-600 dark:text-emerald-400">PDF Browser Preview (Domestic Optimized)</span>
          </div>
        </div>
      );
    }

    if (officeExtensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
      return (
        <div className="w-full h-full max-w-5xl flex flex-col bg-white rounded-2xl shadow-lg overflow-hidden ring-1 ring-black/5 mx-auto">
          <iframe
            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(downloadUrl)}`}
            className="flex-1 w-full border-none bg-white"
            title={file.name}
          />
          <div className="bg-slate-50 dark:bg-slate-800 px-4 py-2 border-t border-slate-100 dark:border-slate-700 flex justify-center items-center gap-2">
            <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Office Online</span>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-500 max-w-md mx-auto">
        <div className="p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl mb-6">
          <span className="material-icons-outlined text-5xl text-slate-300 dark:text-slate-600">insert_drive_file</span>
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">暂不支持在线预览</h3>
        <p className="text-xs text-slate-400 max-w-[200px] leading-relaxed mb-8">此文件格式过于特殊，建议您下载后使用专业软件查看。</p>
        <button
          onClick={onDownload}
          className="h-11 px-8 bg-[#2a4a82] text-white text-xs font-bold rounded-xl shadow-sm hover:bg-[#1e3660] transition-all active:scale-95"
        >
          立即获取文件
        </button>
      </div>
    );
  };

  return (
    <main className={`${isMobile 
      ? 'fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-slate-950 animate-in slide-in-from-right duration-300 ease-out' 
      : 'hidden flex-1 flex-col bg-slate-50/50 dark:bg-slate-900/50 md:flex relative overflow-hidden'}`}>
      
      {isMobile && (
        <header className="flex h-14 items-center px-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-20 flex-shrink-0">
          <button onClick={onClose} className="p-2 -ml-2 text-slate-500 hover:text-[#2a4a82] active:scale-95 transition-all">
            <span className="material-icons-outlined text-xl font-bold">arrow_back_ios_new</span>
          </button>
          <div className="flex-1 min-w-0 px-2 text-center">
            <h2 className="text-[13px] font-bold truncate text-slate-900 dark:text-white leading-tight">{file.name}</h2>
          </div>
          <div className="w-8"></div>
        </header>
      )}

      {/* TOP: Preview Area - Takes all remaining space, scrollable if needed */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="w-full h-full relative flex items-center justify-center">
          {renderPreviewContent()}
        </div>
      </div>

      {/* BOTTOM: Info Card - Fixed at bottom */}
      <div className="flex-shrink-0 p-4 md:p-8 md:pt-0 z-10 w-full max-w-5xl mx-auto">
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-800 p-6 md:p-8 flex flex-col gap-6 transition-all hover:shadow-[0_8px_40px_rgb(0,0,0,0.08)]">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1.5 min-w-0 flex-1">
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white truncate tracking-tight" title={file.name}>
                {file.name}
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded uppercase tracking-wider">ID: {file.id.substring(0, 8)}</span>
                <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Safe Link</span>
              </div>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto">
              <button
                onClick={onCopyLink}
                className="flex-1 md:flex-none h-11 px-5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[13px] font-bold rounded-xl transition-all active:scale-95"
              >
                复制链接
              </button>
              <button
                onClick={onDownload}
                className="flex-1 md:flex-none h-11 px-8 bg-[#2a4a82] hover:bg-[#1e3660] text-white text-[13px] font-bold rounded-xl shadow-sm transition-all active:scale-95"
              >
                下载文件
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <div className="flex flex-col gap-1 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Format</span>
              <span className="text-xs font-bold text-slate-700 dark:text-white truncate">
                {file.file?.mimeType?.split('/')[1]?.toUpperCase() || 'FILE'}
              </span>
            </div>
            <div className="flex flex-col gap-1 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Weight</span>
              <span className="text-xs font-bold text-slate-700 dark:text-white">
                {formatBytes(file.size)}
              </span>
            </div>
            <div className="col-span-2 flex flex-col gap-1 p-3.5 rounded-2xl bg-[#eff4fa] dark:bg-[#1e3660]/20 border border-[#2a4a82]/10">
              <span className="text-[9px] font-bold text-[#2a4a82] dark:text-blue-400 uppercase tracking-widest">Encrypted Status</span>
              <div className="flex items-center gap-2.5 text-xs font-bold text-[#2a4a82] dark:text-blue-400">
                 <div className="relative flex h-2 w-2">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2a4a82] opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2a4a82]"></span>
                 </div>
                 TLS 1.3 SECURED
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default FilePreview;