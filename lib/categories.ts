import {
  Alert01Icon,
  Audit01Icon,
  Briefcase01Icon,
  Bus01Icon,
  Coffee01Icon,
  CookieIcon,
  CreditCardIcon,
  Diamond01Icon,
  Dumbbell01Icon,
  FavouriteIcon,
  GameController01Icon,
  GiftIcon,
  HealthIcon,
  Home01Icon,
  Invoice01Icon,
  Laundry,
  More01Icon,
  SchoolIcon,
  ShoppingCart01Icon,
  SmartPhone01Icon,
  TShirtIcon,
  UserGroupIcon,
  Wallet01Icon,
  Water,
} from "@hugeicons/core-free-icons";

export interface CategoryConfig {
  color: string;
  bgColor: string;
  icon: typeof More01Icon;
}

const colorToTailwind: Record<string, { color: string; bgColor: string }> = {
  default: { color: "text-slate-700 dark:text-slate-300", bgColor: "bg-slate-100 dark:bg-slate-900/30" },
  gray: { color: "text-gray-700 dark:text-gray-300", bgColor: "bg-gray-100 dark:bg-gray-900/30" },
  brown: { color: "text-amber-800 dark:text-amber-300", bgColor: "bg-amber-100 dark:bg-amber-900/30" },
  orange: { color: "text-orange-700 dark:text-orange-300", bgColor: "bg-orange-100 dark:bg-orange-900/30" },
  yellow: { color: "text-yellow-700 dark:text-yellow-300", bgColor: "bg-yellow-100 dark:bg-yellow-900/30" },
  green: { color: "text-green-700 dark:text-green-300", bgColor: "bg-green-100 dark:bg-green-900/30" },
  blue: { color: "text-blue-700 dark:text-blue-300", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
  purple: { color: "text-purple-700 dark:text-purple-300", bgColor: "bg-purple-100 dark:bg-purple-900/30" },
  pink: { color: "text-pink-700 dark:text-pink-300", bgColor: "bg-pink-100 dark:bg-pink-900/30" },
  red: { color: "text-red-700 dark:text-red-300", bgColor: "bg-red-100 dark:bg-red-900/30" },
};

export const categoryIconRegistry: Record<string, typeof More01Icon> = {
  Alert01Icon,
  Audit01Icon,
  Briefcase01Icon,
  Bus01Icon,
  Coffee01Icon,
  CookieIcon,
  CreditCardIcon,
  Diamond01Icon,
  Dumbbell01Icon,
  FavouriteIcon,
  GameController01Icon,
  GiftIcon,
  HealthIcon,
  Home01Icon,
  Invoice01Icon,
  Laundry,
  More01Icon,
  SchoolIcon,
  ShoppingCart01Icon,
  SmartPhone01Icon,
  TShirtIcon,
  UserGroupIcon,
  Wallet01Icon,
  Water,
};

export const CATEGORY_ICON_NAMES = Object.keys(categoryIconRegistry).sort();

export const CATEGORY_COLORS: { name: string; swatch: string; ring: string }[] = [
  { name: "default", swatch: "bg-slate-500", ring: "ring-slate-500" },
  { name: "gray", swatch: "bg-gray-500", ring: "ring-gray-500" },
  { name: "brown", swatch: "bg-amber-600", ring: "ring-amber-600" },
  { name: "orange", swatch: "bg-orange-500", ring: "ring-orange-500" },
  { name: "yellow", swatch: "bg-yellow-500", ring: "ring-yellow-500" },
  { name: "green", swatch: "bg-green-500", ring: "ring-green-500" },
  { name: "blue", swatch: "bg-blue-500", ring: "ring-blue-500" },
  { name: "purple", swatch: "bg-purple-500", ring: "ring-purple-500" },
  { name: "pink", swatch: "bg-pink-500", ring: "ring-pink-500" },
  { name: "red", swatch: "bg-red-500", ring: "ring-red-500" },
];

const knownCategoryIcons: Record<string, typeof More01Icon> = {
  sosial: UserGroupIcon,
  keluarga: Home01Icon,
  clothing: TShirtIcon,
  skincare: Diamond01Icon,
  "tidak terduga": Alert01Icon,
  Jajan: CookieIcon,
  Transportasi: Bus01Icon,
  Belanja: ShoppingCart01Icon,
  Tagihan: Invoice01Icon,
  Hiburan: GameController01Icon,
  Kesehatan: HealthIcon,
  Penyesuaian: Audit01Icon,
  Lainnya: More01Icon,
  Gift: GiftIcon,
  Work: Briefcase01Icon,
  Subscription: CreditCardIcon,
  Fitness: FavouriteIcon,
};

const fallbackIcons = [
  ShoppingCart01Icon,
  Bus01Icon,
  Home01Icon,
  CreditCardIcon,
  GameController01Icon,
  HealthIcon,
  GiftIcon,
  Briefcase01Icon,
  More01Icon,
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function getCategoryConfig(
  category: string,
  color?: string,
  iconName?: string | null,
): CategoryConfig {
  const icon = iconName
    ? (categoryIconRegistry[iconName] ?? knownCategoryIcons[category] ?? fallbackIcons[hashString(category) % fallbackIcons.length])
    : (knownCategoryIcons[category] ?? fallbackIcons[hashString(category) % fallbackIcons.length]);

  if (color && colorToTailwind[color]) {
    return {
      ...colorToTailwind[color],
      icon,
    };
  }

  const fallbackColorIndex = hashString(category) % Object.keys(colorToTailwind).length;
  const fallbackColorKey = Object.keys(colorToTailwind)[fallbackColorIndex];

  return {
    ...colorToTailwind[fallbackColorKey],
    icon,
  };
}
