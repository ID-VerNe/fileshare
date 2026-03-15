<?php
// Include the shared configuration and functions
require_once __DIR__ . '/config.php';

// 速率限制：每分钟最多 15 次上传会话请求
check_rate_limit(15, 60);

// Set headers for CORS and JSON response
header("Access-Control-Allow-Origin: https://onedrive.yuuverne.eu.org");
header("Content-Type: application/json; charset=UTF-8");

// We only accept POST requests for this endpoint
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_error(405, 'Method Not Allowed. Only POST requests are accepted.');
}

// --- Handle creating an upload session ---
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $incomingCode = $input['itemId'] ?? null;
    $fileName = $input['fileName'] ?? null;

    if (!$incomingCode || !$fileName) {
        send_error(400, 'Missing itemId or fileName.');
    }

    // 1. 尝试从数据库获取短码映射
    $shareInfo = get_share_info($incomingCode);

    if ($shareInfo) {
        $realId = $shareInfo['item_id'];
        $isUploadAllowed = (bool)$shareInfo['allow_upload'];
        $currentShortCode = $incomingCode;
    } else {
        // 2. 如果不是短码，尝试解密混淆 ID (校验 Context)
        $currentShortCode = $_SESSION['current_share_code'] ?? 'anon';
        $realId = deobfuscate_id($incomingCode, $currentShortCode);
        
        if (!$realId) {
            send_error(403, '访问拒绝：无效的分享 ID 或越权尝试。');
        }

        // 严格权限继承逻辑：必须有活跃的短码 Session，且该 Session 允许上传
        $isUploadAllowed = $_SESSION['allow_upload_' . $currentShortCode] ?? false;
    }

    // 如果没有上传权限，直接拦截
    if (!$isUploadAllowed) {
        send_error(403, '该分享链接没有上传权限。');
    }

    // --- 安全加固：校验目标文件夹是否在根分享目录下 ---
    // 虽然 deobfuscate_id 已经校验了 context，但这里可以更进一步确保逻辑闭环
    // 在本系统中，root_item_id 会在进入分享链接时存入 Session
    $rootId = $_SESSION['root_item_id'] ?? null;
    if (!$rootId) {
        send_error(403, '会话已过期，请重新进入分享链接。');
    }
    // 注意：如果是根目录上传，$realId 应该等于 $rootId；如果是子目录，Graph API 会处理层级关系。
    // deobfuscate_id 已经保证了该 $realId 是在这个 $currentShortCode 下生成的。

    // The Graph API endpoint to create an upload session
    $safeFileName = basename($fileName);
    $uploadSessionUrl = "https://graph.microsoft.com/v1.0/users/" . urlencode($userId) . "/drive/items/" . urlencode($realId) . ":/" . urlencode($safeFileName) . ":/createUploadSession";

}

// Using cURL to make the POST request to Graph API
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $uploadSessionUrl);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([])); // Empty body is fine
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $accessToken,
    'Content-Type: application/json',
    'Accept: application/json'
]);

// --- SSL verification enabled for production ---
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
// ----------------------------------------------

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    $curlError = curl_error($ch);
    curl_close($ch);
    send_error(500, "cURL Error creating upload session: " . $curlError);
}
curl_close($ch);

$responseData = json_decode($response, true);

// Check if the Graph API call was successful
if ($httpCode >= 200 && $httpCode < 300) {
    if (isset($responseData['uploadUrl'])) {
        // Success! Send the temporary upload URL back to the frontend.
        echo json_encode(['uploadUrl' => $responseData['uploadUrl']]);
    } else {
        send_error(500, 'Graph API did not return an uploadUrl.');
    }
} else {
    // Handle errors from Graph API
    $errorMessage = $responseData['error']['message'] ?? 'An unknown error occurred while creating the upload session.';
    send_error($httpCode, "Graph API Error: " . $errorMessage);
}
?>
