export interface CountryInfo {
  code: string;
  name: string;
  continent: string;
  region: string;
  flag: string;
}

export const CONTINENTS = ["North America", "South America", "Europe", "Asia", "Africa", "Oceania"] as const;
export type Continent = typeof CONTINENTS[number];

export const COUNTRIES: CountryInfo[] = [
  // North America
  { code: "US", name: "United States", continent: "North America", region: "Northern America", flag: "🇺🇸" },
  { code: "CA", name: "Canada", continent: "North America", region: "Northern America", flag: "🇨🇦" },
  { code: "MX", name: "Mexico", continent: "North America", region: "Central America", flag: "🇲🇽" },
  { code: "GT", name: "Guatemala", continent: "North America", region: "Central America", flag: "🇬🇹" },
  { code: "HN", name: "Honduras", continent: "North America", region: "Central America", flag: "🇭🇳" },
  { code: "SV", name: "El Salvador", continent: "North America", region: "Central America", flag: "🇸🇻" },
  { code: "NI", name: "Nicaragua", continent: "North America", region: "Central America", flag: "🇳🇮" },
  { code: "CR", name: "Costa Rica", continent: "North America", region: "Central America", flag: "🇨🇷" },
  { code: "PA", name: "Panama", continent: "North America", region: "Central America", flag: "🇵🇦" },
  { code: "BZ", name: "Belize", continent: "North America", region: "Central America", flag: "🇧🇿" },
  { code: "CU", name: "Cuba", continent: "North America", region: "Caribbean", flag: "🇨🇺" },
  { code: "JM", name: "Jamaica", continent: "North America", region: "Caribbean", flag: "🇯🇲" },
  { code: "HT", name: "Haiti", continent: "North America", region: "Caribbean", flag: "🇭🇹" },
  { code: "DO", name: "Dominican Republic", continent: "North America", region: "Caribbean", flag: "🇩🇴" },
  { code: "TT", name: "Trinidad and Tobago", continent: "North America", region: "Caribbean", flag: "🇹🇹" },
  { code: "BS", name: "Bahamas", continent: "North America", region: "Caribbean", flag: "🇧🇸" },
  { code: "BB", name: "Barbados", continent: "North America", region: "Caribbean", flag: "🇧🇧" },
  { code: "PR", name: "Puerto Rico", continent: "North America", region: "Caribbean", flag: "🇵🇷" },

  // South America
  { code: "BR", name: "Brazil", continent: "South America", region: "South America", flag: "🇧🇷" },
  { code: "AR", name: "Argentina", continent: "South America", region: "South America", flag: "🇦🇷" },
  { code: "CO", name: "Colombia", continent: "South America", region: "South America", flag: "🇨🇴" },
  { code: "CL", name: "Chile", continent: "South America", region: "South America", flag: "🇨🇱" },
  { code: "PE", name: "Peru", continent: "South America", region: "South America", flag: "🇵🇪" },
  { code: "VE", name: "Venezuela", continent: "South America", region: "South America", flag: "🇻🇪" },
  { code: "EC", name: "Ecuador", continent: "South America", region: "South America", flag: "🇪🇨" },
  { code: "BO", name: "Bolivia", continent: "South America", region: "South America", flag: "🇧🇴" },
  { code: "PY", name: "Paraguay", continent: "South America", region: "South America", flag: "🇵🇾" },
  { code: "UY", name: "Uruguay", continent: "South America", region: "South America", flag: "🇺🇾" },
  { code: "GY", name: "Guyana", continent: "South America", region: "South America", flag: "🇬🇾" },
  { code: "SR", name: "Suriname", continent: "South America", region: "South America", flag: "🇸🇷" },

  // Europe (EU + key non-EU)
  { code: "GB", name: "United Kingdom", continent: "Europe", region: "Western Europe", flag: "🇬🇧" },
  { code: "FR", name: "France", continent: "Europe", region: "Western Europe", flag: "🇫🇷" },
  { code: "DE", name: "Germany", continent: "Europe", region: "Western Europe", flag: "🇩🇪" },
  { code: "IT", name: "Italy", continent: "Europe", region: "Southern Europe", flag: "🇮🇹" },
  { code: "ES", name: "Spain", continent: "Europe", region: "Southern Europe", flag: "🇪🇸" },
  { code: "PT", name: "Portugal", continent: "Europe", region: "Southern Europe", flag: "🇵🇹" },
  { code: "NL", name: "Netherlands", continent: "Europe", region: "Western Europe", flag: "🇳🇱" },
  { code: "BE", name: "Belgium", continent: "Europe", region: "Western Europe", flag: "🇧🇪" },
  { code: "AT", name: "Austria", continent: "Europe", region: "Western Europe", flag: "🇦🇹" },
  { code: "CH", name: "Switzerland", continent: "Europe", region: "Western Europe", flag: "🇨🇭" },
  { code: "SE", name: "Sweden", continent: "Europe", region: "Northern Europe", flag: "🇸🇪" },
  { code: "NO", name: "Norway", continent: "Europe", region: "Northern Europe", flag: "🇳🇴" },
  { code: "DK", name: "Denmark", continent: "Europe", region: "Northern Europe", flag: "🇩🇰" },
  { code: "FI", name: "Finland", continent: "Europe", region: "Northern Europe", flag: "🇫🇮" },
  { code: "IE", name: "Ireland", continent: "Europe", region: "Northern Europe", flag: "🇮🇪" },
  { code: "PL", name: "Poland", continent: "Europe", region: "Eastern Europe", flag: "🇵🇱" },
  { code: "CZ", name: "Czech Republic", continent: "Europe", region: "Eastern Europe", flag: "🇨🇿" },
  { code: "RO", name: "Romania", continent: "Europe", region: "Eastern Europe", flag: "🇷🇴" },
  { code: "HU", name: "Hungary", continent: "Europe", region: "Eastern Europe", flag: "🇭🇺" },
  { code: "GR", name: "Greece", continent: "Europe", region: "Southern Europe", flag: "🇬🇷" },
  { code: "BG", name: "Bulgaria", continent: "Europe", region: "Eastern Europe", flag: "🇧🇬" },
  { code: "HR", name: "Croatia", continent: "Europe", region: "Southern Europe", flag: "🇭🇷" },
  { code: "SK", name: "Slovakia", continent: "Europe", region: "Eastern Europe", flag: "🇸🇰" },
  { code: "SI", name: "Slovenia", continent: "Europe", region: "Southern Europe", flag: "🇸🇮" },
  { code: "LT", name: "Lithuania", continent: "Europe", region: "Northern Europe", flag: "🇱🇹" },
  { code: "LV", name: "Latvia", continent: "Europe", region: "Northern Europe", flag: "🇱🇻" },
  { code: "EE", name: "Estonia", continent: "Europe", region: "Northern Europe", flag: "🇪🇪" },
  { code: "CY", name: "Cyprus", continent: "Europe", region: "Southern Europe", flag: "🇨🇾" },
  { code: "LU", name: "Luxembourg", continent: "Europe", region: "Western Europe", flag: "🇱🇺" },
  { code: "MT", name: "Malta", continent: "Europe", region: "Southern Europe", flag: "🇲🇹" },
  { code: "UA", name: "Ukraine", continent: "Europe", region: "Eastern Europe", flag: "🇺🇦" },
  { code: "RS", name: "Serbia", continent: "Europe", region: "Southern Europe", flag: "🇷🇸" },
  { code: "BA", name: "Bosnia and Herzegovina", continent: "Europe", region: "Southern Europe", flag: "🇧🇦" },
  { code: "ME", name: "Montenegro", continent: "Europe", region: "Southern Europe", flag: "🇲🇪" },
  { code: "MK", name: "North Macedonia", continent: "Europe", region: "Southern Europe", flag: "🇲🇰" },
  { code: "AL", name: "Albania", continent: "Europe", region: "Southern Europe", flag: "🇦🇱" },
  { code: "MD", name: "Moldova", continent: "Europe", region: "Eastern Europe", flag: "🇲🇩" },
  { code: "IS", name: "Iceland", continent: "Europe", region: "Northern Europe", flag: "🇮🇸" },
  { code: "TR", name: "Turkey", continent: "Europe", region: "Southern Europe", flag: "🇹🇷" },
  { code: "RU", name: "Russia", continent: "Europe", region: "Eastern Europe", flag: "🇷🇺" },
  { code: "BY", name: "Belarus", continent: "Europe", region: "Eastern Europe", flag: "🇧🇾" },
  { code: "GE", name: "Georgia", continent: "Europe", region: "Eastern Europe", flag: "🇬🇪" },

  // Asia
  { code: "CN", name: "China", continent: "Asia", region: "East Asia", flag: "🇨🇳" },
  { code: "JP", name: "Japan", continent: "Asia", region: "East Asia", flag: "🇯🇵" },
  { code: "KR", name: "South Korea", continent: "Asia", region: "East Asia", flag: "🇰🇷" },
  { code: "KP", name: "North Korea", continent: "Asia", region: "East Asia", flag: "🇰🇵" },
  { code: "IN", name: "India", continent: "Asia", region: "South Asia", flag: "🇮🇳" },
  { code: "PK", name: "Pakistan", continent: "Asia", region: "South Asia", flag: "🇵🇰" },
  { code: "BD", name: "Bangladesh", continent: "Asia", region: "South Asia", flag: "🇧🇩" },
  { code: "LK", name: "Sri Lanka", continent: "Asia", region: "South Asia", flag: "🇱🇰" },
  { code: "NP", name: "Nepal", continent: "Asia", region: "South Asia", flag: "🇳🇵" },
  { code: "ID", name: "Indonesia", continent: "Asia", region: "Southeast Asia", flag: "🇮🇩" },
  { code: "TH", name: "Thailand", continent: "Asia", region: "Southeast Asia", flag: "🇹🇭" },
  { code: "VN", name: "Vietnam", continent: "Asia", region: "Southeast Asia", flag: "🇻🇳" },
  { code: "PH", name: "Philippines", continent: "Asia", region: "Southeast Asia", flag: "🇵🇭" },
  { code: "MY", name: "Malaysia", continent: "Asia", region: "Southeast Asia", flag: "🇲🇾" },
  { code: "SG", name: "Singapore", continent: "Asia", region: "Southeast Asia", flag: "🇸🇬" },
  { code: "MM", name: "Myanmar", continent: "Asia", region: "Southeast Asia", flag: "🇲🇲" },
  { code: "KH", name: "Cambodia", continent: "Asia", region: "Southeast Asia", flag: "🇰🇭" },
  { code: "LA", name: "Laos", continent: "Asia", region: "Southeast Asia", flag: "🇱🇦" },
  { code: "TW", name: "Taiwan", continent: "Asia", region: "East Asia", flag: "🇹🇼" },
  { code: "MN", name: "Mongolia", continent: "Asia", region: "East Asia", flag: "🇲🇳" },
  { code: "SA", name: "Saudi Arabia", continent: "Asia", region: "Middle East", flag: "🇸🇦" },
  { code: "AE", name: "United Arab Emirates", continent: "Asia", region: "Middle East", flag: "🇦🇪" },
  { code: "IL", name: "Israel", continent: "Asia", region: "Middle East", flag: "🇮🇱" },
  { code: "IR", name: "Iran", continent: "Asia", region: "Middle East", flag: "🇮🇷" },
  { code: "IQ", name: "Iraq", continent: "Asia", region: "Middle East", flag: "🇮🇶" },
  { code: "AF", name: "Afghanistan", continent: "Asia", region: "Central Asia", flag: "🇦🇫" },
  { code: "KZ", name: "Kazakhstan", continent: "Asia", region: "Central Asia", flag: "🇰🇿" },
  { code: "UZ", name: "Uzbekistan", continent: "Asia", region: "Central Asia", flag: "🇺🇿" },
  { code: "QA", name: "Qatar", continent: "Asia", region: "Middle East", flag: "🇶🇦" },
  { code: "KW", name: "Kuwait", continent: "Asia", region: "Middle East", flag: "🇰🇼" },
  { code: "OM", name: "Oman", continent: "Asia", region: "Middle East", flag: "🇴🇲" },
  { code: "BH", name: "Bahrain", continent: "Asia", region: "Middle East", flag: "🇧🇭" },
  { code: "JO", name: "Jordan", continent: "Asia", region: "Middle East", flag: "🇯🇴" },
  { code: "LB", name: "Lebanon", continent: "Asia", region: "Middle East", flag: "🇱🇧" },
  { code: "SY", name: "Syria", continent: "Asia", region: "Middle East", flag: "🇸🇾" },
  { code: "YE", name: "Yemen", continent: "Asia", region: "Middle East", flag: "🇾🇪" },

  // Africa
  { code: "ZA", name: "South Africa", continent: "Africa", region: "Southern Africa", flag: "🇿🇦" },
  { code: "NG", name: "Nigeria", continent: "Africa", region: "West Africa", flag: "🇳🇬" },
  { code: "EG", name: "Egypt", continent: "Africa", region: "North Africa", flag: "🇪🇬" },
  { code: "KE", name: "Kenya", continent: "Africa", region: "East Africa", flag: "🇰🇪" },
  { code: "ET", name: "Ethiopia", continent: "Africa", region: "East Africa", flag: "🇪🇹" },
  { code: "GH", name: "Ghana", continent: "Africa", region: "West Africa", flag: "🇬🇭" },
  { code: "TZ", name: "Tanzania", continent: "Africa", region: "East Africa", flag: "🇹🇿" },
  { code: "DZ", name: "Algeria", continent: "Africa", region: "North Africa", flag: "🇩🇿" },
  { code: "MA", name: "Morocco", continent: "Africa", region: "North Africa", flag: "🇲🇦" },
  { code: "TN", name: "Tunisia", continent: "Africa", region: "North Africa", flag: "🇹🇳" },
  { code: "SN", name: "Senegal", continent: "Africa", region: "West Africa", flag: "🇸🇳" },
  { code: "CI", name: "Ivory Coast", continent: "Africa", region: "West Africa", flag: "🇨🇮" },
  { code: "CM", name: "Cameroon", continent: "Africa", region: "Central Africa", flag: "🇨🇲" },
  { code: "UG", name: "Uganda", continent: "Africa", region: "East Africa", flag: "🇺🇬" },
  { code: "RW", name: "Rwanda", continent: "Africa", region: "East Africa", flag: "🇷🇼" },
  { code: "CD", name: "DR Congo", continent: "Africa", region: "Central Africa", flag: "🇨🇩" },
  { code: "AO", name: "Angola", continent: "Africa", region: "Southern Africa", flag: "🇦🇴" },
  { code: "MZ", name: "Mozambique", continent: "Africa", region: "Southern Africa", flag: "🇲🇿" },
  { code: "LY", name: "Libya", continent: "Africa", region: "North Africa", flag: "🇱🇾" },
  { code: "SD", name: "Sudan", continent: "Africa", region: "North Africa", flag: "🇸🇩" },

  // Oceania
  { code: "AU", name: "Australia", continent: "Oceania", region: "Oceania", flag: "🇦🇺" },
  { code: "NZ", name: "New Zealand", continent: "Oceania", region: "Oceania", flag: "🇳🇿" },
  { code: "FJ", name: "Fiji", continent: "Oceania", region: "Oceania", flag: "🇫🇯" },
  { code: "PG", name: "Papua New Guinea", continent: "Oceania", region: "Oceania", flag: "🇵🇬" },
];

export function getCountriesByContinent(continent: string): CountryInfo[] {
  return COUNTRIES.filter(c => c.continent === continent);
}

export function getCountryByCode(code: string): CountryInfo | undefined {
  return COUNTRIES.find(c => c.code === code);
}

export function searchCountries(query: string): CountryInfo[] {
  if (!query.trim()) return COUNTRIES;
  const q = query.toLowerCase();
  return COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.code.toLowerCase().includes(q) ||
    c.continent.toLowerCase().includes(q) ||
    c.region.toLowerCase().includes(q)
  );
}

export const CONTINENT_EMOJI: Record<string, string> = {
  "North America": "🌎",
  "South America": "🌎",
  "Europe": "🌍",
  "Asia": "🌏",
  "Africa": "🌍",
  "Oceania": "🌏",
};
