<?php
// Include the shared configuration and functions
require_once __DIR__ . '/config.php';

// Set headers for CORS and JSON response
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

// --- Main Logic: Fetch data from Graph API ---
$selectFields = 'id,name,size,file,folder,@microsoft.graph.downloadUrl,thumbnails';
$baseGraphUrl = "https://graph.microsoft.com/v1.0/users/" . urlencode($userId) . "/drive/items/";

// --- Handle fetching a single file's download URL via content redirect ---
if (isset($_GET['fileId']) && !empty(trim($_GET['fileId']))) {
    $fileId = trim($_GET['fileId']);
    $url = $baseGraphUrl . urlencode($fileId) . "/content";

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Authorization: Bearer ' . $accessToken]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);

    if (curl_errno($ch)) {
        $curlError = curl_error($ch);
        curl_close($ch);
        send_error(500, "cURL Error requesting file content: " . $curlError);
    }
    
    curl_close($ch);
    
    $responseHeaders = substr($response, 0, $headerSize);
    $responseBody = substr($response, $headerSize);

    if ($httpCode == 302) {
        $downloadUrl = '';
        if (preg_match('/^Location: (.*)$/mi', $responseHeaders, $matches)) {
            $downloadUrl = trim($matches[1]);
        }

        if (empty($downloadUrl)) {
            send_error(500, 'Redirect received, but could not find the Location header.');
        }
        
        $fileUpdateData = ['id' => $fileId, '@microsoft.graph.downloadUrl' => $downloadUrl];
        echo json_encode(['file' => $fileUpdateData]);
        exit;

    } else {
        $errorDetails = json_decode($responseBody, true);
        $errorMessage = 'An unknown error occurred.';

        if (json_last_error() === JSON_ERROR_NONE && isset($errorDetails['error']['message'])) {
            $errorMessage = $errorDetails['error']['message'];
        } elseif (!empty($responseBody)) {
            $errorMessage = "Unexpected response from server (HTTP " . $httpCode . "): " . htmlspecialchars($responseBody);
        } else {
            $errorMessage = "Received HTTP status " . $httpCode . " with an empty response body.";
        }
        
        send_error(500, "Graph API Error: " . $errorMessage);
    }
}


// --- Handle fetching children of a folder ---
if (isset($_GET['itemId']) && !empty(trim($_GET['itemId']))) {
    $itemId = trim($_GET['itemId']);
    $allFiles = [];
    $initialUrl = $baseGraphUrl . urlencode($itemId) . "/children?\$select=" . urlencode($selectFields);
    $nextLink = $initialUrl;

    do {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $nextLink);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Authorization: Bearer ' . $accessToken, 'Accept: application/json']);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

        if (curl_errno($ch)) {
            $curlError = curl_error($ch);
            curl_close($ch);
            send_error(500, "cURL Error on Graph API request: " . $curlError);
        }
        curl_close($ch);

        if ($httpCode != 200) {
            $errorDetails = json_decode($response, true);
            $errorMessage = isset($errorDetails['error']['message']) ? $errorDetails['error']['message'] : 'An unknown error occurred while fetching files.';
            send_error($httpCode, "Graph API Error: " . $errorMessage);
        }

        $data = json_decode($response, true);
        if (isset($data['value'])) {
            $allFiles = array_merge($allFiles, $data['value']);
        }
        $nextLink = isset($data['@odata.nextLink']) ? $data['@odata.nextLink'] : null;

    } while ($nextLink);

    echo json_encode(['files' => $allFiles]);
    exit;
}

send_error(400, 'A required parameter (itemId or fileId) is missing.');
?>