import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import type { DriveItem, BreadcrumbItem } from './types';
import { fetchFilesFromBackend, fetchSingleFile } from './services/graphService';
import { createUploadSession, uploadFileToSession } from './services/uploadService';

// 导入重构后的组件
import Header from './components/Header';
import FileBrowser from './components/FileBrowser';
import FilePreview from './components/FilePreview';
import SetupScreen from './components/SetupScreen';
import AdminPanel from './components/AdminPanel';
import Toast from './components/Toast';

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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [files, setFiles] = useState<DriveItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [selectedFile, setSelectedFile] = useState<DriveItem | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sortBy, setSortBy] = useState<'name' | 'size' | 'type'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [folderPath, setFolderPath] = useState<BreadcrumbItem[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [uploadAllowed, setUploadAllowed] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminApiKey, setAdminApiKey] = useState(() => sessionStorage.getItem('admin_api_key') || '');
  const [adminList, setAdminList] = useState<any[]>([]);
  const [newShare, setNewShare] = useState({ short_code: '', item_id: '', allow_upload: 0, description: '' });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('直链已复制');
    } catch (err) {
      showToast('复制失败', 'error');
    }
  };

  const handleFetchFiles = useCallback(async (folderId?: string | any) => {
    // 确保 targetId 始终是字符串。如果是从按钮 onClick 触发，第一个参数是事件对象，应忽略并使用 itemId
    const targetId = (typeof folderId === 'string' ? folderId : itemId);
    
    if (!targetId || typeof targetId !== 'string') return;

    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchFilesFromBackend(targetId);
      setFiles(result.files);
      // 如果不是进入子文件夹（即处理根目录获取），则设置相关状态
      if (typeof folderId !== 'string') {
        setUploadAllowed(result.uploadAllowed);
        setHasFetched(true);
        localStorage.setItem('file_share_code', targetId);
      }
      setSelectedFile(null);
    } catch (err: any) {
      setError(err.message);
      showToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [itemId]);

  const handleGoBack = useCallback(() => {
    if (selectedFile && isMobile) {
      setSelectedFile(null);
      return;
    }
    if (folderPath.length > 0) {
      const parentIndex = folderPath.length - 2;
      if (parentIndex < 0) {
        setFolderPath([]);
        handleFetchFiles();
      } else {
        const parent = folderPath[parentIndex];
        setFolderPath(prev => prev.slice(0, parentIndex + 1));
        handleFetchFiles(parent.id);
      }
      return;
    }
    setHasFetched(false);
    setFolderPath([]);
    setSearchQuery('');
  }, [selectedFile, isMobile, folderPath, handleFetchFiles]);

  const handleBreadcrumbClick = useCallback(async (index: number) => {
    if (index === -1) {
      setFolderPath([]);
      handleFetchFiles();
      return;
    }
    const target = folderPath[index];
    setFolderPath(prev => prev.slice(0, index + 1));
    handleFetchFiles(target.id);
  }, [folderPath, handleFetchFiles]);

  const handleFolderDoubleClick = useCallback(async (folder: DriveItem) => {
    if (!folder.folder) return;
    setFolderPath(prev => [...prev, { id: folder.id, name: folder.name }]);
    handleFetchFiles(folder.id);
  }, [handleFetchFiles]);

  const handleFilePreviewSelect = useCallback(async (file: DriveItem) => {
    setSelectedFile(file);
    if (file.file && !file['@microsoft.graph.downloadUrl']) {
      try {
        const updatedFile = await fetchSingleFile(file.id);
        const mergedFile = { ...file, ...updatedFile };
        setFiles(current => current.map(f => f.id === file.id ? mergedFile : f));
        setSelectedFile(mergedFile);
      } catch (err: any) {
        showToast('获取预览链接失败', 'error');
      }
    }
  }, []);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // 确定目标文件夹：如果有 folderPath，取最后一项 ID；否则使用根 itemId
    const targetFolderId = folderPath.length > 0 ? folderPath[folderPath.length - 1].id : itemId;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadingFileName(file.name);
    try {
      const uploadUrl = await createUploadSession(targetFolderId, file.name);
      await uploadFileToSession(uploadUrl, file, setUploadProgress);
      showToast('上传成功');
      handleFetchFiles(folderPath.length > 0 ? folderPath[folderPath.length - 1].id : undefined);
    } catch (err: any) {
      showToast('上传失败', 'error');
    } finally {
      setIsUploading(false);
      if (event.target) event.target.value = '';
    }
  }, [itemId, folderPath, handleFetchFiles]);

  const handleAdminAuth = useCallback(async (key?: string) => {
    const token = key || window.prompt('请输入管理 API 密钥:');
    if (!token) return;
    try {
      const response = await fetch('/api/admin.php', { headers: { 'X-Admin-Token': token } });
      if (!response.ok) throw new Error('鉴权失败');
      const data = await response.json();
      setAdminList(data.list || []);
      setAdminApiKey(token);
      sessionStorage.setItem('admin_api_key', token);
      setShowAdmin(true);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  }, []);

  const displayedFiles = useMemo(() => {
    let filtered = searchQuery ? files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())) : [...files];
    return filtered.sort((a, b) => {
      if (a.folder && !b.folder) return -1;
      if (!a.folder && b.folder) return 1;
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name, 'zh-CN');
      else if (sortBy === 'size') cmp = a.size - b.size;
      else if (sortBy === 'type') cmp = (a.file?.mimeType || '').localeCompare(b.file?.mimeType || '');
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [files, searchQuery, sortBy, sortOrder]);

  if (showAdmin) {
    return (
      <AdminPanel 
        onClose={() => setShowAdmin(false)}
        newShare={newShare}
        setNewShare={setNewShare}
        onSaveShare={async () => {
          await fetch('/api/admin.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminApiKey },
            body: JSON.stringify(newShare)
          });
          showToast('保存成功');
          setNewShare({ short_code: '', item_id: '', allow_upload: 0, description: '' });
          handleAdminAuth(adminApiKey);
        }}
        adminList={adminList}
        onEditShare={(item) => { setNewShare(item); window.scrollTo(0, 0); }}
        onDeleteShare={async (code) => {
          if (!window.confirm('确定删除？')) return;
          await fetch(`/api/admin.php?short_code=${encodeURIComponent(code)}`, {
            method: 'DELETE',
            headers: { 'X-Admin-Token': adminApiKey }
          });
          showToast('已删除');
          handleAdminAuth(adminApiKey);
        }}
      />
    );
  }

  if (!hasFetched) {
    return (
      <SetupScreen 
        itemId={itemId}
        setItemId={setItemId}
        isLoading={isLoading}
        error={error}
        onFetch={handleFetchFiles}
        onAdminAuth={() => handleAdminAuth()}
      />
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-slate-50 dark:bg-slate-950 text-text-light-base dark:text-text-dark-base overflow-hidden">
      <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
      
      <Header 
        onBack={handleGoBack}
        title="我的文件"
        subtitle={folderPath.length > 0 ? folderPath[folderPath.length - 1].name : "根目录"}
        isSubfolder={folderPath.length > 0 || (isMobile && !!selectedFile)}
        onUpload={uploadAllowed ? () => fileInputRef.current?.click() : undefined}
        isUploading={isUploading}
        isMobile={isMobile}
      />

      <div className="flex flex-1 overflow-hidden relative">
        <FileBrowser 
          files={files}
          displayedFiles={displayedFiles}
          viewMode={viewMode}
          selectedFile={selectedFile}
          onFileSelect={handleFilePreviewSelect}
          onFolderDoubleClick={handleFolderDoubleClick}
          isLoading={isLoading}
          searchQuery={searchQuery}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
          uploadingFileName={uploadingFileName}
          folderPath={folderPath}
          onBreadcrumbClick={handleBreadcrumbClick}
          formatBytes={formatBytes}
          isMobile={isMobile}
        />

        {selectedFile ? (
          <FilePreview 
            file={selectedFile}
            isMobile={isMobile}
            onClose={() => setSelectedFile(null)}
            onDownload={() => window.open(selectedFile['@microsoft.graph.downloadUrl'], '_blank')}
            onCopyLink={() => copyToClipboard(selectedFile['@microsoft.graph.downloadUrl'] || '')}
            formatBytes={formatBytes}
          />
        ) : !isMobile && (
          <main className="flex-1 flex flex-col items-center justify-center relative opacity-60">
            <span className="material-icons-outlined text-8xl mb-4">touch_app</span>
            <h3 className="text-xl font-bold">请选择一个文件</h3>
            <p className="text-sm mt-2">预览内容将在此处显示</p>
          </main>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
};

export default App;