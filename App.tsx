import React, { useState, useCallback, useRef, useMemo } from 'react';
import type { DriveItem, BreadcrumbItem } from './types';
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

  // 新增：排序、搜索和导航状态
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'type'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [folderPath, setFolderPath] = useState<BreadcrumbItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [uploadAllowed, setUploadAllowed] = useState(false);

  const handleFetchFiles = useCallback(async (folderId?: string | any) => {
    // 如果 folderId 是事件对象（React SyntheticEvent）或不是字符串，则使用 itemId
    const targetId = (typeof folderId === 'string' ? folderId : itemId);

    if (!targetId) {
      setError('请输入取件码。');
      return;
    }
    setIsLoading(true);
    setError(null);
    setFiles([]);
    setHasFetched(true);

    try {
      const fetchedFiles = await fetchFilesFromBackend(targetId);

      // 判断是否在根目录：如果 folderId 不是字符串（事件对象或 undefined）且 folderPath 为空
      const isRootDirectory = typeof folderId !== 'string' && folderPath.length === 0;

      // 在根目录检测 allowupload 文件
      if (isRootDirectory) {
        const hasAllowUpload = fetchedFiles.some(file => file.name === 'allowupload');
        setUploadAllowed(hasAllowUpload);
      }

      // 过滤掉 allowupload 文件，不显示在列表中
      const filteredFiles = fetchedFiles.filter(file => file.name !== 'allowupload');
      setFiles(filteredFiles);
      setSelectedFile(null);
    } catch (err: any) {
      setError(err.message || '发生未知错误。');
    } finally {
      setIsLoading(false);
    }
  }, [itemId, folderPath]);

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

  // 新增：文件夹双击处理 - 进入子文件夹
  const handleFolderDoubleClick = useCallback(async (folder: DriveItem) => {
    if (!folder.folder) return;

    setIsLoading(true);
    setError(null);
    setSelectedFile(null);

    try {
      const fetchedFiles = await fetchFilesFromBackend(folder.id);
      setFiles(fetchedFiles);
      // 更新面包屑路径
      setFolderPath(prev => [...prev, { id: folder.id, name: folder.name }]);
      setCurrentFolderId(folder.id);
    } catch (err: any) {
      setError(err.message || '无法打开文件夹。');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 新增：面包屑导航点击处理
  const handleBreadcrumbClick = useCallback(async (index: number) => {
    // index === -1 表示返回根目录
    if (index === -1) {
      setFolderPath([]);
      setCurrentFolderId('');
      await handleFetchFiles();
      return;
    }

    // 点击面包屑中的某一层
    const targetBreadcrumb = folderPath[index];
    setIsLoading(true);
    setError(null);
    setSelectedFile(null);

    try {
      const fetchedFiles = await fetchFilesFromBackend(targetBreadcrumb.id);
      setFiles(fetchedFiles);
      // 截断路径到点击的层级
      setFolderPath(prev => prev.slice(0, index + 1));
      setCurrentFolderId(targetBreadcrumb.id);
    } catch (err: any) {
      setError(err.message || '无法返回文件夹。');
    } finally {
      setIsLoading(false);
    }
  }, [folderPath, handleFetchFiles]);

  // 新增：排序函数
  const getSortedFiles = useCallback((fileList: DriveItem[]) => {
    const sorted = [...fileList].sort((a, b) => {
      // 文件夹始终排在前面
      if (a.folder && !b.folder) return -1;
      if (!a.folder && b.folder) return 1;

      let compareValue = 0;
      if (sortBy === 'name') {
        compareValue = a.name.localeCompare(b.name, 'zh-CN');
      } else if (sortBy === 'size') {
        compareValue = a.size - b.size;
      } else if (sortBy === 'type') {
        const typeA = a.folder ? 'folder' : (a.file?.mimeType || '');
        const typeB = b.folder ? 'folder' : (b.file?.mimeType || '');
        compareValue = typeA.localeCompare(typeB);
        // 同类型按名称排序
        if (compareValue === 0) {
          compareValue = a.name.localeCompare(b.name, 'zh-CN');
        }
      }

      return sortOrder === 'asc' ? compareValue : -compareValue;
    });
    return sorted;
  }, [sortBy, sortOrder]);

  // 新增：搜索过滤函数
  const getFilteredFiles = useCallback((fileList: DriveItem[]) => {
    if (!searchQuery.trim()) return fileList;
    const query = searchQuery.toLowerCase();
    return fileList.filter(file => file.name.toLowerCase().includes(query));
  }, [searchQuery]);

  // 组合排序和过滤
  const displayedFiles = useMemo(() => {
    const filtered = getFilteredFiles(files);
    return getSortedFiles(filtered);
  }, [files, getFilteredFiles, getSortedFiles]);

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

      <header className="flex h-18 flex-shrink-0 items-center justify-between border-b border-surface-light/60 dark:border-surface-dark/60 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm px-6 transition-all duration-200 z-10">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => {
              setHasFetched(false);
              setFolderPath([]);
              setCurrentFolderId('');
              setSearchQuery('');
            }}
            className="flex items-center justify-center rounded-full p-2.5 text-text-light-subtle hover:bg-surface-light dark:hover:bg-surface-dark hover:text-primary transition-all duration-200"
            title="返回首页"
          >
            <span className="material-icons-outlined">arrow_back_ios_new</span>
          </button>
          <h1 className="text-xl font-bold text-text-light-base dark:text-text-dark-base tracking-tight">文件</h1>
        </div>
        <div className="flex items-center space-x-3">
          {/* 搜索框 */}
          <div className="relative group">
            <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-light-subtle group-focus-within:text-primary transition-colors duration-200 text-xl">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索文件..."
              className="pl-10 pr-4 py-2.5 w-64 border-none rounded-xl text-sm bg-surface-light/50 dark:bg-surface-dark/50 text-slate-900 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-surface-light dark:focus:bg-surface-dark shadow-sm transition-all duration-200"
            />
          </div>

          {/* 排序控制 */}
          <div className="flex items-center bg-surface-light/50 dark:bg-surface-dark/50 rounded-xl p-1 shadow-sm border border-transparent hover:border-surface-light dark:hover:border-surface-dark transition-all duration-200">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'size' | 'type')}
              className="pl-3 pr-8 py-1.5 text-sm bg-transparent text-text-light-base dark:text-text-dark-base focus:outline-none border-none cursor-pointer font-medium"
            >
              <option value="name">名称</option>
              <option value="size">大小</option>
              <option value="type">类型</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="p-1.5 hover:bg-surface-light dark:hover:bg-surface-dark rounded-lg text-text-light-subtle hover:text-primary transition-all duration-200"
              title={sortOrder === 'asc' ? '升序' : '降序'}
            >
              <span className="material-icons-outlined text-lg">
                {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
              </span>
            </button>
          </div>

          {/* 仅在有上传权限时显示上传按钮 */}
          {uploadAllowed && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
            >
              <span className="material-icons-outlined text-lg">upload_file</span>
              <span>上传</span>
            </button>
          )}

          {/* 视图切换 */}
          <div className="flex bg-surface-light/50 dark:bg-surface-dark/50 rounded-xl p-1 shadow-sm border border-transparent hover:border-surface-light dark:hover:border-surface-dark transition-all duration-200">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all duration-200 ${viewMode === 'list'
                ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                : 'text-text-light-subtle hover:text-primary hover:bg-surface-light dark:hover:bg-surface-dark'
                }`}
              title="列表视图"
            >
              <span className="material-icons-outlined text-lg">view_list</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all duration-200 ${viewMode === 'grid'
                ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                : 'text-text-light-subtle hover:text-primary hover:bg-surface-light dark:hover:bg-surface-dark'
                }`}
              title="缩略图视图"
            >
              <span className="material-icons-outlined text-lg">grid_view</span>
            </button>
          </div>
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

            {/* 面包屑导航 - 始终显示 */}
            <div className="flex-shrink-0 px-6 py-3 bg-surface-light/30 dark:bg-surface-dark/30 backdrop-blur-sm border-b border-surface-light/50 dark:border-surface-dark/50">
              <div className="flex items-center gap-2 text-sm overflow-x-auto scrollbar-hide">
                <button
                  onClick={() => handleBreadcrumbClick(-1)}
                  className={`flex items-center gap-1 transition-colors px-2 py-1 rounded-md hover:bg-surface-light dark:hover:bg-surface-dark ${folderPath.length === 0
                    ? 'text-primary font-bold bg-primary/10'
                    : 'text-text-light-subtle hover:text-primary'
                    }`}
                >
                  <span className="material-icons-outlined text-lg">home</span>
                  <span>根目录</span>
                </button>
                {folderPath.map((item, index) => (
                  <React.Fragment key={item.id}>
                    <span className="material-icons-outlined text-text-light-subtle text-sm">chevron_right</span>
                    <button
                      onClick={() => handleBreadcrumbClick(index)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${index === folderPath.length - 1
                        ? 'text-primary font-bold bg-primary/10'
                        : 'text-text-light-subtle hover:text-primary hover:bg-surface-light dark:hover:bg-surface-dark'
                        }`}
                    >
                      {index === folderPath.length - 1 && <span className="material-icons-outlined text-lg">folder_open</span>}
                      <span className="whitespace-nowrap">{item.name}</span>
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {displayedFiles.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center h-64 text-text-light-subtle dark:text-text-dark-subtle">
                  <span className="material-icons-outlined text-6xl opacity-20 mb-4">folder_off</span>
                  <p className="text-lg font-medium">{searchQuery ? '没有找到匹配的文件' : '此文件夹为空'}</p>
                </div>
              )}

              {viewMode === 'list' ? (
                <ul className="space-y-2">
                  {displayedFiles.map((item) => (
                    <li
                      key={item.id}
                      className="group"
                    >
                      <div
                        className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm transition-all duration-200 border ${selectedFile?.id === item.id
                          ? 'bg-surface-light dark:bg-surface-dark border-primary/30 shadow-sm transform scale-[1.01]'
                          : 'border-transparent hover:bg-surface-light/60 dark:hover:bg-surface-dark/60 hover:shadow-sm text-text-light-base dark:text-text-dark-base'
                          } ${item.folder ? 'cursor-pointer' : 'cursor-default'
                          }`}
                        onClick={() => item.folder ? handleFolderDoubleClick(item) : handleFilePreviewSelect(item)}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          {item.folder ? (
                            <span className="material-icons-outlined text-2xl text-primary">folder</span>
                          ) : item.file?.mimeType?.includes('image') ? (
                            <span className="material-icons-outlined text-2xl text-purple-500">image</span>
                          ) : item.file?.mimeType?.includes('video') ? (
                            <span className="material-icons-outlined text-2xl text-red-500">movie</span>
                          ) : item.file?.mimeType?.includes('pdf') ? (
                            <span className="material-icons-outlined text-2xl text-red-500">picture_as_pdf</span>
                          ) : (
                            <span className="material-icons-outlined text-2xl text-text-light-subtle">description</span>
                          )}
                          <span className="truncate font-medium">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-6 text-xs text-text-light-subtle flex-shrink-0">
                          <span>{item.folder ? '-' : formatBytes(item.size)}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-2">
                  {displayedFiles.map((item) => (
                    <div
                      key={item.id}
                      className={`group relative flex flex-col rounded-xl p-3 transition-all duration-200 border cursor-pointer ${selectedFile?.id === item.id
                        ? 'bg-surface-light dark:bg-surface-dark border-primary/30 shadow-md ring-1 ring-primary/20'
                        : 'bg-white/40 dark:bg-slate-800/40 border-transparent hover:bg-surface-light/80 dark:hover:bg-surface-dark/80 hover:shadow-sm'
                        }`}
                      onClick={() => item.folder ? handleFolderDoubleClick(item) : handleFilePreviewSelect(item)}
                    >
                      <div className="aspect-square w-full rounded-lg overflow-hidden bg-surface-light dark:bg-surface-dark mb-3 flex items-center justify-center relative">
                        {item.thumbnails && item.thumbnails.length > 0 ? (
                          <img
                            src={item.thumbnails[0].medium?.url || item.thumbnails[0].small?.url}
                            alt={item.name}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="transform transition-transform duration-200 group-hover:scale-110">
                            {item.folder ? (
                              <span className="material-icons-outlined text-6xl text-primary/80">folder</span>
                            ) : item.file?.mimeType?.includes('image') ? (
                              <span className="material-icons-outlined text-6xl text-purple-500/80">image</span>
                            ) : item.file?.mimeType?.includes('video') ? (
                              <span className="material-icons-outlined text-6xl text-red-500/80">movie</span>
                            ) : item.file?.mimeType?.includes('pdf') ? (
                              <span className="material-icons-outlined text-6xl text-red-500/80">picture_as_pdf</span>
                            ) : (
                              <span className="material-icons-outlined text-6xl text-text-light-subtle/50">description</span>
                            )}
                          </div>
                        )}

                        {/* 选中指示器 */}
                        {selectedFile?.id === item.id && (
                          <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-sm">
                            <span className="material-icons-outlined text-white text-xs">check</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-0.5 px-1">
                        <span className="text-sm font-medium text-text-light-base dark:text-text-dark-base truncate" title={item.name}>
                          {item.name}
                        </span>
                        <span className="text-xs text-text-light-subtle">
                          {item.folder ? `${item.folder.childCount || 0} 项` : formatBytes(item.size)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* 右侧：文件详情和预览 */}
        {selectedFile ? (
          <main className="hidden flex-1 flex-col bg-surface-light/30 dark:bg-surface-dark/30 md:flex relative">
            {/* 背景装饰 */}
            <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-30 pointer-events-none"></div>

            {/* 预览区域 */}
            <div className="flex-1 flex items-center justify-center p-8 overflow-hidden relative z-10">
              <div className="relative max-w-full max-h-full flex flex-col items-center justify-center transition-all duration-300">
                {selectedFile.file?.mimeType?.startsWith('image/') ? (
                  <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary to-blue-400 rounded-2xl opacity-20 group-hover:opacity-40 blur transition duration-500"></div>
                    <img
                      src={selectedFile['@microsoft.graph.downloadUrl']}
                      alt={selectedFile.name}
                      className="relative max-h-[60vh] object-contain rounded-xl shadow-2xl ring-1 ring-black/5 bg-white"
                    />
                  </div>
                ) : selectedFile.file?.mimeType?.startsWith('video/') ? (
                  <div className="relative rounded-xl overflow-hidden shadow-2xl bg-black w-full max-w-4xl">
                    <video
                      src={selectedFile['@microsoft.graph.downloadUrl']}
                      controls
                      className="max-h-[60vh] w-full"
                      autoPlay={false}
                      preload="metadata"
                      playsInline
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-12 bg-surface-light/80 dark:bg-surface-dark/80 rounded-3xl shadow-lg backdrop-blur-sm border border-surface-light/20">
                    {selectedFile.folder ? (
                      <div className="p-6 bg-primary/10 rounded-full mb-6">
                        <span className="material-icons-outlined text-6xl text-primary">folder</span>
                      </div>
                    ) : selectedFile.file?.mimeType?.includes('pdf') ? (
                      <div className="p-6 bg-red-50/50 rounded-full mb-6">
                        <span className="material-icons-outlined text-6xl text-red-500">picture_as_pdf</span>
                      </div>
                    ) : (
                      <div className="p-6 bg-surface-light dark:bg-surface-dark rounded-full mb-6">
                        <span className="material-icons-outlined text-6xl text-text-light-subtle">description</span>
                      </div>
                    )}
                    <h3 className="text-xl font-bold text-text-light-base dark:text-text-dark-base mb-2">{selectedFile.folder ? '文件夹' : '不支持预览'}</h3>
                    <p className="text-text-light-subtle dark:text-text-dark-subtle max-w-xs">{selectedFile.folder ? '双击左侧列表中的文件夹以查看内容' : '此文件类型暂不支持在线预览，请下载后查看'}</p>
                  </div>
                )}
              </div>
            </div>

            {/* 文件详情卡片 */}
            <div className="flex-shrink-0 p-6 z-10">
              <div className="bg-surface-light/90 dark:bg-surface-dark/90 backdrop-blur-md rounded-2xl shadow-lg border border-surface-light/20 p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-text-light-base dark:text-text-dark-base break-all line-clamp-2" title={selectedFile.name}>{selectedFile.name}</h2>
                    {/* ID 已隐藏 */}
                  </div>
                  {selectedFile['@microsoft.graph.downloadUrl'] && (
                    <a
                      href={selectedFile['@microsoft.graph.downloadUrl']}
                      download
                      className="flex-shrink-0 inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-bold rounded-xl shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5 transition-all duration-200"
                    >
                      <span className="material-icons-outlined">download</span>
                      下载
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="p-4 rounded-xl bg-background-light/50 dark:bg-background-dark/50">
                    <span className="block text-xs font-medium text-text-light-subtle uppercase tracking-wider mb-1">类型</span>
                    <span className="text-sm font-semibold text-text-light-base dark:text-text-dark-base truncate block" title={selectedFile.file?.mimeType || '文件夹'}>
                      {selectedFile.file?.mimeType || '文件夹'}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-background-light/50 dark:bg-background-dark/50">
                    <span className="block text-xs font-medium text-text-light-subtle uppercase tracking-wider mb-1">大小</span>
                    <span className="text-sm font-semibold text-text-light-base dark:text-text-dark-base">
                      {selectedFile.folder ? '—' : formatBytes(selectedFile.size)}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-background-light/50 dark:bg-background-dark/50 col-span-2">
                    <span className="block text-xs font-medium text-text-light-subtle uppercase tracking-wider mb-1">最后修改</span>
                    <span className="text-sm font-semibold text-text-light-base dark:text-text-dark-base">
                      {/* 这里假设有 lastModifiedDateTime 字段，如果没有可以显示其他信息 */}
                      刚刚
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </main>
        ) : (
          <main className="hidden flex-1 flex-col bg-surface-light/30 dark:bg-surface-dark/30 md:flex items-center justify-center relative">
            <div className="absolute inset-0 bg-[radial-gradient(#93a1a1_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none"></div>
            <div className="text-center p-12 bg-surface-light/60 dark:bg-surface-dark/60 rounded-3xl backdrop-blur-sm border border-surface-light/20 shadow-xl max-w-md mx-4">
              <div className="inline-flex p-6 bg-surface-light dark:bg-surface-dark rounded-full shadow-lg mb-8">
                <span className="material-icons-outlined text-6xl text-primary/80">touch_app</span>
              </div>
              <h3 className="text-2xl font-bold text-text-light-base dark:text-text-dark-base mb-3">选择文件</h3>
              <p className="text-text-light-subtle dark:text-text-dark-subtle leading-relaxed">
                从左侧列表中点击文件查看详情和预览。<br />
                双击文件夹可进入子目录。
              </p>
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