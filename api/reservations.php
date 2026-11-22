<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

function normalizeDateTime(string $str): ?string {
    $str = trim($str);
    $str = str_replace('T', ' ', $str);
    if (preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/', $str)) {
        $str .= ':00';
    }
    $dt = DateTime::createFromFormat('Y-m-d H:i:s', $str);
    if (!$dt || $dt->format('Y-m-d H:i:s') !== $str) {
        return null;
    }
    return $str;
}

if ($method === 'GET') {
    $startInput = (string)($_GET['start'] ?? '');
    $endInput = (string)($_GET['end'] ?? '');

    $start = normalizeDateTime($startInput);
    $end = normalizeDateTime($endInput);

    if (!$start || !$end) {
        $now = new DateTime();
        $start = $now->format('Y-m-d H:i:s');
        $end = (clone $now)->modify('+2 hours')->format('Y-m-d H:i:s');
    }

    if ($end <= $start) {
        http_response_code(400);
        echo json_encode(['error' => 'Godzina zakończenia musi być późniejsza niż rozpoczęcia.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $sqlResources = "
        SELECT
            r.id,
            r.name,
            r.type,
            r.capacity,
            CASE
                WHEN EXISTS (
                    SELECT 1 FROM reservations res
                    WHERE res.resource_id = r.id
                      AND res.start_time < :end_time
                      AND res.end_time > :start_time
                ) THEN 1
                ELSE 0
            END AS is_occupied
        FROM resources r
        ORDER BY r.type ASC, r.id ASC
    ";
    $stmt = $pdo->prepare($sqlResources);
    $stmt->execute([
        ':start_time' => $start,
        ':end_time' => $end
    ]);
    $resources = $stmt->fetchAll();

    foreach ($resources as &$r) {
        $r['id'] = (int)$r['id'];
        $r['capacity'] = (int)$r['capacity'];
        $r['is_occupied'] = (bool)$r['is_occupied'];
    }
    unset($r);

    $sqlReservations = "
        SELECT
            res.id,
            res.resource_id,
            r.name AS resource_name,
            r.type AS resource_type,
            res.user_name,
            res.start_time,
            res.end_time
        FROM reservations res
        JOIN resources r ON r.id = res.resource_id
        ORDER BY res.start_time ASC, res.id DESC
    ";
    $stmtRes = $pdo->query($sqlReservations);
    $reservations = $stmtRes->fetchAll();

    foreach ($reservations as &$item) {
        $item['id'] = (int)$item['id'];
        $item['resource_id'] = (int)$item['resource_id'];
    }
    unset($item);

    http_response_code(200);
    echo json_encode([
        'resources' => $resources,
        'reservations' => $reservations
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);

    if (!is_array($data)) {
        http_response_code(400);
        echo json_encode(['error' => 'Niepoprawny format JSON.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $resourceId = isset($data['resource_id']) ? (int)$data['resource_id'] : 0;
    $userName = trim((string)($data['user_name'] ?? ''));
    $start = normalizeDateTime((string)($data['start_time'] ?? ''));
    $end = normalizeDateTime((string)($data['end_time'] ?? ''));

    if ($resourceId <= 0 || mb_strlen($userName, 'UTF-8') < 3 || !$start || !$end) {
        http_response_code(400);
        echo json_encode(['error' => 'Uzupełnij poprawnie wszystkie pola (imię i nazwisko min. 3 znaki).'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $today = (new DateTime())->format('Y-m-d');
    $startDate = substr($start, 0, 10);
    if ($startDate < $today) {
        http_response_code(400);
        echo json_encode(['error' => 'Data rezerwacji nie może być z przeszłości.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($end <= $start) {
        http_response_code(400);
        echo json_encode(['error' => 'Godzina zakończenia musi być późniejsza niż rozpoczęcia.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $checkRes = $pdo->prepare("SELECT id FROM resources WHERE id = :id");
    $checkRes->execute([':id' => $resourceId]);
    if (!$checkRes->fetch()) {
        http_response_code(404);
        echo json_encode(['error' => 'Nie znaleziono wskazanego zasobu.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $conflictSql = "
        SELECT id FROM reservations
        WHERE resource_id = :resource_id
          AND start_time < :end_time
          AND end_time > :start_time
        LIMIT 1
    ";
    $stmtConflict = $pdo->prepare($conflictSql);
    $stmtConflict->execute([
        ':resource_id' => $resourceId,
        ':start_time' => $start,
        ':end_time' => $end
    ]);

    if ($stmtConflict->fetch()) {
        http_response_code(409);
        echo json_encode(['error' => 'Wybrane stanowisko jest już zajęte w tym terminie.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $insertSql = "
        INSERT INTO reservations (resource_id, user_name, start_time, end_time)
        VALUES (:resource_id, :user_name, :start_time, :end_time)
    ";
    $stmtInsert = $pdo->prepare($insertSql);
    $stmtInsert->execute([
        ':resource_id' => $resourceId,
        ':user_name' => $userName,
        ':start_time' => $start,
        ':end_time' => $end
    ]);

    http_response_code(201);
    echo json_encode([
        'message' => 'Rezerwacja została dodana.',
        'id' => (int)$pdo->lastInsertId()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'DELETE') {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

    if ($id <= 0) {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (is_array($data) && isset($data['id'])) {
            $id = (int)$data['id'];
        }
    }

    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Brak poprawnego ID rezerwacji.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $stmtDelete = $pdo->prepare("DELETE FROM reservations WHERE id = :id");
    $stmtDelete->execute([':id' => $id]);

    if ($stmtDelete->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['error' => 'Rezerwacja o podanym ID nie istnieje.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    http_response_code(200);
    echo json_encode(['message' => 'Rezerwacja została usunięta.'], JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Metoda HTTP niedozwolona.'], JSON_UNESCAPED_UNICODE);