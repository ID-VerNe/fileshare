// 文件共享/services/uploadService.ts

// Helper to clean up response from free hosting providers that inject HTML
async function parseJsonWithCleanup(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (e) {
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

/**
 * Step 1: Request an upload URL from our backend.
 * This function calls our own API (/api/upload.php) to get a temporary,
 * secure upload URL from the Microsoft Graph API.
 * @param itemId The ID of the folder to upload into.
 * @param fileName The name of the file being uploaded.
 * @returns The temporary upload URL.
 */
export async function createUploadSession(itemId: string, fileName: string): Promise<string> {
  const response = await fetch('/api/upload.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ itemId, fileName }),
  });

  if (!response.ok) {
    const errorData = await parseJsonWithCleanup(response);
    throw new Error(errorData.message || 'Failed to create upload session.');
  }

  const data = await parseJsonWithCleanup(response);
  return data.uploadUrl;
}

/**
 * A helper function to introduce a delay.
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


/**
 * Step 2: Upload the file in chunks sequentially. This is the only reliable method.
 * Performance is optimized by using a larger chunk size to minimize request latency overhead.
 * @param uploadUrl The temporary URL received from createUploadSession.
 * @param file The file to upload.
 * @param onProgress A callback function to report upload progress (0-100).
 */
export async function uploadFileToSession(
  uploadUrl: string,
  file: File,
  onProgress: (percentage: number) => void
): Promise<Response> {
  // *** 关键优化：显著增大分块大小 ***
  // 对于高速网络，30MB-60MB 是一个合理的范围。我们从 40MB 开始。
  // 注意：Graph API 的分块大小必须是 320 KB (327,680 字节) 的倍数。
  // 40 * 1024 * 1024 = 41,943,040，可以被 327,680 整除。
  const CHUNK_SIZE = 40 * 1024 * 1024;

  const MAX_RETRIES = 5;
  const RETRY_DELAY = 2000;

  const totalSize = file.size;
  if (totalSize === 0) {
    onProgress(100);
    const response = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Length': '0', 'Content-Range': 'bytes 0-0/0' } });
    return response.json();
  }

  let uploadedBytes = 0;

  // 使用简单的 for 循环进行绝对的串行上传
  for (let start = 0; start < totalSize; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE, totalSize);
    const chunk = file.slice(start, end);
    const chunkRange = `bytes ${start}-${end - 1}/${totalSize}`;

    let attempt = 0;
    while (attempt < MAX_RETRIES) {
      try {
        const response = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Range': chunkRange,
            'Content-Length': chunk.size.toString(),
          },
          body: chunk,
        });

        if (response.ok) {
          uploadedBytes = end; // 更新已上传的总字节数
          const percentage = Math.round((uploadedBytes / totalSize) * 100);
          onProgress(percentage);

          if (response.status === 200 || response.status === 201) {
            return response.json(); // 整个文件上传成功
          }

          break; // 中间分块成功，跳出重试循环，进入下一个分块
        }

        if (response.status >= 400 && response.status < 500) {
          throw new Error(`Client error: ${response.status}. Upload aborted.`);
        }

        throw new Error(`Server error: ${response.status}.`);

      } catch (error) {
        attempt++;
        console.error(`Attempt ${attempt} for chunk starting at ${start} failed:`, error);
        if (attempt >= MAX_RETRIES) {
          throw new Error(`Upload failed after ${MAX_RETRIES} attempts.`);
        }
        await sleep(RETRY_DELAY * attempt);
      }
    }
  }

  throw new Error('Upload loop finished unexpectedly.');
}