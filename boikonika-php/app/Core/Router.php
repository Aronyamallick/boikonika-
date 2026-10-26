<?php
declare(strict_types=1);

namespace App\Core;

final class Router
{
    /** @var list<array{method:string,regex:string,keys:list<string>,handler:string,opts:array}> */
    private array $routes = [];
    private array $group = [];

    public function get(string $pattern, string $handler, array $opts = []): void
    {
        $this->add('GET', $pattern, $handler, $opts);
    }

    public function post(string $pattern, string $handler, array $opts = []): void
    {
        $this->add('POST', $pattern, $handler, $opts);
    }

    /** Applies options (auth, seller, perm…) to every route registered in $fn. */
    public function group(array $opts, callable $fn): void
    {
        $prev = $this->group;
        $this->group = array_merge($prev, $opts);
        $fn($this);
        $this->group = $prev;
    }

    public function add(string $method, string $pattern, string $handler, array $opts = []): void
    {
        $prefix = $this->group['prefix'] ?? '';
        $pattern = rtrim($prefix . $pattern, '/') ?: '/';
        $keys = [];
        $regex = preg_replace_callback('/\{(\w+)(?::([^}]+))?\}/', static function (array $m) use (&$keys): string {
            $keys[] = $m[1];
            return '(' . ($m[2] ?? '[^/]+') . ')';
        }, $pattern);
        $opts = array_merge($this->group, $opts);
        unset($opts['prefix']);
        $this->routes[] = ['method' => $method, 'regex' => '#^' . $regex . '$#u', 'keys' => $keys, 'handler' => $handler, 'opts' => $opts];
    }

    /** @return array{handler:string,params:array,opts:array}|null|false  false = path exists for another method */
    public function match(string $method, string $path): array|null|false
    {
        $path = $path !== '/' ? rtrim($path, '/') : '/';
        $other = false;
        foreach ($this->routes as $r) {
            if (!preg_match($r['regex'], $path, $m)) {
                continue;
            }
            if ($r['method'] !== $method && !($method === 'HEAD' && $r['method'] === 'GET')) {
                $other = true;
                continue;
            }
            $params = [];
            foreach ($r['keys'] as $i => $k) {
                $params[$k] = $m[$i + 1];
            }
            return ['handler' => $r['handler'], 'params' => $params, 'opts' => $r['opts']];
        }
        return $other ? false : null;
    }
}
