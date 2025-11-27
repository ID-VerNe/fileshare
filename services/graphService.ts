import type { DriveItem } from '../types';

// Helper to clean up response from free hosting providers that inject HTML
async function parseJsonWithCleanup(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    // Try to find the last closing brace of the JSON object
    const lastBrace = text.lastIndexOf('}');
    if (lastBrace !== -1) {
      const cleanText = text.substring(0, lastBrace + 1);
      try {
        return JSON.parse(cleanText);
      } catch (e2) {
        console.warn('Failed to parse cleaned JSON:', e2);
      }
    }
    throw new Error(`Invalid JSON response: ${text.substring(0, 100)}...`);
  }
}

export async function fetchFilesFromBackend(itemId: string): Promise<DriveItem[]> {
  if (!itemId || !itemId.trim()) {
    throw new Error('请输入有效的取件码。');
  }

  try {
    // The request is now sent to our own PHP backend proxy
    const response = await fetch(`/api/files.php?itemId=${encodeURIComponent(itemId)}`);

    if (!response.ok) {
      const errorData = await parseJsonWithCleanup(response).catch(() => ({ message: '无法解析错误响应。' }));
      // Pass the error message from the backend to the frontend
      throw new Error(errorData.message || `服务器错误，状态码: ${response.status}`);
    }

    const data = await parseJsonWithCleanup(response);
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
      const errorData = await parseJsonWithCleanup(response).catch(() => ({ message: '无法解析错误响应。' }));
      throw new Error(errorData.message || `服务器错误，状态码: ${response.status}`);
    }

    const data = await parseJsonWithCleanup(response);
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
