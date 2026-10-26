<?php
declare(strict_types=1);

/**
 * Form field helpers: label, control, hint and the error from the last submit, wired together with
 * aria-describedby / aria-invalid. Values are escaped here.
 */

function field_attrs(array $attrs): string
{
    $out = '';
    foreach ($attrs as $k => $v) {
        if ($v === false || $v === null) {
            continue;
        }
        $out .= $v === true ? ' ' . e($k) : ' ' . e($k) . '="' . e($v) . '"';
    }
    return $out;
}

function field_wrap(string $name, string $label, string $control, array $o, string $id): string
{
    $err = $o['error'] ?? error_for($name);
    $html = '<div class="field' . (isset($o['class']) ? ' ' . e($o['class']) : '') . '">';
    if ($label !== '') {
        $html .= '<label for="' . e($id) . '">' . e($label) . (!empty($o['optional']) ? ' <span class="subtle small">(' . __('common.optional') . ')</span>' : '') . '</label>';
    }
    $html .= $control;
    if (!empty($o['hint'])) {
        $html .= '<p class="hint" id="' . e($id) . '-hint">' . e($o['hint']) . '</p>';
    }
    if ($err) {
        $html .= '<p class="error" id="' . e($id) . '-error">' . icon('alert', 'icon icon-sm') . '<span>' . e($err) . '</span></p>';
    }
    return $html . '</div>';
}

function field_common(string $name, array $o, string $id): array
{
    $err = $o['error'] ?? error_for($name);
    $described = [];
    if (!empty($o['hint'])) {
        $described[] = $id . '-hint';
    }
    if ($err) {
        $described[] = $id . '-error';
    }
    return [
        'id' => $id,
        'name' => $name,
        'required' => !empty($o['required']),
        'aria-invalid' => $err ? 'true' : null,
        'aria-describedby' => $described ? implode(' ', $described) : null,
    ] + ($o['attrs'] ?? []);
}

function field_id(string $name, array $o): string
{
    return $o['id'] ?? 'f-' . preg_replace('/[^a-z0-9_-]/i', '-', $name);
}

/** Text-like input. Options: type, value, hint, required, optional, autocomplete, attrs, id, error. */
function form_input(string $name, string $label, array $o = []): string
{
    $id = field_id($name, $o);
    $type = $o['type'] ?? 'text';
    $value = $type === 'password' ? '' : old($name, $o['value'] ?? '');
    $attrs = ['type' => $type] + field_common($name, $o, $id) + ['value' => $value, 'autocomplete' => $o['autocomplete'] ?? null];
    if ($type === 'password') {
        $control = '<div class="password-wrap"><input' . field_attrs($attrs) . '><button type="button" data-toggle-password="' . e($id) . '" aria-pressed="false" aria-label="' . __('common.showPassword') . '">' . icon('eye') . '</button></div>';
    } else {
        $control = '<input' . field_attrs($attrs) . '>';
    }
    return field_wrap($name, $label, $control, $o, $id);
}

function form_textarea(string $name, string $label, array $o = []): string
{
    $id = field_id($name, $o);
    $attrs = field_common($name, $o, $id) + ['rows' => $o['rows'] ?? 4];
    return field_wrap($name, $label, '<textarea' . field_attrs($attrs) . '>' . e(old($name, $o['value'] ?? '')) . '</textarea>', $o, $id);
}

/** Options: options (value => label), value, placeholder, …  */
function form_select(string $name, string $label, array $options, array $o = []): string
{
    $id = field_id($name, $o);
    $current = old($name, (string) ($o['value'] ?? ''));
    $html = '<select' . field_attrs(field_common($name, $o, $id)) . '>';
    if (isset($o['placeholder'])) {
        $html .= '<option value="">' . e($o['placeholder']) . '</option>';
    }
    foreach ($options as $v => $l) {
        if (is_array($l)) {
            $html .= '<optgroup label="' . e($v) . '">';
            foreach ($l as $v2 => $l2) {
                $html .= '<option value="' . e($v2) . '"' . selected($v2, $current) . '>' . e($l2) . '</option>';
            }
            $html .= '</optgroup>';
            continue;
        }
        $html .= '<option value="' . e($v) . '"' . selected($v, $current) . '>' . e($l) . '</option>';
    }
    return field_wrap($name, $label, $html . '</select>', $o, $id);
}

function form_check(string $name, string $label, bool $checked = false, array $o = []): string
{
    $id = field_id($name, $o);
    $old = \App\Core\Session::flashed('_old');
    $on = is_array($old) && $old !== [] ? isset($old[$name]) : $checked;
    $attrs = ['type' => 'checkbox', 'value' => $o['value'] ?? '1', 'checked' => $on] + field_common($name, $o, $id);
    $control = '<label class="check" for="' . e($id) . '"><input' . field_attrs($attrs) . '><span>' . ($o['html'] ?? e($label)) . '</span></label>';
    return field_wrap($name, '', $control, $o, $id);
}

function form_file(string $name, string $label, array $o = []): string
{
    $id = field_id($name, $o);
    $attrs = ['type' => 'file', 'accept' => $o['accept'] ?? 'image/jpeg,image/png,image/webp,image/gif'] + field_common($name, $o, $id);
    if (!empty($o['multiple'])) {
        $attrs['name'] = $name . '[]';
        $attrs['multiple'] = true;
    }
    if (!empty($o['preview'])) {
        $attrs['data-preview'] = $id . '-preview';
    }
    $control = '<input' . field_attrs($attrs) . '>' . (!empty($o['preview']) ? '<div class="thumb-grid" id="' . e($id) . '-preview"></div>' : '');
    return field_wrap($name, $label, $control, $o, $id);
}

function submit_button(string $label, string $class = 'btn btn-primary', array $attrs = []): string
{
    return '<button type="submit" class="' . e($class) . '"' . field_attrs($attrs) . '>' . e($label) . '</button>';
}
