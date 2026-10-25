/** Administrative divisions and districts of Bangladesh (8 divisions, 64 districts). */
export interface District {
  key: string;
  en: string;
  bn: string;
}
export interface Division {
  key: string;
  en: string;
  bn: string;
  districts: District[];
}

const d = (key: string, en: string, bn: string): District => ({ key, en, bn });

export const BD_DIVISIONS: Division[] = [
  {
    key: 'barishal', en: 'Barishal', bn: 'বরিশাল',
    districts: [d('barguna', 'Barguna', 'বরগুনা'), d('barishal', 'Barishal', 'বরিশাল'), d('bhola', 'Bhola', 'ভোলা'), d('jhalokati', 'Jhalokati', 'ঝালকাঠি'), d('patuakhali', 'Patuakhali', 'পটুয়াখালী'), d('pirojpur', 'Pirojpur', 'পিরোজপুর')],
  },
  {
    key: 'chattogram', en: 'Chattogram', bn: 'চট্টগ্রাম',
    districts: [d('bandarban', 'Bandarban', 'বান্দরবান'), d('brahmanbaria', 'Brahmanbaria', 'ব্রাহ্মণবাড়িয়া'), d('chandpur', 'Chandpur', 'চাঁদপুর'), d('chattogram', 'Chattogram', 'চট্টগ্রাম'), d('coxsbazar', "Cox's Bazar", 'কক্সবাজার'), d('cumilla', 'Cumilla', 'কুমিল্লা'), d('feni', 'Feni', 'ফেনী'), d('khagrachhari', 'Khagrachhari', 'খাগড়াছড়ি'), d('lakshmipur', 'Lakshmipur', 'লক্ষ্মীপুর'), d('noakhali', 'Noakhali', 'নোয়াখালী'), d('rangamati', 'Rangamati', 'রাঙ্গামাটি')],
  },
  {
    key: 'dhaka', en: 'Dhaka', bn: 'ঢাকা',
    districts: [d('dhaka', 'Dhaka', 'ঢাকা'), d('faridpur', 'Faridpur', 'ফরিদপুর'), d('gazipur', 'Gazipur', 'গাজীপুর'), d('gopalganj', 'Gopalganj', 'গোপালগঞ্জ'), d('kishoreganj', 'Kishoreganj', 'কিশোরগঞ্জ'), d('madaripur', 'Madaripur', 'মাদারীপুর'), d('manikganj', 'Manikganj', 'মানিকগঞ্জ'), d('munshiganj', 'Munshiganj', 'মুন্সীগঞ্জ'), d('narayanganj', 'Narayanganj', 'নারায়ণগঞ্জ'), d('narsingdi', 'Narsingdi', 'নরসিংদী'), d('rajbari', 'Rajbari', 'রাজবাড়ী'), d('shariatpur', 'Shariatpur', 'শরীয়তপুর'), d('tangail', 'Tangail', 'টাঙ্গাইল')],
  },
  {
    key: 'khulna', en: 'Khulna', bn: 'খুলনা',
    districts: [d('bagerhat', 'Bagerhat', 'বাগেরহাট'), d('chuadanga', 'Chuadanga', 'চুয়াডাঙ্গা'), d('jashore', 'Jashore', 'যশোর'), d('jhenaidah', 'Jhenaidah', 'ঝিনাইদহ'), d('khulna', 'Khulna', 'খুলনা'), d('kushtia', 'Kushtia', 'কুষ্টিয়া'), d('magura', 'Magura', 'মাগুরা'), d('meherpur', 'Meherpur', 'মেহেরপুর'), d('narail', 'Narail', 'নড়াইল'), d('satkhira', 'Satkhira', 'সাতক্ষীরা')],
  },
  {
    key: 'mymensingh', en: 'Mymensingh', bn: 'ময়মনসিংহ',
    districts: [d('jamalpur', 'Jamalpur', 'জামালপুর'), d('mymensingh', 'Mymensingh', 'ময়মনসিংহ'), d('netrokona', 'Netrokona', 'নেত্রকোণা'), d('sherpur', 'Sherpur', 'শেরপুর')],
  },
  {
    key: 'rajshahi', en: 'Rajshahi', bn: 'রাজশাহী',
    districts: [d('bogura', 'Bogura', 'বগুড়া'), d('chapainawabganj', 'Chapai Nawabganj', 'চাঁপাইনবাবগঞ্জ'), d('joypurhat', 'Joypurhat', 'জয়পুরহাট'), d('naogaon', 'Naogaon', 'নওগাঁ'), d('natore', 'Natore', 'নাটোর'), d('pabna', 'Pabna', 'পাবনা'), d('rajshahi', 'Rajshahi', 'রাজশাহী'), d('sirajganj', 'Sirajganj', 'সিরাজগঞ্জ')],
  },
  {
    key: 'rangpur', en: 'Rangpur', bn: 'রংপুর',
    districts: [d('dinajpur', 'Dinajpur', 'দিনাজপুর'), d('gaibandha', 'Gaibandha', 'গাইবান্ধা'), d('kurigram', 'Kurigram', 'কুড়িগ্রাম'), d('lalmonirhat', 'Lalmonirhat', 'লালমনিরহাট'), d('nilphamari', 'Nilphamari', 'নীলফামারী'), d('panchagarh', 'Panchagarh', 'পঞ্চগড়'), d('rangpur', 'Rangpur', 'রংপুর'), d('thakurgaon', 'Thakurgaon', 'ঠাকুরগাঁও')],
  },
  {
    key: 'sylhet', en: 'Sylhet', bn: 'সিলেট',
    districts: [d('habiganj', 'Habiganj', 'হবিগঞ্জ'), d('moulvibazar', 'Moulvibazar', 'মৌলভীবাজার'), d('sunamganj', 'Sunamganj', 'সুনামগঞ্জ'), d('sylhet', 'Sylhet', 'সিলেট')],
  },
];

export const BD_DISTRICT_KEYS: string[] = BD_DIVISIONS.flatMap((dv) => dv.districts.map((ds) => ds.key));

export function findDivision(key: string): Division | undefined {
  return BD_DIVISIONS.find((dv) => dv.key === key);
}

export function isDistrictInDivision(divisionKey: string, districtKey: string): boolean {
  return !!findDivision(divisionKey)?.districts.some((ds) => ds.key === districtKey);
}

/** Display name of a district or division key in the visitor's language (unknown keys are returned as is). */
export function placeName(key: string | null | undefined, locale: string): string {
  if (!key) return '';
  for (const dv of BD_DIVISIONS) {
    const match = dv.key === key ? dv : dv.districts.find((ds) => ds.key === key);
    if (match) return locale.startsWith('bn') ? match.bn : match.en;
  }
  return key;
}
