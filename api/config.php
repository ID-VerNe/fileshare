<?php
/**
 * FileShare - Secure Cloud Bridge
 * Production Configuration
 */

// --- Production Security: Silence all PHP errors ---
error_reporting(0);
ini_set('display_errors', 0);

// 全局异常处理器：确保即使崩溃也返回纯净的 JSON，防止敏感信息泄露和广告注入
set_exception_handler(function ($e) {
    http_response_code(500);
    header("Content-Type: application/json; charset=UTF-8");
    
    // 清除可能已经产生的输出缓冲区（如 Notice 警告等）
    if (ob_get_length()) ob_clean();
    
    // 生产环境仅返回模糊错误信息，具体错误应查看服务器 error_log
    error_log("Production Error: " . $e->getMessage() . " in " . $e->getFile() . " on line " . $e->getLine());
    
    echo json_encode([
        'message' => 'Internal Server Error',
        'status' => 500
    ]);
    
    // 强制终止，防止流氓主机在响应末尾追加广告 HTML
    exit;
});

// --- Security Headers & Session Security ---
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_secure', 1);
ini_set('session.use_only_cookies', 1);
session_set_cookie_params([
    'samesite' => 'Lax'
]);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// --- Path Detection (Strictly within htdocs for open_basedir) ---
$possibleEnvPaths = [
    __DIR__ . '/.env', 
    __DIR__ . '/../.env'
];

$envLoaded = false;
foreach ($possibleEnvPaths as $path) {
    if (@is_file($path)) { // 使用 @ 抑制可能的权限警告
        foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            if (str_starts_with($line, '#')) continue;
            $pos = strpos($line, '=');
            if ($pos === false) continue;
            $key = substr($line, 0, $pos);
            $val = substr($line, $pos + 1);
            if (strlen($val) > 1 && $val[0] === '"' && substr($val, -1) === '"') {
                $val = substr($val, 1, -1);
            }
            $_ENV[$key] = $val;
        }
        $envLoaded = true;
        break; 
    }
}

function env(string $key, ?string $default = null): string {
    $v = $_ENV[$key] ?? getenv($key);
    return $v !== false && $v !== null ? (string)$v : (string)($default ?? '');
}

// --- Load Configuration from .env ---
$clientId = env('MS_GRAPH_CLIENT_ID');
$clientSecret = env('MS_GRAPH_CLIENT_SECRET');
$tenantId = env('MS_GRAPH_TENANT_ID');
$userId = env('MS_GRAPH_USER_ID');

/**
 * Sends a JSON error response and exits.
 */
function send_error($statusCode, $message) {
    http_response_code($statusCode);
    header("Content-Type: application/json; charset=UTF-8");
    if (ob_get_length()) ob_clean();
    echo json_encode(['message' => $message]);
    exit; // 防止广告注入
}

// --- Database Configuration (Strictly within htdocs) ---
$dbPath = __DIR__ . '/share.db'; // 默认放在 api 目录下

