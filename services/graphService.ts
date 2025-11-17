import type { DriveItem } from '../types';

export async function fetchFilesFromBackend(itemId: string): Promise<DriveItem[]> {
  if (!itemId || !itemId.trim()) {
    throw new Error('请输入有效的取件码。');
  }

  try {
    // The request is now sent to our own PHP backend proxy
    const response = await fetch(`/api/files.php?itemId=${encodeURIComponent(itemId)}`);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: '无法解析错误响应。' }));
        // Pass the error message from the backend to the frontend
        throw new Error(errorData.message || `服务器错误，状态码: ${response.status}`);
    }

    const data = await response.json();
    return data.files || [];
  } catch (error) {
    console.error('Fetch from backend failed:', error);
    if (error instanceof Error) {
        // Prepend a user-friendly message to the technical error
        throw new Error(`无法连接到后端服务: ${error.message}`);
    }
    throw new Error('网络请求失败，请检查您的网络连接以及后端服务是否正在运行。');
  }
}

export async function fetchSingleFile(fileId: string): Promise<DriveItem> {
  if (!fileId || !fileId.trim()) {
    throw new Error('请输入有效的文件ID。');
  }

  try {
    const response = await fetch(`/api/files.php?fileId=${encodeURIComponent(fileId)}`);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: '无法解析错误响应。' }));
        throw new Error(errorData.message || `服务器错误，状态码: ${response.status}`);
    }

    const data = await response.json();
    if (!data.file) {
        throw new Error('后端未返回有效的文件数据。');
    }
    return data.file;
  } catch (error) {
    console.error('Fetch single file from backend failed:', error);
    if (error instanceof Error) {
        throw new Error(`无法获取文件链接: ${error.message}`);
    }
    throw new Error('网络请求失败，请检查您的网络连接以及后端服务是否正在运行。');
  }
}
