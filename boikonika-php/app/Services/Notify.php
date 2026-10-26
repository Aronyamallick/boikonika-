<?php
declare(strict_types=1);

namespace App\Services;

use App\Core\DB;
use App\Core\I18n;

/** In-app notifications plus email, written in each person's own language. */
final class Notify
{
    /**
     * @param string $key  notify.{key}.title / notify.{key}.body
     * @param string|null $link  site path without the language prefix, e.g. "account/orders/BK…"
     * @param bool $essential  sent by email even when the person turned notice emails off (orders, security)
     */
    public static function user(int $userId, string $key, array $params = [], ?string $link = null, bool $email = true, bool $essential = false): void
    {
        $u = DB::one("SELECT id, name, email, locale, notify_email, status FROM users WHERE id = ?", [$userId]);
        if (!$u || $u['status'] === 'deleted') {
            return;
        }
        $loc = $u['locale'] === 'en' ? 'en' : 'bn';
        $title = I18n::t('notify.' . $key . '.title', $params, $loc);
        $body = I18n::t('notify.' . $key . '.body', $params, $loc);
        DB::insert('notifications', [
            'user_id' => $userId,
            'type' => $key,
            'title' => mb_substr($title, 0, 255),
            'body' => mb_substr($body, 0, 500),
            'link' => $link,
            'created_at' => DB::now(),
        ]);
        if ($email && $u['email'] && ($essential || (int) $u['notify_email'] === 1)) {
            Mail::queue($u['email'], 'notice', [
                'name' => $u['name'],
                'title' => $title,
                'body' => $body,
                'link' => $link !== null ? abs_url($link, [], $loc) : null,
                'button' => I18n::t('notify.' . $key . '.button', [], $loc) !== 'notify.' . $key . '.button' ? I18n::t('notify.' . $key . '.button', [], $loc) : I18n::t('email.open', [], $loc),
            ], $loc, $u['name']);
        }
    }

    /** Tells every staff member with $permission (e.g. new seller applications). */
    public static function staff(string $permission, string $key, array $params = [], ?string $link = null): void
    {
        $ids = DB::col("SELECT DISTINCT ur.user_id FROM user_roles ur JOIN users u ON u.id = ur.user_id WHERE u.status = 'active'");
        foreach ($ids as $id) {
            $roles = DB::col('SELECT role FROM user_roles WHERE user_id = ?', [$id]);
            $allowed = in_array('super_admin', $roles, true);
            foreach ($roles as $r) {
                $allowed = $allowed || in_array($permission, \App\Core\Auth::PERMISSIONS[$r] ?? [], true);
            }
            if ($allowed) {
                self::user((int) $id, $key, $params, $link, true, false);
            }
        }
    }
}
