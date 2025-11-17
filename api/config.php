<?php
// Start session for caching the access token
session_start();

// --- .env File Parsing Logic (Your custom implementation) ---
$envPath = __DIR__ . '/../.env'; // Assumes .env is in the project root, one level above /api
if (is_file($envPath)) {
    foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with($line, '#')) continue;
        $pos = strpos($line, '=');
        if ($pos === false) continue;
        $key = substr($line, 0, $pos);
        $val = substr($line, $pos + 1);
        // Basic handling for quoted values
        if (strlen($val) > 1 && $val[0] === '"' && substr($val, -1) === '"') {
            $val = substr($val, 1, -1);
        }
        $_ENV[$key] = $val;
    }
}

function env(string $key, ?string $default = null): string {
    $v = $_ENV[$key] ?? getenv($key);
    return $v !== false && $v !== null ? (string)$v : (string)($default ?? '');
}
// --- End .env Parsing Logic ---


// --- Load Configuration from .env ---
$clientId = env('MS_GRAPH_CLIENT_ID');
$clientSecret = env('MS_GRAPH_CLIENT_SECRET');
$tenantId = env('MS_GRAPH_TENANT_ID');
$userId = env('MS_GRAPH_USER_ID');


// --- Shared Functions (Moved from files.php) ---

/**
 * Sends a JSON error response and exits.
 */
function send_error($statusCode, $message) {
    http_response_code($statusCode);
    // Set JSON header for error messages as well
    header("Content-Type: application/json; charset=UTF-8");
    echo json_encode(['message' => $message]);
    exit;
}

/**
 * Gets a new access token from Microsoft.
 */
function get_access_token($tenantId, $clientId, $clientSecret) {
    $tokenEndpoint = "https://login.microsoftonline.com/$tenantId/oauth2/v2.0/token";
    $postData = [
        'client_id' => $clientId,
        'scope' => 'https://graph.microsoft.com/.default',
        'client_secret' => $clientSecret,
        'grant_type' => 'client_credentials'
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $tokenEndpoint);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    
    if (curl_errno($ch)) {
        $curlError = curl_error($ch);
        curl_close($ch);
        send_error(500, "cURL Error on token request: " . $curlError);
    }
    curl_close($ch);

    if ($httpCode != 200 || $response === false) {
        send_error(500, "Authentication failed. Could not obtain access token.");
    }
    
    $tokenData = json_decode($response, true);
    
    $_SESSION['ms_graph_token'] = $tokenData['access_token'];
    $_SESSION['ms_graph_token_expires'] = time() + $tokenData['expires_in'] - 300; 
    
    return $tokenData['access_token'];
}

// --- Initial Check & Token Management ---

// Check if credentials are set. If not, fail gracefully.
if (empty($clientId) || empty($clientSecret) || empty($tenantId) || empty($userId)) {
    send_error(500, 'Server configuration error: Microsoft Graph API credentials are not fully set or could not be loaded from .env file.');
}

// Get access token (from session or new)
$accessToken = null;
if (isset($_SESSION['ms_graph_token']) && isset($_SESSION['ms_graph_token_expires']) && time() < $_SESSION['ms_graph_token_expires']) {
    $accessToken = $_SESSION['ms_graph_token'];
} else {
    $accessToken = get_access_token($tenantId, $clientId, $clientSecret);
}
?>