import type { SelectColor } from "@notionhq/client/build/src/api-endpoints/common";
import {
  UserGroupIcon,
  Home01Icon,
  TShirtIcon,
  Diamond01Icon,
  Alert01Icon,
  CookieIcon,
  Bus01Icon,
  ShoppingCart01Icon,
  Invoice01Icon,
  GameController01Icon,
  HealthIcon,
  More01Icon,
  GiftIcon,
  Briefcase01Icon,
  CreditCardIcon,
  FavouriteIcon,
} from "@hugeicons/core-free-icons";

export interface CategoryOption {
  id: string;
  name: string;
  color: SelectColor;
}

export interface CategoryConfig {
  color: string;
  bgColor: string;
  icon: typeof More01Icon;
}

const notionColorToTailwind: Record<SelectColor, { color: string; bgColor: string }> = {
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

export function getCategoryConfig(category: string, notionColor?: SelectColor): CategoryConfig {
  const icon = knownCategoryIcons[category] ?? fallbackIcons[hashString(category) % fallbackIcons.length];
  
  if (notionColor && notionColorToTailwind[notionColor]) {
    return {
      ...notionColorToTailwind[notionColor],
      icon,
    };
  }
  
  const fallbackColorIndex = hashString(category) % Object.keys(notionColorToTailwind).length;
  const fallbackColorKey = Object.keys(notionColorToTailwind)[fallbackColorIndex] as SelectColor;
  
  return {
    ...notionColorToTailwind[fallbackColorKey],
    icon,
  };
}

export function getNotionColorToTailwind(color: SelectColor): { color: string; bgColor: string } {
  return notionColorToTailwind[color] ?? notionColorToTailwind.default;
}