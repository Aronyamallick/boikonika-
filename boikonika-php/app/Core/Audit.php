<?php
declare(strict_types=1);

namespace App\Core;

/** Append-only record of staff and security-relevant actions. */
final class Audit
{
    public static function log(string $action, ?string $entityType = null, int|string|null $entityId = null, array $details = []): void
    {
        DB::insert('audit_logs', [
            'actor_user_id' => Auth::id(),
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId === null ? null : (string) $entityId,
            'details' => $details ? json_encode($details, JSON_UNESCAPED_UNICODE) : null,
            'ip' => isset(App::$request) ? App::$request->ip() : null,
            'created_at' => DB::now(),
        ]);
    }
}
