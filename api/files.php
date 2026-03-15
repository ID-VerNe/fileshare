<?php
// Include the shared configuration and functions
require_once __DIR__ . '/config.php';

// 速率限制：每分钟最多 30 次文件请求，防止暴力枚举
check_rate_limit(30, 60);

// Set headers for CORS and JSON response
header("Access-Control-Allow-Origin: https://onedrive.yuuverne.eu.org");
header("Content-Type: application/json; charset=UTF-8");

// Check for required configuration
if (empty($accessToken)) {
    send_error(500, 'Access token is missing. Check Graph API credentials.');
}

// --- Handle fetching files/folders ---
if (isset($_GET['itemId']) || isset($_GET['fileId'])) {
    $incomingId = $_GET['itemId'] ?? $_GET['fileId'];
    
    // 1. 尝试从数据库获取短码映射
    $shareInfo = get_share_info($incomingId);
    
    if ($shareInfo) {
        // 如果是短码映射，获取真实的真实 ID
        $realId = $shareInfo['item_id'];
        $isUploadAllowed = (bool)$shareInfo['allow_upload'];
        $currentShortCode = $incomingId; // 此时 itemId 本身就是短码
    } else {
        // 2. 如果不是短码，尝试解密混淆 ID
        // 必须有活跃的短码 Session 才能解密（deobfuscate_id 会自动处理 context 校验）
        $currentShortCode = $_SESSION['current_share_code'] ?? 'anon';
        $realId = deobfuscate_id($incomingId, $currentShortCode);
        
        if (!$realId) {
            send_error(403, '访问拒绝：无效的请求 ID 或越权访问。');
        }

        // 权限继承逻辑：从 Session 中读取该会话对应的上传权限
        $isUploadAllowed = $_SESSION['allow_upload_' . $currentShortCode] ?? false;
    }

    $isSingleFile = isset($_GET['fileId']);
    $graphUrl = $isSingleFile 
        ? "https://graph.microsoft.com/v1.0/users/" . urlencode($userId) . "/drive/items/" . urlencode($realId) . "?\$expand=thumbnails"
        : "https://graph.microsoft.com/v1.0/users/" . urlencode($userId) . "/drive/items/" . urlencode($realId) . "/children?\$expand=thumbnails";

    $allFiles = [];
    $nextLink = $graphUrl;

    do {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $nextLink);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Authorization: Bearer ' . $accessToken, 'Accept: application/json']);
        
        // --- SSL verification enabled for production ---
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
        // ----------------------------------------------

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

        if (curl_errno($ch)) {
            $curlError = curl_error($ch);
            curl_close($ch);
            send_error(500, "网络错误，请稍后再试。");
        }
        curl_close($ch);

        $data = json_decode($response, true);

        if ($httpCode >= 200 && $httpCode < 300) {
            // 定义清洗函数：只保留前端需要的字段
            $sanitize = function($item) use ($currentShortCode) {
                return [
                    'id' => obfuscate_id($item['id'], $currentShortCode),
                    'name' => $item['name'],
                    'size' => $item['size'] ?? 0,
                    'lastModifiedDateTime' => $item['lastModifiedDateTime'] ?? '',
                    'folder' => isset($item['folder']) ? true : null,
                    'file' => isset($item['file']) ? [
                        'mimeType' => $item['file']['mimeType'] ?? 'application/octet-stream'
                    ] : null,
                    // 仅在明确需要预览时才保留 thumbnails，否则移除
                    'thumbnails' => $item['thumbnails'] ?? []
                ];
            };

            if ($isSingleFile) {
                // 如果是单文件预览请求，为了支持下载，我们可以有选择地保留下载链接，
                // 或者在这里生成一个你自己的下载中转链接。
                // 暂时先简单处理，只返回核心信息和微软直链（仅在请求单文件时）
                $cleanFile = $sanitize($data);
                // 只有在请求单个文件详细信息时（通常是为了下载/预览），才带上 downloadUrl
                if (isset($data['@microsoft.graph.downloadUrl'])) {
                    $cleanFile['@microsoft.graph.downloadUrl'] = $data['@microsoft.graph.downloadUrl'];
                }
                echo json_encode(['file' => $cleanFile]);
                exit;
            }

            if (isset($data['value'])) {
                foreach ($data['value'] as $item) {
                    $allFiles[] = $sanitize($item);
                }
            }
            $nextLink = $data['@odata.nextLink'] ?? null;
        } else {
            // 隐藏具体的 Graph API 错误，只记录到日志
            error_log("Graph API Error ($httpCode): " . json_encode($data));
            send_error($httpCode, "无法获取文件列表。");
        }
    } while ($nextLink);

    echo json_encode([
        'files' => $allFiles,
        'uploadAllowed' => $isUploadAllowed
    ]);
    exit;
}

send_error(400, 'A required parameter (itemId or fileId) is missing.');
?>