<?php
require_once __DIR__ . '/config.php';

// 严格速率限制：管理接口每分钟最多 10 次请求，有效防止爆破 API Key
check_rate_limit(10, 60);

header("Access-Control-Allow-Origin: https://onedrive.yuuverne.eu.org");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

// 鉴权逻辑：从 Header 中获取 Token
$adminApiKey = env('ADMIN_API_KEY');
$providedToken = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '';

if (empty($adminApiKey) || $providedToken !== $adminApiKey) {
    send_error(401, '未授权访问：API Key 错误或未提供。');
}

$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        // 获取列表
        $stmt = $db->query("SELECT * FROM share_codes ORDER BY created_at DESC");
        $list = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['list' => $list]);
    } 
    elseif ($method === 'POST') {
        // 创建或更新
        $input = json_decode(file_get_contents('php://input'), true);
        $shortCode = $input['short_code'] ?? null;
        $itemId = $input['item_id'] ?? null;
        $allowUpload = isset($input['allow_upload']) ? (int)$input['allow_upload'] : 0;
        $description = $input['description'] ?? '';

        if (!$shortCode || !$itemId) {
            send_error(400, '缺少必要参数');
        }

        $stmt = $db->prepare("INSERT OR REPLACE INTO share_codes (short_code, item_id, allow_upload, description) VALUES (:code, :item, :allow, :desc)");
        $stmt->execute([
            ':code' => $shortCode,
            ':item' => $itemId,
            ':allow' => $allowUpload,
            ':desc' => $description
        ]);
        echo json_encode(['message' => '保存成功']);
    }
    elseif ($method === 'DELETE') {
        // 删除
        $code = $_GET['short_code'] ?? null;
        if (!$code) {
            send_error(400, '缺少短码参数');
        }
        $stmt = $db->prepare("DELETE FROM share_codes WHERE short_code = :code");
        $stmt->execute([':code' => $code]);
        echo json_encode(['message' => '删除成功']);
    }
} catch (PDOException $e) {
    // 安全：记录详细错误到服务器日志，但向前端返回模糊信息，防止泄露路径/表结构
    error_log("Admin API Database Error: " . $e->getMessage());
    send_error(500, "服务器内部错误，请检查后台日志。");
}
