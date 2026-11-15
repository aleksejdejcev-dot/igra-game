<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

// Учебная игра: клиентский подсчёт очков можно подделать; этот список рекордов не является защитой от читов.
$path = __DIR__ . '/leaderboard.json';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'GET' && $method !== 'POST') {
    header('Allow: GET, POST');
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$handle = fopen($path, 'c+');
if ($handle === false || !flock($handle, LOCK_EX)) {
    if (is_resource($handle)) fclose($handle);
    http_response_code(500);
    echo json_encode(['error' => 'Leaderboard storage is unavailable']);
    exit;
}

$contents = stream_get_contents($handle);
$stored = json_decode($contents ?: '[]', true);
if (is_array($stored) && !array_key_exists('records', $stored) && !array_key_exists('rates', $stored)) {
    // Upgrade the earlier list-only format without losing existing scores.
    $records = $stored;
    $rates = [];
} else {
    $records = is_array($stored['records'] ?? null) ? $stored['records'] : [];
    $rates = is_array($stored['rates'] ?? null) ? $stored['rates'] : [];
}
$normalized = [];
foreach ($records as $record) {
    if (!is_array($record) || !is_string($record['name'] ?? null) || !is_numeric($record['score'] ?? null)) continue;
    $recordName = preg_replace('/[\p{C}\s]+/u', ' ', trim(strip_tags($record['name']))) ?? '';
    $recordCharacters = preg_split('//u', $recordName, -1, PREG_SPLIT_NO_EMPTY);
    $recordScore = (int) $record['score'];
    if ($recordCharacters === false || count($recordCharacters) < 1 || $recordScore < 0 || $recordScore > 100000) continue;
    $normalized[] = [
        'name' => implode('', array_slice($recordCharacters, 0, 24)),
        'score' => $recordScore,
        'date' => is_string($record['date'] ?? null) ? $record['date'] : (is_string($record['createdAt'] ?? null) ? $record['createdAt'] : ''),
    ];
}
$records = $normalized;

if ($method === 'POST') {
    $payload = json_decode(file_get_contents('php://input') ?: '', true);
    $rawName = is_array($payload) && is_string($payload['name'] ?? null) ? $payload['name'] : '';
    $name = trim(strip_tags($rawName));
    $name = preg_replace('/[\p{C}\s]+/u', ' ', $name) ?? '';
    $characters = preg_split('//u', $name, -1, PREG_SPLIT_NO_EMPTY);
    $rawScore = is_array($payload) ? ($payload['score'] ?? null) : null;
    $score = is_int($rawScore) || (is_string($rawScore) && preg_match('/^\d+$/D', $rawScore))
        ? (int) $rawScore : -1;

    if ($characters === false || count($characters) < 1 || count($characters) > 24 || $score < 0 || $score > 100000) {
        flock($handle, LOCK_UN);
        fclose($handle);
        http_response_code(400);
        echo json_encode(['error' => 'Name must contain 1–24 characters and score must be 0–100000']);
        exit;
    }

    $now = time();
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $ipKey = hash('sha256', $ip);
    $window = $rates[$ipKey] ?? ['start' => $now, 'count' => 0];
    if (!is_array($window) || !isset($window['start'], $window['count']) || $now - (int) $window['start'] >= 3600) {
        $window = ['start' => $now, 'count' => 0];
    }
    if ((int) $window['count'] >= 10) {
        flock($handle, LOCK_UN);
        fclose($handle);
        header('Retry-After: ' . max(1, 3600 - ($now - (int) $window['start'])));
        http_response_code(429);
        echo json_encode(['error' => 'Too many records from this address']);
        exit;
    }
    $rates[$ipKey] = ['start' => (int) $window['start'], 'count' => (int) $window['count'] + 1];

    $records[] = [
        'name' => implode('', $characters),
        'score' => $score,
        'date' => gmdate(DATE_ATOM),
    ];
    usort($records, static fn(array $a, array $b): int => ($b['score'] ?? 0) <=> ($a['score'] ?? 0));
    $records = array_slice($records, 0, 20);
    // Bound rate-limit metadata to recent senders so the JSON file cannot grow without limit.
    if (count($rates) > 1000) $rates = array_slice($rates, -500, null, true);
    rewind($handle);
    ftruncate($handle, 0);
    fwrite($handle, json_encode(['records' => $records, 'rates' => $rates], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
    fflush($handle);
}

flock($handle, LOCK_UN);
fclose($handle);
echo json_encode(['records' => array_slice($records, 0, 20)], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
