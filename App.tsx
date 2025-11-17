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
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [hasFetched, setHasFetched] = useState(false);
  const [fetchingLinkFor, setFetchingLinkFor] = useState<string | null>(null);

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
    <div className="w-full max-w-2xl mx-auto">
      <header className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-800 dark:text-gray-200">
          文件共享
        </h1>
        <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
          输入取件码以查看文件。
        </p>
      </header>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
        <div className="space-y-4">
          <div>
            <label htmlFor="itemId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              取件码
            </label>
            <input
              id="itemId"
              type="text"
              value={itemId}
              onChange={(e) => {
                setItemId(e.target.value);
                localStorage.setItem('file_share_code', e.target.value);
              }}
              placeholder="请输入取件码"
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none bg-gray-50 dark:bg-gray-700"
              disabled={isLoading}
            />
          </div>
        </div>
        <button
          onClick={handleFetchFiles}
          disabled={isLoading || !itemId}
          className="mt-5 w-full flex justify-center items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed dark:disabled:bg-blue-800 transition-colors duration-200"
        >
          {isLoading ? <><Spinner /> <span>正在获取...</span></> : '获取文件'}
        </button>
        {error && (
          <div className="mt-4 bg-red-100 dark:bg-red-900/50 border-l-4 border-red-500 text-red-700 dark:text-red-200 p-4 rounded-md" role="alert">
            <p className="font-bold">错误</p><p>{error}</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderFileBrowser = () => (
    <div className="h-screen w-screen flex flex-col">
      {/* 隐藏的文件输入框 */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={isUploading}
      />

       <header className="sticky top-0 z-20 bg-white dark:bg-gray-800/80 backdrop-blur-md shadow-sm p-3 flex items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-700">
        <button onClick={() => setHasFetched(false)} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-sm font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
          返回
        </button>
        {/* 新增上传按钮 */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="px-4 py-2 bg-green-500 text-white text-sm font-semibold rounded-md hover:bg-green-600 disabled:bg-green-300 disabled:cursor-wait transition-colors"
        >
          上传文件
        </button>
         <div className="flex items-center gap-2 p-1 bg-gray-200 dark:bg-gray-700 rounded-lg">
           <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-white dark:bg-gray-900 text-blue-600' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`} aria-label="List view">
             <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M3 5a1 1 0 000 2h14a1 1 0 100-2H3zm0 4a1 1 0 000 2h14a1 1 0 100-2H3zm0 4a1 1 0 000 2h14a1 1 0 100-2H3z"/></svg>
           </button>
           <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md ${viewMode === 'grid' ? 'bg-white dark:bg-gray-900 text-blue-600' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`} aria-label="Grid view">
             <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zm8-8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2h-2zm0 8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2h-2z"/></svg>
           </button>
         </div>
      </header>
      <main className="flex-grow overflow-y-auto p-4 sm:p-6">
        {/* 新增上传进度条 */}
        {isUploading && (
          <div className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <p className="text-sm font-medium mb-1 truncate">正在上传: {uploadingFileName}</p>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
            </div>
            <p className="text-right text-xs mt-1 font-mono">{uploadProgress}%</p>
          </div>
        )}
        {files.length === 0 && !isLoading && (
          <div className="text-center text-gray-500 dark:text-gray-400 pt-16"><p>此文件夹为空。</p></div>
        )}
        {viewMode === 'list' ? (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800 shadow-md rounded-lg">
            {files.map((item) => (
              <li key={item.id} className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150 gap-3">
                <div className="flex items-center gap-3 w-2/3 truncate">
                  <FileTypeIcon item={item} view="list" />
                  <span className="font-medium truncate" title={item.name}>{item.name}</span>
                </div>
                <div className="flex items-center gap-4 w-1/3 justify-end">
                  <span className="text-sm text-gray-500 dark:text-gray-400 min-w-[80px] text-right">{item.folder ? '—' : formatBytes(item.size)}</span>
                  {item.folder ? (
                    <span className="px-3 py-1.5 text-xs text-gray-400">文件夹</span>
                  ) : item['@microsoft.graph.downloadUrl'] ? (
                    <a href={item['@microsoft.graph.downloadUrl']} download className="px-3 py-1.5 bg-blue-500 text-white text-xs font-semibold rounded-md hover:bg-blue-600">下载</a>
                  ) : (
                    <button 
                      onClick={() => handleGetDownloadLink(item.id)}
                      disabled={fetchingLinkFor === item.id}
                      className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-wait"
                    >
                      {fetchingLinkFor === item.id ? '获取中...' : '获取链接'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
            {files.map((item) => (
              <div key={item.id} className="relative group bg-white dark:bg-gray-800 rounded-md shadow-md hover:shadow-lg transition-shadow duration-200 flex flex-col">
                <FileTypeIcon item={item} view="grid" />
                <div className="p-2 text-center flex-grow flex flex-col justify-center">
                  <p className="text-sm truncate font-medium" title={item.name}>{item.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.folder ? '—' : formatBytes(item.size)}</p>
                </div>
                {item.folder ? null : item['@microsoft.graph.downloadUrl'] ? (
                  <a href={item['@microsoft.graph.downloadUrl']} download className="absolute top-2 right-2 p-1.5 bg-blue-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-700" aria-label="Download">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                  </a>
                ) : (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-md">
                     <button 
                      onClick={() => handleGetDownloadLink(item.id)}
                      disabled={fetchingLinkFor === item.id}
                      className="px-3 py-1.5 bg-white text-gray-800 text-xs font-bold rounded-md hover:bg-gray-200 disabled:opacity-75 disabled:cursor-wait"
                    >
                      {fetchingLinkFor === item.id ? '获取中...' : '获取链接'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );

  return (
    <div className={`min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 ${!hasFetched && 'flex flex-col items-center justify-center p-4'}`}>
      {hasFetched ? renderFileBrowser() : renderSetupScreen()}
    </div>
  );
};

export default App;