$db = null;
try {
    $db = new PDO("sqlite:$dbPath");
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->exec("CREATE TABLE IF NOT EXISTS share_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        short_code TEXT UNIQUE NOT NULL,
        item_id TEXT NOT NULL,
        allow_upload INTEGER DEFAULT 0,
        visit_count INTEGER DEFAULT 0,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");
    // 创建限流表
    $db->exec("CREATE TABLE IF NOT EXISTS rate_limits (
        ip TEXT PRIMARY KEY,
        attempts INTEGER DEFAULT 0,
        last_attempt INTEGER
    )");
} catch (Exception $e) {
    error_log("Database Error: " . $e->getMessage());
}


/**
 * 速率限制校验
 * @param int $maxAttempts 最大尝试次数
 * @param int $windowTime 窗口时间（秒）
 */
function check_rate_limit($maxAttempts = 10, $windowTime = 60) {
    global $db;
    if (!$db) return;

    $ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $now = time();

    $stmt = $db->prepare("SELECT * FROM rate_limits WHERE ip = :ip");
    $stmt->execute([':ip' => $ip]);
    $record = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($record) {
        if ($now - $record['last_attempt'] > $windowTime) {
            // 超过窗口时间，重置计数
            $stmt = $db->prepare("UPDATE rate_limits SET attempts = 1, last_attempt = :now WHERE ip = :ip");
            $stmt->execute([':ip' => $ip, ':now' => $now]);
        } else {
            if ($record['attempts'] >= $maxAttempts) {
                send_error(429, "请求过于频繁，请在 " . ($windowTime - ($now - $record['last_attempt'])) . " 秒后再试。");
            }
            $stmt = $db->prepare("UPDATE rate_limits SET attempts = attempts + 1, last_attempt = :now WHERE ip = :ip");
            $stmt->execute([':ip' => $ip, ':now' => $now]);
        }
    } else {
        $stmt = $db->prepare("INSERT INTO rate_limits (ip, attempts, last_attempt) VALUES (:ip, 1, :now)");
        $stmt->execute([':ip' => $ip, ':now' => $now]);
    }
}

/**
 * 根据短码获取映射信息，并同步更新 Session 权限
 */
function get_share_info($code) {
    global $db;
    if (!$db) return null;
    $stmt = $db->prepare("SELECT * FROM share_codes WHERE short_code = :code");
    $stmt->execute([':code' => $code]);
    $info = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($info) {
        $update = $db->prepare("UPDATE share_codes SET visit_count = visit_count + 1 WHERE id = :id");
        $update->execute([':id' => $info['id']]);
        
        // 关键：将权限和根目录 ID 存入 Session，用于后续的越权校验
        $_SESSION['current_share_code'] = $code;
        $_SESSION['root_item_id'] = $info['item_id'];
        $_SESSION['allow_upload_' . $code] = (bool)$info['allow_upload'];
    }
    return $info;
}

// --- ID Obfuscation (Security Upgraded with Context Binding) ---
define('ID_ENCRYPTION_KEY', substr($clientSecret . 'fileshare_v3_binding', 0, 16));

/**
 * 将真实的 itemId 混淆为安全字符串 (绑定当前分享短码)
 */
function obfuscate_id($realId, $context = '') {
    if (empty($realId)) return '';
    // 如果没有显式提供 context，尝试从 Session 获取
    if (empty($context)) $context = $_SESSION['current_share_code'] ?? 'anon';
    
    $method = 'aes-128-cbc';
    $ivLength = openssl_cipher_iv_length($method);
    $iv = openssl_random_pseudo_bytes($ivLength);
    
    // 将 context 和 realId 组合加密，防止 ID 在不同分享链接间通用
    $plainText = $context . '|' . $realId;
    $encrypted = openssl_encrypt($plainText, $method, ID_ENCRYPTION_KEY, 0, $iv);
    
    return str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($iv . $encrypted));
}

/**
 * 将安全字符串还原为真实的 itemId (校验 context)
 */
function deobfuscate_id($safeId, $expectedContext = '') {
    if (empty($safeId)) return null;
    if (empty($expectedContext)) $expectedContext = $_SESSION['current_share_code'] ?? 'anon';

    $method = 'aes-128-cbc';
    $ivLength = openssl_cipher_iv_length($method);
    $data = str_replace(['-', '_'], ['+', '/'], $safeId);
    $decodedData = base64_decode($data, true);
    
    if (!$decodedData || strlen($decodedData) <= $ivLength) return null;

    $iv = substr($decodedData, 0, $ivLength);
    $encrypted = substr($decodedData, $ivLength);
    $decrypted = openssl_decrypt($encrypted, $method, ID_ENCRYPTION_KEY, 0, $iv);
    
    if (!$decrypted) return null;

    // 分离 context 和 realId
    $parts = explode('|', $decrypted, 2);
    if (count($parts) !== 2) return null;
    
    list($context, $realId) = $parts;
    
    // 核心校验：如果加密时的 context 与当前预期的不一致，说明是越权访问
    if ($context !== $expectedContext) {
        error_log("Security Alert: IDOR attempt detected. Context mismatch.");
        return null;
    }

    return $realId;
}

// --- Token Management ---
$accessToken = null;
if (!empty($clientId) && !empty($clientSecret) && !empty($tenantId)) {
    if (isset($_SESSION['ms_graph_token']) && isset($_SESSION['ms_graph_token_expires']) && time() < $_SESSION['ms_graph_token_expires']) {
        $accessToken = $_SESSION['ms_graph_token'];
    } else {
        try {
            $accessToken = get_access_token($tenantId, $clientId, $clientSecret);
        } catch (Exception $e) {
            error_log("Token Error: " . $e->getMessage());
            // Do not exit, let the error be handled or logged.
        }
    }
}
?>