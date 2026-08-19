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

/**
 * Rough centre of each province, used only to frame a map view when a filter
 * selects a region that holds no listings yet. These are approximate anchors
 * for camera placement, not survey centroids, and nothing is measured off them.
 */
export const NEPAL_PROVINCE_VIEW: Record<
  string,
  { latitude: number; longitude: number }
> = {
  Koshi: { latitude: 27.2, longitude: 87.3 },
  Madhesh: { latitude: 26.8, longitude: 85.9 },
  Bagmati: { latitude: 27.75, longitude: 85.4 },
  Gandaki: { latitude: 28.4, longitude: 84.0 },
  Lumbini: { latitude: 27.9, longitude: 82.7 },
  Karnali: { latitude: 29.3, longitude: 82.2 },
  Sudurpashchim: { latitude: 29.3, longitude: 80.8 },
};

/** The province a district belongs to, or null for an unknown name. */
export function provinceOfDistrict(district?: string | null): string | null {
  if (!district) return null;
  return (
    NEPAL_PROVINCES.find((province) =>
      (province.districts as readonly string[]).includes(district),
    )?.name ?? null
  );
}

/**
 * `assets/nepal-districts.geojson` spells four districts differently from the
 * official names used above. Mapping them here keeps one canonical spelling in
 * the app while still resolving the boundary data.
 */
const GEOJSON_DISTRICT_ALIASES: Record<string, string> = {
  DHANUSHA: "DHANUSA",
  KAVREPALANCHOK: "KAVREPALANCHOWK",
  TANAHUN: "TANAHU",
  TERHATHUM: "TEHRATHUM",
};

/** The key a district has in the boundary file. */
export function districtBoundaryKey(district: string): string {
  const upper = district.trim().toUpperCase();
  return GEOJSON_DISTRICT_ALIASES[upper] ?? upper;
}
