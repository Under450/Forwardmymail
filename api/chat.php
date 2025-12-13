<?php
// api/chat.php
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['error' => 'Method not allowed']);
  exit;
}

$raw = file_get_contents('php://input');
$body = json_decode($raw, true);

if (!is_array($body)) {
  http_response_code(400);
  echo json_encode(['error' => 'Invalid JSON']);
  exit;
}

$question = isset($body['question']) ? trim((string)$body['question']) : '';
$history = isset($body['history']) && is_array($body['history']) ? $body['history'] : [];

if ($question === '') {
  http_response_code(400);
  echo json_encode(['error' => 'Missing question']);
  exit;
}

// Load API key (do not commit secrets.php to GitHub)
require __DIR__ . '/secrets.php';     // defines $ANTHROPIC_API_KEY
require __DIR__ . '/knowledge.php';   // defines $BUSINESS_KNOWLEDGE

$system = "You are a helpful AI assistant for Forwardmymail, a UK virtual address and mail forwarding service.\n"
. "Answer using ONLY the business knowledge provided.\n"
. "If the answer is not in the knowledge, say you cannot confirm and tell them to contact info@forwardmymail.co.uk or call 01543 406028 (Mon-Fri, 9am-5:30pm GMT).\n"
. "When discussing pricing, mention prices exclude VAT.\n\n"
. "BUSINESS KNOWLEDGE:\n"
. $BUSINESS_KNOWLEDGE;

// Clean history to user/assistant only, last 12 messages
$clean = [];
foreach ($history as $m) {
  if (!is_array($m)) continue;
  if (!isset($m['role'], $m['content'])) continue;
  $role = $m['role'];
  $content = $m['content'];
  if (!in_array($role, ['user', 'assistant'], true)) continue;
  if (!is_string($content)) continue;
  $clean[] = ['role' => $role, 'content' => $content];
}
if (count($clean) > 12) {
  $clean = array_slice($clean, -12);
}

$payload = [
  'model' => 'claude-sonnet-4-5',
  'max_tokens' => 800,
  'system' => $system,
  'messages' => array_merge($clean, [
    ['role' => 'user', 'content' => $question]
  ]),
];

$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => [
    'content-type: application/json',
    'x-api-key: ' . $ANTHROPIC_API_KEY,
    'anthropic-version: 2023-06-01',
  ],
  CURLOPT_POSTFIELDS => json_encode($payload),
]);

$res = curl_exec($ch);
$err = curl_error($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($res === false) {
  http_response_code(502);
  echo json_encode(['error' => 'Upstream error', 'details' => $err]);
  exit;
}

$data = json_decode($res, true);
if (!is_array($data)) {
  http_response_code(502);
  echo json_encode(['error' => 'Invalid upstream response']);
  exit;
}

if ($code < 200 || $code >= 300) {
  http_response_code(502);
  echo json_encode(['error' => 'Anthropic error', 'details' => $data]);
  exit;
}

$text = '';
if (isset($data['content'][0]['text']) && is_string($data['content'][0]['text'])) {
  $text = $data['content'][0]['text'];
}

echo json_encode(['text' => $text]);
