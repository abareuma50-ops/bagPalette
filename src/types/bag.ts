export type BudgetRange =
  | "under_10k"
  | "10k_20k"
  | "20k_30k"
  | "30k_50k"
  | "over_50k"
  | "any";

export type SizeCategory = "mini" | "small" | "medium" | "large";

export type ColorOption =
  | "black"
  | "gray"
  | "navy"
  | "beige_khaki"
  | "brown_camel"
  | "white_ivory"
  | "pastel_other";

export interface SearchFilters {
  budget: BudgetRange;
  size: SizeCategory;
  colors: ColorOption[];
}

export interface BagItem {
  id: string;
  brand: string;
  modelName: string;
  price: number;
  priceFormatted: string;
  imageUrl: string;
  productUrl: string;
  rakutenSearchUrl: string;
  googleSearchUrl: string;
  size: SizeCategory;
  color: ColorOption;
  colorLabel: string;
  material: string;
  styleTags: string[];
  description: string;
  dimensions: string;
  weight: string;
  source: "gemini_grounded";
}

export interface RoundRecord {
  round: number;
  shownIds: string[];
  selectedIds: string[];
  selectedNames: string[];
  rejectedNames: string[];
  memoAtTurn?: string;
}

export type ConfidenceLevel = "exploring" | "narrowing" | "high";

export interface PreferenceProfile {
  summary: string;
  preferredMaterials: string[];
  preferredForms: string[];
  avoidedTendencies: string[];
  roundCount: number;
  totalChecked: number;
  confidenceLevel: ConfidenceLevel;
  confidenceScore: number;
  userMemo: string;
  roundHistory: RoundRecord[];
}

export interface PaletteApiRequest {
  filters: SearchFilters;
  excludedProductIds: string[];
  excludedModelNames: string[];
  selectedBagsFromPreviousRound: BagItem[];
  rejectedBagsFromPreviousRound: BagItem[];
  currentProfile: PreferenceProfile;
  userMemo: string;
  apiKeys?: {
    geminiApiKey?: string;
  };
}

export interface PaletteApiResponse {
  bags: BagItem[];
  updatedProfile: PreferenceProfile;
  mode: "gemini_grounded";
  notice?: string;
}

export const BUDGET_OPTIONS: {
  value: BudgetRange;
  label: string;
  min?: number;
  max?: number;
}[] = [
  { value: "under_10k", label: "〜1万円", min: 0, max: 10000 },
  { value: "10k_20k", label: "1万〜2万円", min: 10000, max: 20000 },
  { value: "20k_30k", label: "2万〜3万円", min: 20000, max: 30000 },
  { value: "30k_50k", label: "3万〜5万円", min: 30000, max: 50000 },
  { value: "over_50k", label: "5万円以上", min: 50000 },
  { value: "any", label: "指定なし" },
];

export const SIZE_OPTIONS: {
  value: SizeCategory;
  shortLabel: string;
  label: string;
  detail: string;
}[] = [
  {
    value: "mini",
    shortLabel: "ミニ",
    label: "ミニ・スマホポーチ",
    detail: "スマホ・ミニ財布・リップ",
  },
  {
    value: "small",
    shortLabel: "S",
    label: "S・普段使い",
    detail: "500mlペットボトル・長財布",
  },
  {
    value: "medium",
    shortLabel: "M",
    label: "M・通勤/A4",
    detail: "13〜14インチPC・書類",
  },
  {
    value: "large",
    shortLabel: "L",
    label: "L・大容量/1泊",
    detail: "15インチPC・1泊旅行",
  },
];

export const COLOR_SWATCHES: {
  value: ColorOption;
  label: string;
  hex: string;
  ringHex: string;
  isLight?: boolean;
  gradient?: string;
}[] = [
  {
    value: "black",
    label: "ブラック",
    hex: "#2C282B",
    ringHex: "#4A4348",
  },
  {
    value: "gray",
    label: "グレー",
    hex: "#9B969C",
    ringHex: "#B8B2B8",
  },
  {
    value: "navy",
    label: "ネイビー",
    hex: "#2B3D5B",
    ringHex: "#4A6187",
  },
  {
    value: "beige_khaki",
    label: "ベージュ/カーキ",
    hex: "#D5C3AA",
    ringHex: "#B8A58B",
    gradient: "linear-gradient(135deg, #DFCFC0 0%, #9E9B7B 100%)",
  },
  {
    value: "brown_camel",
    label: "ブラウン/キャメル",
    hex: "#A86E44",
    ringHex: "#8C5833",
    gradient: "linear-gradient(135deg, #C68B59 0%, #7B4B2A 100%)",
  },
  {
    value: "white_ivory",
    label: "ホワイト/アイボリー",
    hex: "#FAF6F0",
    ringHex: "#DFD5C8",
    isLight: true,
  },
  {
    value: "pastel_other",
    label: "パステル/その他",
    hex: "#F2B8C6",
    ringHex: "#E397AA",
    gradient: "linear-gradient(135deg, #F7C5D0 0%, #D9C6EC 50%, #BFE3DC 100%)",
  },
];

export const INITIAL_PREFERENCE_PROFILE: PreferenceProfile = {
  summary:
    "まだ好みは分析中です。直感で「いいな」と思ったカバンを1つ以上タップして教えてください。",
  preferredMaterials: [],
  preferredForms: [],
  avoidedTendencies: [],
  roundCount: 0,
  totalChecked: 0,
  confidenceLevel: "exploring",
  confidenceScore: 15,
  userMemo: "",
  roundHistory: [],
};
