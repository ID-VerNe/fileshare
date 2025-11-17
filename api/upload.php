<?php
// Include the shared configuration and functions
require_once __DIR__ . '/config.php';

// Set headers for CORS and JSON response
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

// We only accept POST requests for this endpoint
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    send_error(405, 'Method Not Allowed. Only POST requests are accepted.');
}

// Get the request body sent from the frontend
$input = json_decode(file_get_contents('php://input'), true);

$itemId = $input['itemId'] ?? null;     // The ID of the folder to upload into
$fileName = $input['fileName'] ?? null; // The name of the file being uploaded

// Basic validation
if (empty($itemId) || empty($fileName)) {
    send_error(400, 'Bad Request: Missing itemId or fileName in the request body.');
}

// Security: Sanitize the filename to prevent path traversal attacks.
// This removes any directory separators like / or \
$fileName = basename($fileName);

// The Graph API endpoint to create an upload session
$uploadSessionUrl = "https://graph.microsoft.com/v1.0/users/" . urlencode($userId) . "/drive/items/" . urlencode($itemId) . ":/" . urlencode($fileName) . ":/createUploadSession";

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
