/**
 * Nepal's federal structure: 7 provinces and the 77 districts inside them.
 * Names follow the current official spellings, so a value stored against a
 * listing address matches a filter selection exactly.
 */
export const NEPAL_PROVINCES = [
  {
    name: "Koshi",
    districts: [
      "Bhojpur",
      "Dhankuta",
      "Ilam",
      "Jhapa",
      "Khotang",
      "Morang",
      "Okhaldhunga",
      "Panchthar",
      "Sankhuwasabha",
      "Solukhumbu",
      "Sunsari",
      "Taplejung",
      "Terhathum",
      "Udayapur",
    ],
  },
  {
    name: "Madhesh",
    districts: [
      "Bara",
      "Dhanusha",
      "Mahottari",
      "Parsa",
      "Rautahat",
      "Saptari",
      "Sarlahi",
      "Siraha",
    ],
  },
  {
    name: "Bagmati",
    districts: [
      "Bhaktapur",
      "Chitwan",
      "Dhading",
      "Dolakha",
      "Kathmandu",
      "Kavrepalanchok",
      "Lalitpur",
      "Makwanpur",
      "Nuwakot",
      "Ramechhap",
      "Rasuwa",
      "Sindhuli",
      "Sindhupalchok",
    ],
  },
  {
    name: "Gandaki",
    districts: [
      "Baglung",
      "Gorkha",
      "Kaski",
      "Lamjung",
      "Manang",
      "Mustang",
      "Myagdi",
      "Nawalpur",
      "Parbat",
      "Syangja",
      "Tanahun",
    ],
  },
  {
    name: "Lumbini",
    districts: [
      "Arghakhanchi",
      "Banke",
      "Bardiya",
      "Dang",
      "Eastern Rukum",
      "Gulmi",
      "Kapilvastu",
      "Palpa",
      "Parasi",
      "Pyuthan",
      "Rolpa",
      "Rupandehi",
    ],
  },
  {
    name: "Karnali",
    districts: [
      "Dailekh",
      "Dolpa",
      "Humla",
      "Jajarkot",
      "Jumla",
      "Kalikot",
      "Mugu",
      "Salyan",
      "Surkhet",
      "Western Rukum",
    ],
  },
  {
    name: "Sudurpashchim",
    districts: [
      "Achham",
      "Baitadi",
      "Bajhang",
      "Bajura",
      "Dadeldhura",
      "Darchula",
      "Doti",
      "Kailali",
      "Kanchanpur",
    ],
  },
] as const;

export type NepalProvince = (typeof NEPAL_PROVINCES)[number]["name"];

export const NEPAL_PROVINCE_NAMES: readonly string[] = NEPAL_PROVINCES.map(
  (province) => province.name,
);

export const NEPAL_DISTRICT_NAMES: readonly string[] = NEPAL_PROVINCES.flatMap(
  (province) => province.districts,
);

/** Districts of one province, or every district when none is chosen. */
export function districtsOfProvince(province?: string | null): readonly string[] {
  if (!province) return NEPAL_DISTRICT_NAMES;
  return (
    NEPAL_PROVINCES.find((entry) => entry.name === province)?.districts ?? []
  );
}
