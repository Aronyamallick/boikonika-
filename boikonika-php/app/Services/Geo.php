<?php
declare(strict_types=1);

namespace App\Services;

/** Bangladesh's 8 divisions and 64 districts (stored in English, shown in the visitor's language). */
final class Geo
{
    public const DIVISIONS = [
        'Barishal' => ['bn' => 'বরিশাল', 'districts' => ['Barguna' => 'বরগুনা', 'Barishal' => 'বরিশাল', 'Bhola' => 'ভোলা', 'Jhalokati' => 'ঝালকাঠি', 'Patuakhali' => 'পটুয়াখালী', 'Pirojpur' => 'পিরোজপুর']],
        'Chattogram' => ['bn' => 'চট্টগ্রাম', 'districts' => ['Bandarban' => 'বান্দরবান', 'Brahmanbaria' => 'ব্রাহ্মণবাড়িয়া', 'Chandpur' => 'চাঁদপুর', 'Chattogram' => 'চট্টগ্রাম', 'Cumilla' => 'কুমিল্লা', "Cox's Bazar" => 'কক্সবাজার', 'Feni' => 'ফেনী', 'Khagrachhari' => 'খাগড়াছড়ি', 'Lakshmipur' => 'লক্ষ্মীপুর', 'Noakhali' => 'নোয়াখালী', 'Rangamati' => 'রাঙ্গামাটি']],
        'Dhaka' => ['bn' => 'ঢাকা', 'districts' => ['Dhaka' => 'ঢাকা', 'Faridpur' => 'ফরিদপুর', 'Gazipur' => 'গাজীপুর', 'Gopalganj' => 'গোপালগঞ্জ', 'Kishoreganj' => 'কিশোরগঞ্জ', 'Madaripur' => 'মাদারীপুর', 'Manikganj' => 'মানিকগঞ্জ', 'Munshiganj' => 'মুন্সিগঞ্জ', 'Narayanganj' => 'নারায়ণগঞ্জ', 'Narsingdi' => 'নরসিংদী', 'Rajbari' => 'রাজবাড়ী', 'Shariatpur' => 'শরীয়তপুর', 'Tangail' => 'টাঙ্গাইল']],
        'Khulna' => ['bn' => 'খুলনা', 'districts' => ['Bagerhat' => 'বাগেরহাট', 'Chuadanga' => 'চুয়াডাঙ্গা', 'Jashore' => 'যশোর', 'Jhenaidah' => 'ঝিনাইদহ', 'Khulna' => 'খুলনা', 'Kushtia' => 'কুষ্টিয়া', 'Magura' => 'মাগুরা', 'Meherpur' => 'মেহেরপুর', 'Narail' => 'নড়াইল', 'Satkhira' => 'সাতক্ষীরা']],
        'Mymensingh' => ['bn' => 'ময়মনসিংহ', 'districts' => ['Jamalpur' => 'জামালপুর', 'Mymensingh' => 'ময়মনসিংহ', 'Netrokona' => 'নেত্রকোনা', 'Sherpur' => 'শেরপুর']],
        'Rajshahi' => ['bn' => 'রাজশাহী', 'districts' => ['Bogura' => 'বগুড়া', 'Chapainawabganj' => 'চাঁপাইনবাবগঞ্জ', 'Joypurhat' => 'জয়পুরহাট', 'Naogaon' => 'নওগাঁ', 'Natore' => 'নাটোর', 'Pabna' => 'পাবনা', 'Rajshahi' => 'রাজশাহী', 'Sirajganj' => 'সিরাজগঞ্জ']],
        'Rangpur' => ['bn' => 'রংপুর', 'districts' => ['Dinajpur' => 'দিনাজপুর', 'Gaibandha' => 'গাইবান্ধা', 'Kurigram' => 'কুড়িগ্রাম', 'Lalmonirhat' => 'লালমনিরহাট', 'Nilphamari' => 'নীলফামারী', 'Panchagarh' => 'পঞ্চগড়', 'Rangpur' => 'রংপুর', 'Thakurgaon' => 'ঠাকুরগাঁও']],
        'Sylhet' => ['bn' => 'সিলেট', 'districts' => ['Habiganj' => 'হবিগঞ্জ', 'Moulvibazar' => 'মৌলভীবাজার', 'Sunamganj' => 'সুনামগঞ্জ', 'Sylhet' => 'সিলেট']],
    ];

    public static function divisionOf(string $district): ?string
    {
        foreach (self::DIVISIONS as $div => $d) {
            if (isset($d['districts'][$district])) {
                return $div;
            }
        }
        return null;
    }

    public static function districtName(?string $district): string
    {
        if ($district === null) {
            return '';
        }
        if (locale() === 'bn') {
            foreach (self::DIVISIONS as $d) {
                if (isset($d['districts'][$district])) {
                    return $d['districts'][$district];
                }
            }
        }
        return $district;
    }

    public static function divisionName(?string $division): string
    {
        return $division !== null && locale() === 'bn' ? (self::DIVISIONS[$division]['bn'] ?? $division) : (string) $division;
    }

    /** Grouped <select> options: division => [district => label]. */
    public static function districtOptions(): array
    {
        $out = [];
        foreach (self::DIVISIONS as $div => $d) {
            $group = [];
            foreach ($d['districts'] as $en => $bn) {
                $group[$en] = locale() === 'bn' ? $bn : $en;
            }
            asort($group);
            $out[locale() === 'bn' ? $d['bn'] : $div] = $group;
        }
        return $out;
    }

    public static function isDistrict(string $district): bool
    {
        return self::divisionOf($district) !== null;
    }
}
