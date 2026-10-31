<?php
declare(strict_types=1);

namespace App\Core;

/**
 * Server-side validation. Rules: required, nullable, email, phone, min:n, max:n, int, gte:n, lte:n,
 * money, money_positive, in:a,b, slug, url, password, confirmed, isbn, year, date, datetime.
 * Returns field => translated message.
 */
final class Validator
{
    public static function make(array $data, array $rules): array
    {
        $errors = [];
        foreach ($rules as $field => $spec) {
            $value = $data[$field] ?? null;
            $value = is_string($value) ? trim($value) : $value;
            $list = is_array($spec) ? $spec : explode('|', $spec);
            $empty = $value === null || $value === '' || $value === [];
            if ($empty) {
                if (in_array('required', $list, true)) {
                    $errors[$field] = I18n::t('validation.required');
                }
                continue;
            }
            foreach ($list as $rule) {
                [$name, $arg] = array_pad(explode(':', $rule, 2), 2, null);
                $msg = self::check($name, $arg, $value, $data, $field);
                if ($msg !== null) {
                    $errors[$field] = $msg;
                    break;
                }
            }
        }
        return $errors;
    }

    private static function check(string $rule, ?string $arg, mixed $value, array $data, string $field): ?string
    {
        $s = is_scalar($value) ? (string) $value : '';
        $ascii = I18n::toAscii($s);
        return match ($rule) {
            'required', 'nullable' => null,
            'email' => filter_var($s, FILTER_VALIDATE_EMAIL) && mb_strlen($s) <= 191 ? null : I18n::t('validation.email'),
            'phone' => self::phone($s) !== null ? null : I18n::t('validation.phone'),
            'min' => mb_strlen($s) >= (int) $arg ? null : I18n::t('validation.min', ['min' => I18n::number((int) $arg)]),
            'max' => mb_strlen($s) <= (int) $arg ? null : I18n::t('validation.max', ['max' => I18n::number((int) $arg)]),
            'int' => preg_match('/^-?\d{1,10}$/', $ascii) ? null : I18n::t('validation.int'),
            'gte' => preg_match('/^-?\d+$/', $ascii) && (int) $ascii >= (int) $arg ? null : I18n::t('validation.gte', ['min' => I18n::number((int) $arg)]),
            'lte' => preg_match('/^-?\d+$/', $ascii) && (int) $ascii <= (int) $arg ? null : I18n::t('validation.lte', ['max' => I18n::number((int) $arg)]),
            'money' => Money::valid($s) ? null : I18n::t('validation.money'),
            'money_positive' => Money::valid($s, false) ? null : I18n::t('validation.moneyPositive'),
            'in' => in_array($s, explode(',', (string) $arg), true) ? null : I18n::t('validation.in'),
            'slug' => preg_match('/^[\p{Ll}\p{Lo}\p{M}\p{N}]+(?:-[\p{Ll}\p{Lo}\p{M}\p{N}]+)*$/u', $s) ? null : I18n::t('validation.slug'),
            'url' => preg_match('#^https?://#i', $s) && filter_var($s, FILTER_VALIDATE_URL) ? null : I18n::t('validation.url'),
            'password' => mb_strlen($s) >= 8 && mb_strlen($s) <= 128 && preg_match('/\pL/u', $s) && preg_match('/\d/', $ascii) ? null : I18n::t('validation.password'),
            'confirmed' => isset($data[$field . '_confirmation']) && hash_equals($s, (string) $data[$field . '_confirmation']) ? null : I18n::t('validation.confirmed'),
            'isbn' => self::isbn($s) !== null ? null : I18n::t('validation.isbn'),
            'year' => preg_match('/^\d{4}$/', $ascii) && (int) $ascii >= 1400 && (int) $ascii <= (int) date('Y') + 1 ? null : I18n::t('validation.year'),
            'date' => \DateTime::createFromFormat('Y-m-d', $s) !== false ? null : I18n::t('validation.date'),
            'datetime' => \DateTime::createFromFormat('Y-m-d\TH:i', $s) !== false ? null : I18n::t('validation.date'),
            default => throw new \LogicException('Unknown rule ' . $rule),
        };
    }

    /** Bangladeshi mobile → "01XXXXXXXXX", or null. Accepts +880, 880, spaces, dashes and Bangla digits. */
    public static function phone(?string $s): ?string
    {
        if ($s === null) {
            return null;
        }
        $d = preg_replace('/[\s\-()]/', '', I18n::toAscii($s));
        $d = preg_replace('/^(\+?88)/', '', $d);
        return preg_match('/^01[3-9]\d{8}$/', $d) ? $d : null;
    }

    /** Normalised ISBN-10/13 (digits, X) when the check digit is right. */
    public static function isbn(?string $s): ?string
    {
        if ($s === null) {
            return null;
        }
        $d = strtoupper(preg_replace('/[\s\-]/', '', I18n::toAscii($s)));
        if (preg_match('/^\d{13}$/', $d)) {
            $sum = 0;
            for ($i = 0; $i < 12; $i++) {
                $sum += (int) $d[$i] * ($i % 2 ? 3 : 1);
            }
            return (10 - $sum % 10) % 10 === (int) $d[12] ? $d : null;
        }
        if (preg_match('/^\d{9}[\dX]$/', $d)) {
            $sum = 0;
            for ($i = 0; $i < 10; $i++) {
                $sum += ($d[$i] === 'X' ? 10 : (int) $d[$i]) * (10 - $i);
            }
            return $sum % 11 === 0 ? $d : null;
        }
        return null;
    }
}
