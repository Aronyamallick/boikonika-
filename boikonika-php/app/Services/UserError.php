<?php
declare(strict_types=1);

namespace App\Services;

/** A problem the person can fix (message is a translation key), as opposed to a bug. */
final class UserError extends \RuntimeException
{
    public function __construct(public readonly string $key, public readonly array $params = [])
    {
        parent::__construct($key);
    }

    public function text(): string
    {
        return t($this->key, $this->params);
    }
}
