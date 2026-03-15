<?php
require_once __DIR__ . '/config.php';

// 1. 基础鉴权：只有拥有活跃 Session 的用户才能通过代理访问
$currentShortCode = $_SESSION['current_share_code'] ?? null;
if (!$currentShortCode) {
    send_error(403, '访问拒绝：未授权的会话。');
}

// 2. 获取并解密 Item ID
$safeId = $_GET['fileId'] ?? null;
if (!$safeId) {
    send_error(400, '缺少文件 ID。');
}

$realId = deobfuscate_id($safeId, $currentShortCode);
if (!$realId) {
    send_error(403, '访问拒绝：无效的文件 ID。');
}

// 3. 获取文件内容（直接从微软 Graph API 获取流）
// 这样可以避开 downloadUrl 的有效期限制和强制下载响应头
$contentUrl = "https://graph.microsoft.com/v1.0/users/" . urlencode($userId) . "/drive/items/" . urlencode($realId) . "/content";

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $contentUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, false); // 直接输出
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 300); // 增加超时时间以支持大文件
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $accessToken
]);

// 4. 设置正确的响应头，诱导浏览器进行预览
header("Content-Type: application/pdf");
header("Content-Disposition: inline; filename=\"preview.pdf\"");
header("Cache-Control: public, max-age=3600");

// 5. 执行并输出
curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if ($httpCode >= 400) {
    error_log("Proxy Error ($httpCode): Failed to fetch content for $realId");
}

curl_close($ch);
exit;
?>
