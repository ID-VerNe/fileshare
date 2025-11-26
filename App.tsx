import React, { useState, useCallback, useRef } from 'react';
import type { DriveItem } from './types';
import { fetchFilesFromBackend, fetchSingleFile } from './services/graphService';
import { createUploadSession, uploadFileToSession } from './services/uploadService';
import Spinner from './components/Spinner';
import FileTypeIcon from './components/FileIcon';

const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const App: React.FC = () => {
  const [itemId, setItemId] = useState(() => localStorage.getItem('file_share_code') || '');
  const [files, setFiles] = useState<DriveItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [fetchingLinkFor, setFetchingLinkFor] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<DriveItem | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFetchFiles = useCallback(async () => {
    if (!itemId) {
      setError('请输入取件码。');
      return;
    }
    setIsLoading(true);
    setError(null);
    setFiles([]);
    setHasFetched(true);

    try {
      const fetchedFiles = await fetchFilesFromBackend(itemId);
      setFiles(fetchedFiles);
    } catch (err: any) {
      setError(err.message || '发生未知错误。');
    } finally {
      setIsLoading(false);
    }
  }, [itemId]);
  
  const handleGetDownloadLink = useCallback(async (fileId: string) => {
    if (fetchingLinkFor) return;
    setFetchingLinkFor(fileId);
    setError(null);

    try {
      const updatedFile = await fetchSingleFile(fileId);
      setFiles(currentFiles =>
        currentFiles.map(f => (f.id === fileId ? { ...f, ...updatedFile } : f))
      );
    } catch (err: any) {
      setError(err.message || '获取下载链接失败。');
    } finally {
      setFetchingLinkFor(null);
    }
  }, [fetchingLinkFor]);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
  
    setIsUploading(true);
    setUploadProgress(0);
    setUploadingFileName(file.name);
    setError(null);
  
    try {
      // 第一步：从我们的后端获取上传 URL
      const uploadUrl = await createUploadSession(itemId, file.name);
  
      // 第二步：将文件上传到获取到的 URL，并更新进度
      await uploadFileToSession(uploadUrl, file, (progress) => {
        setUploadProgress(progress);
      });
      
      // 上传成功后，刷新文件列表
      await handleFetchFiles();
  
    } catch (err: any) {
      setError(err.message || '上传失败，请重试。');
    } finally {
      // 清理状态
      setIsUploading(false);
      setUploadProgress(0);
      setUploadingFileName(null);
      // 重置 input 的值，以便用户可以再次上传同一个文件
      if (event.target) {
        event.target.value = '';
      }
    }
  }, [itemId, handleFetchFiles]); // 依赖项中加入 itemId 和 handleFetchFiles

  const renderSetupScreen = () => (
    <main className="flex-grow flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-800 dark:text-slate-100">文件共享</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">输入取件码以查看文件。</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-lg">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="itemId">取件码</label>
              <div className="mt-1">
                <input
                  id="itemId"
                  type="text"
                  value={itemId}
                  onChange={(e) => {
                    setItemId(e.target.value);
                    localStorage.setItem('file_share_code', e.target.value);
                  }}
                  placeholder="请输入取件码"
                  className="block w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-200"
                  disabled={isLoading}
                />
              </div>
            </div>
            <div>
              <button
                onClick={handleFetchFiles}
                disabled={isLoading || !itemId}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
              >
                {isLoading ? <><Spinner /> <span>正在获取...</span></> : '获取文件'}
              </button>
            </div>
          </div>
          {error && (
            <div className="mt-4 bg-red-100 dark:bg-red-900/50 border-l-4 border-red-500 text-red-700 dark:text-red-200 p-4 rounded-md" role="alert">
              <p className="font-bold">错误</p><p>{error}</p>
            </div>
          )}
        </div>
        <div className="mt-8 text-center text-xs text-slate-500 dark:text-slate-400">
          <p>这是一个文件共享服务。输入您的唯一代码即可访问文件。</p>
          <p className="mt-1">© 2024 文件共享服务。保留所有权利。</p>
        </div>
      </div>
    </main>
  );

  // 自动获取选中文件的下载链接
  const handleFilePreviewSelect = useCallback(async (file: DriveItem) => {
    setSelectedFile(file);
    // 如果文件没有下载链接，自动获取
    if (file.file && !file['@microsoft.graph.downloadUrl']) {
      try {
        setFetchingLinkFor(file.id);
        const updatedFile = await fetchSingleFile(file.id);
        // 合并更新，保留原有文件信息
        const mergedFile = { ...file, ...updatedFile };
        setFiles(currentFiles =>
          currentFiles.map(f => (f.id === file.id ? mergedFile : f))
        );
        setSelectedFile(mergedFile);
      } catch (err: any) {
        setError(err.message || '获取文件链接失败。');
      } finally {
        setFetchingLinkFor(null);
      }
    }
  }, [fetchSingleFile]);

  const renderFileBrowser = () => (
    <div className="h-screen w-full flex flex-col">
      {/* 隐藏的文件输入框 */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={isUploading}
      />

      <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-surface-light dark:border-surface-dark bg-background-light dark:bg-background-dark px-4 md:px-6">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setHasFetched(false)} 
            className="flex items-center justify-center rounded-full p-2 hover:bg-surface-light dark:hover:bg-surface-dark"
          >
            <span className="material-icons-outlined text-text-light-subtle dark:text-text-dark-subtle">arrow_back_ios_new</span>
          </button>
          <h1 className="text-lg font-semibold text-text-light-base dark:text-text-dark-base">文件</h1>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
          >
            <span className="material-icons-outlined text-base">upload_file</span>
            <span>上传文件</span>
          </button>
        </div>
      </header>
      
      {/* 三栏布局 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧：文件列表 */}
        <aside className="w-full flex-shrink-0 border-r border-surface-light dark:border-surface-dark md:w-1/3 lg:w-1/4">
          <div className="flex h-full flex-col">
            {/* 新增上传进度条 */}
            {isUploading && (
              <div className="flex-shrink-0 border-b border-surface-light dark:border-surface-dark p-4">
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-text-light-base dark:text-text-dark-base">上传中</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <p className="truncate text-text-light-subtle dark:text-text-dark-subtle">{uploadingFileName}</p>
                      <span className="text-text-light-base dark:text-text-dark-base">{uploadProgress}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-light dark:bg-surface-dark">
                      <div className="h-full bg-primary" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex-1 overflow-y-auto p-2">
              {files.length === 0 && !isLoading && (
                <div className="text-center text-text-light-subtle dark:text-text-dark-subtle pt-16"><p>此文件夹为空。</p></div>
              )}
              
              <ul className="space-y-1">
                {files.map((item) => (
                  <li 
                    key={item.id} 
                    className={`${selectedFile?.id === item.id ? 'bg-primary/10 rounded-lg' : ''}`}
                  >
                    <div 
                      className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm ${selectedFile?.id === item.id ? 'text-primary font-medium' : 'text-text-light-base dark:text-text-dark-base hover:bg-surface-light dark:hover:bg-surface-dark'}`}
                      onClick={() => handleFilePreviewSelect(item)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {item.folder ? (
                          <span className="material-icons-outlined text-text-light-subtle dark:text-text-dark-subtle flex-shrink-0">folder</span>
                        ) : item.file?.mimeType?.startsWith('image/') ? (
                          <span className="material-icons-outlined text-text-light-subtle dark:text-text-dark-subtle flex-shrink-0">image</span>
                        ) : item.file?.mimeType?.startsWith('video/') ? (
                          <span className="material-icons-outlined text-text-light-subtle dark:text-text-dark-subtle flex-shrink-0">videocam</span>
                        ) : item.file?.mimeType?.includes('pdf') ? (
                          <span className="material-icons-outlined text-text-light-subtle dark:text-text-dark-subtle flex-shrink-0">picture_as_pdf</span>
                        ) : (
                          <span className="material-icons-outlined text-text-light-subtle dark:text-text-dark-subtle flex-shrink-0">description</span>
                        )}
                        <span className="truncate max-w-[180px] md:max-w-[240px] lg:max-w-[320px]" title={item.name}>{item.name}</span>
                      </div>
                      <span className="text-xs text-text-light-subtle dark:text-text-dark-subtle whitespace-nowrap">{item.folder ? '—' : formatBytes(item.size)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>
        
        {/* 右侧：文件详情和预览 */}
        {selectedFile ? (
          <main className="hidden flex-1 flex-col bg-surface-light dark:bg-surface-dark md:flex">
            {/* 预览区域 */}
            <div className="flex-shrink-0 max-h-[60vh] overflow-hidden">
              <div className="relative flex h-full items-center justify-center p-4 lg:p-8">
                {selectedFile.file?.mimeType?.startsWith('image/') ? (
                  <img 
                    src={selectedFile['@microsoft.graph.downloadUrl']} 
                    alt={selectedFile.name} 
                    className="max-h-full max-w-full object-contain" 
                  />
                ) : selectedFile.file?.mimeType?.startsWith('video/') ? (
                  <video 
                    src={selectedFile['@microsoft.graph.downloadUrl']} 
                    controls 
                    className="max-w-full max-h-full"
                    autoPlay={false}
                    preload="metadata"
                    playsInline
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-center">
                    {selectedFile.folder ? (
                      <span className="material-icons-outlined mb-4 text-6xl text-text-light-subtle dark:text-text-dark-subtle opacity-50">folder</span>
                    ) : selectedFile.file?.mimeType?.includes('pdf') ? (
                      <span className="material-icons-outlined mb-4 text-6xl text-text-light-subtle dark:text-text-dark-subtle opacity-50">picture_as_pdf</span>
                    ) : (
                      <span className="material-icons-outlined mb-4 text-6xl text-text-light-subtle dark:text-text-dark-subtle opacity-50">description</span>
                    )}
                    <h3 className="text-lg font-medium text-text-light-base dark:text-text-dark-base">{selectedFile.folder ? '文件夹' : '不支持此文件类型的预览'}</h3>
                    <p className="mt-1 text-sm text-text-light-subtle dark:text-text-dark-subtle">{selectedFile.folder ? '选择文件夹以查看其内容' : '从列表中选择一个文件以查看其详细信息和预览'}</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* 文件详情 */}
            <div className="flex-1 overflow-y-auto border-t border-background-light dark:border-background-dark p-6">
              <div className="flex items-start justify-between">
                <h2 className="mb-4 text-lg font-semibold text-text-light-base dark:text-text-dark-base break-all">{selectedFile.name}</h2>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-light-subtle dark:text-text-dark-subtle">类型</span>
                  <span className="text-text-light-base dark:text-text-dark-base">{selectedFile.file?.mimeType || '文件夹'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-light-subtle dark:text-text-dark-subtle">大小</span>
                  <span className="text-text-light-base dark:text-text-dark-base">{selectedFile.folder ? '—' : formatBytes(selectedFile.size)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-light-subtle dark:text-text-dark-subtle">ID</span>
                  <span className="truncate text-text-light-base dark:text-text-dark-base">{selectedFile.id}</span>
                </div>
                {selectedFile.file?.mimeType && (
                  <div className="flex justify-between">
                    <span className="text-text-light-subtle dark:text-text-dark-subtle">MIME 类型</span>
                    <span className="text-text-light-base dark:text-text-dark-base">{selectedFile.file.mimeType}</span>
                  </div>
                )}
                {selectedFile['@microsoft.graph.downloadUrl'] && (
                  <div className="mt-6">
                    <a 
                      href={selectedFile['@microsoft.graph.downloadUrl']} 
                      download 
                      className="w-full inline-flex justify-center items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      <span className="material-icons-outlined text-base">download</span>
                      下载文件
                    </a>
                  </div>
                )}
              </div>
            </div>
          </main>
        ) : (
          <main className="hidden flex-1 flex-col bg-surface-light dark:bg-surface-dark md:flex">
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
              <span className="material-icons-outlined mb-4 text-6xl text-text-light-subtle dark:text-text-dark-subtle opacity-50">select_all</span>
              <h3 className="text-lg font-medium text-text-light-base dark:text-text-dark-base">选择文件</h3>
              <p className="mt-1 text-sm text-text-light-subtle dark:text-text-dark-subtle">从列表中选择一个文件以查看其详细信息和预览。</p>
            </div>
          </main>
        )}
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen ${!hasFetched && 'flex flex-col'}`}>
      {hasFetched ? renderFileBrowser() : renderSetupScreen()}
    </div>
  );
};

export default App;