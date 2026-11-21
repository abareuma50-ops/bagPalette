import { GoogleGenAI } from "@google/genai";
import { FALLBACK_BAGS } from "@/data/fallbackBags";
import {
  BUDGET_OPTIONS,
  BagItem,
  BudgetRange,
  COLOR_SWATCHES,
  ColorOption,
  ConfidenceLevel,
  PaletteApiRequest,
  PaletteApiResponse,
  PreferenceProfile,
  SIZE_OPTIONS,
  SearchFilters,
  SizeCategory,
} from "@/types/bag";

function normalizeName(brand: string, modelName: string): string {
  return `${brand} ${modelName}`.toLowerCase().replace(/\s+/g, " ").trim();
}

function matchesBudget(price: number, budget: BudgetRange): boolean {
  if (budget === "any") return true;
  const opt = BUDGET_OPTIONS.find((b) => b.value === budget);
  if (!opt) return true;
  if (opt.min !== undefined && price < opt.min) return false;
  if (opt.max !== undefined && price > opt.max) return false;
  return true;
}

function computeConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 75) return "high";
  if (score >= 45) return "narrowing";
  return "exploring";
}

function uniqueMerge(base: string[], additions: string[], limit = 6): string[] {
  const set = new Set(base);
  for (const item of additions) {
    if (item && set.size < limit) set.add(item);
  }
  return Array.from(set).slice(0, limit);
}

export function simulateProfileUpdate(
  req: PaletteApiRequest
): PreferenceProfile {
  const {
    currentProfile,
    selectedBagsFromPreviousRound,
    rejectedBagsFromPreviousRound,
    userMemo,
  } = req;

  const isInitialRound =
    selectedBagsFromPreviousRound.length === 0 &&
    rejectedBagsFromPreviousRound.length === 0;

  if (isInitialRound) {
    return {
      ...currentProfile,
      userMemo,
    };
  }

  const nextRound = currentProfile.roundCount + 1;
  const shownInPrev =
    selectedBagsFromPreviousRound.length + rejectedBagsFromPreviousRound.length;
  const nextTotalChecked = currentProfile.totalChecked + shownInPrev;

  const newMaterials: string[] = [];
  const newForms: string[] = [];
  const newAvoided: string[] = [];

  for (const bag of selectedBagsFromPreviousRound) {
    const text = `${bag.material} ${bag.modelName} ${bag.description}`;
    if (text.includes("革") || text.includes("レザー")) {
      newMaterials.push("本革・レザー");
    } else if (text.includes("ナイロン") || text.includes("ポリエステル")) {
      newMaterials.push("軽量ナイロン・撥水");
    } else if (text.includes("キャンバス")) {
      newMaterials.push("キャンバス");
    } else if (text.includes("合皮") || text.includes("PVC") || text.includes("PU")) {
      newMaterials.push("お手入れ楽な合皮/PVC");
    }
    if (text.includes("2way") || text.includes("2WAY")) newForms.push("2WAY");
    if (text.includes("自立")) newForms.push("自立する");
    if (text.includes("軽")) newForms.push("軽量");
    if (text.includes("A4") || text.includes("PC")) newForms.push("A4/PC対応");
    if (text.includes("ショルダー")) newForms.push("ショルダー");
    if (text.includes("トート")) newForms.push("トート");
    for (const tag of bag.styleTags) {
      if (tag !== "楽天市場" && tag !== "実在モデル") {
        newForms.push(tag);
      }
    }
  }

  const selectedTags = new Set(
    selectedBagsFromPreviousRound.flatMap((b) => b.styleTags)
  );
  for (const bag of rejectedBagsFromPreviousRound) {
    if (
      bag.price > 45000 &&
      !selectedBagsFromPreviousRound.some((s) => s.price > 45000)
    ) {
      newAvoided.push("高価格帯");
    }
    for (const tag of bag.styleTags) {
      if (!selectedTags.has(tag) && newAvoided.length < 4) {
        if (tag === "プチプラ") newAvoided.push("カジュアルすぎ");
        if (tag === "リュック") newAvoided.push("スポーティ系");
      }
    }
  }

  const memo = userMemo.trim();
  if (memo) {
    if (memo.includes("カジュアル")) newForms.push("カジュアル");
    if (memo.includes("きれいめ") || memo.includes("通勤"))
      newForms.push("きれいめ");
    if (memo.includes("自立")) newForms.push("自立する");
    if (memo.includes("軽")) newForms.push("軽量");
    if (memo.includes("本革") || memo.includes("レザー"))
      newMaterials.push("本革・レザー");
    if (memo.includes("ナイロン")) newMaterials.push("軽量ナイロン・撥水");
    if (memo.includes("2WAY")) newForms.push("2WAY");
  }

  const preferredMaterials = uniqueMerge(
    currentProfile.preferredMaterials,
    newMaterials,
    5
  );
  const preferredForms = uniqueMerge(
    currentProfile.preferredForms,
    newForms,
    6
  );
  const avoidedTendencies = uniqueMerge(
    currentProfile.avoidedTendencies,
    newAvoided,
    4
  );

  const delta = selectedBagsFromPreviousRound.length > 0 ? 18 : 6;
  const confidenceScore = Math.min(
    96,
    Math.max(15, currentProfile.confidenceScore + delta)
  );
  const confidenceLevel = computeConfidenceLevel(confidenceScore);

  const matText =
    preferredMaterials.length > 0
      ? preferredMaterials.slice(0, 2).join("・")
      : "使い心地のよい素材";
  const formText =
    preferredForms.length > 0
      ? preferredForms.slice(0, 3).join("・")
      : "バランスの良いフォルム";

  let summary = "";
  if (selectedBagsFromPreviousRound.length === 0) {
    summary = `第${nextRound}ラウンドではお好みに合うものがありませんでした。条件を少し広げつつ、${matText}や異なるシルエットをご提案します。`;
  } else {
    summary = `${matText}の質感に惹かれる傾向が見えてきました。「${formText}」の要素を備えた、上品で実用的なバッグを好まれるようです。`;
  }
  if (memo) {
    summary += `（「${memo}」のご希望も反映中）`;
  }

  const prevRecord = {
    round: nextRound,
    shownIds: [
      ...selectedBagsFromPreviousRound.map((b) => b.id),
      ...rejectedBagsFromPreviousRound.map((b) => b.id),
    ],
    selectedIds: selectedBagsFromPreviousRound.map((b) => b.id),
    selectedNames: selectedBagsFromPreviousRound.map(
      (b) => `${b.brand} ${b.modelName}`
    ),
    rejectedNames: rejectedBagsFromPreviousRound.map(
      (b) => `${b.brand} ${b.modelName}`
    ),
    memoAtTurn: memo || undefined,
  };

  return {
    summary,
    preferredMaterials,
    preferredForms,
    avoidedTendencies,
    roundCount: nextRound,
    totalChecked: nextTotalChecked,
    confidenceLevel,
    confidenceScore,
    userMemo: memo,
    roundHistory: [...currentProfile.roundHistory, prevRecord],
  };
}

const SIZE_SEARCH_TERMS: Record<SizeCategory, string> = {
  mini: "レディース ミニショルダー スマホポーチ",
  small: "レディース トートバッグ ミニ 普段使い",
  medium: "レディース トートバッグ A4 通勤",
  large: "レディース ボストンバッグ 大容量 旅行",
};

const COLOR_SEARCH_TERMS: Record<ColorOption, string> = {
  black: "ブラック",
  gray: "グレー",
  navy: "ネイビー",
  beige_khaki: "ベージュ",
  brown_camel: "キャメル",
  white_ivory: "アイボリー",
  pastel_other: "ピンク",
};

function buildDynamicSearchKeyword(
  filters: SearchFilters,
  profile: PreferenceProfile,
  userMemo: string,
  roundCount: number
): string {
  const parts: string[] = [SIZE_SEARCH_TERMS[filters.size] ?? "レディース バッグ"];

  if (filters.colors.length > 0) {
    const colorIdx = roundCount % filters.colors.length;
    parts.push(COLOR_SEARCH_TERMS[filters.colors[colorIdx]]);
  }

  if (userMemo.trim()) {
    parts.push(userMemo.trim().slice(0, 24));
  } else if (profile.preferredMaterials.length > 0) {
    const mat = profile.preferredMaterials[0];
    if (mat.includes("革")) parts.push("本革");
    else if (mat.includes("ナイロン")) parts.push("ナイロン");
  }

  return parts.join(" ");
}

function scoreBagForUser(
  bag: BagItem,
  filters: SearchFilters,
  profile: PreferenceProfile,
  userMemo: string
): number {
  let score = 0;

  if (bag.size === filters.size) score += 40;
  if (matchesBudget(bag.price, filters.budget)) score += 30;
  if (filters.colors.length === 0 || filters.colors.includes(bag.color)) {
    score += 25;
  }

  for (const mat of profile.preferredMaterials) {
    if (
      bag.material.includes(mat) ||
      (mat.includes("革") && bag.material.includes("革")) ||
      (mat.includes("ナイロン") && bag.material.includes("ナイロン"))
    ) {
      score += 10;
    }
  }
  for (const form of profile.preferredForms) {
    if (bag.styleTags.some((t) => t.includes(form) || form.includes(t))) {
      score += 8;
    }
  }

  const memo = userMemo.trim().toLowerCase();
  if (memo) {
    const haystack =
      `${bag.brand} ${bag.modelName} ${bag.material} ${bag.styleTags.join(" ")} ${bag.description}`.toLowerCase();
    const keywords = memo.split(/[\s、,。]+/).filter((k) => k.length >= 2);
    for (const kw of keywords) {
      if (haystack.includes(kw)) score += 18;
    }
    if (memo.includes("カジュアル") && haystack.includes("カジュアル"))
      score += 15;
    if (memo.includes("きれいめ") && haystack.includes("きれいめ")) score += 15;
    if (memo.includes("自立") && haystack.includes("自立")) score += 18;
    if (
      memo.includes("軽") &&
      (haystack.includes("軽") || haystack.includes("超軽量"))
    )
      score += 15;
  }

  return score;
}

export function pickFallbackBags(
  filters: SearchFilters,
  excludedIds: Set<string>,
  excludedNames: Set<string>,
  profile: PreferenceProfile,
  userMemo: string,
  count = 4
): { bags: BagItem[]; notice?: string } {
  const unseen = FALLBACK_BAGS.filter(
    (b) =>
      !excludedIds.has(b.id) &&
      !excludedNames.has(normalizeName(b.brand, b.modelName))
  );

  if (unseen.length === 0) {
    return {
      bags: [],
      notice:
        "用意されたすべてのカバンをご覧になりました！「条件を変える」または履歴リセットで最初から選び直せます。",
    };
  }

  const scored = unseen
    .map((bag) => ({
      bag,
      score: scoreBagForUser(bag, filters, profile, userMemo),
    }))
    .sort((a, b) => b.score - a.score);

  const picked: BagItem[] = [];
  const usedBrands = new Set<string>();

  for (const item of scored) {
    if (picked.length >= count) break;
    if (!usedBrands.has(item.bag.brand) || unseen.length <= count) {
      picked.push(item.bag);
      usedBrands.add(item.bag.brand);
    }
  }
  for (const item of scored) {
    if (picked.length >= count) break;
    if (!picked.some((p) => p.id === item.bag.id)) {
      picked.push(item.bag);
    }
  }

  return { bags: picked };
}

interface RakutenItem {
  Item?: {
    itemCode?: string;
    itemName?: string;
    itemPrice?: number;
    itemUrl?: string;
    shopName?: string;
    mediumImageUrls?: { imageUrl?: string }[];
  };
}

function mapRakutenItemToBag(
  item: NonNullable<RakutenItem["Item"]>,
  filters: SearchFilters,
  brandOverride?: string,
  modelOverride?: string
): BagItem | null {
  if (!item.itemCode || !item.itemName || !item.itemUrl) return null;
  const rawImg = item.mediumImageUrls?.[0]?.imageUrl;
  if (!rawImg) return null;

  const imageUrl = rawImg
    .replace(/^http:\/\//, "https://")
    .replace(/\?_ex=\d+x\d+/, "?_ex=500x500");

  const price = item.itemPrice ?? 0;
  const brand = brandOverride || item.shopName || "楽天市場";
  const modelName = modelOverride || item.itemName.slice(0, 48);
  const q = encodeURIComponent(`${brand} ${modelName}`);

  return {
    id: item.itemCode,
    brand,
    modelName,
    price,
    priceFormatted: `¥${price.toLocaleString("ja-JP")}`,
    imageUrl,
    productUrl: item.itemUrl,
    rakutenSearchUrl: `https://search.rakuten.co.jp/search/mall/${q}/`,
    googleSearchUrl: `https://www.google.com/search?tbm=shop&q=${q}`,
    size: filters.size,
    color: filters.colors[0] ?? "black",
    colorLabel:
      COLOR_SWATCHES.find((c) => c.value === filters.colors[0])?.label ??
      "セレクトカラー",
    material: item.itemName.includes("本革") || item.itemName.includes("レザー")
      ? "本革・レザー"
      : item.itemName.includes("ナイロン")
        ? "ナイロン"
        : "商品ページ参照",
    styleTags: ["楽天市場", item.shopName ? item.shopName.slice(0, 12) : "実売商品"],
    description: item.itemName.slice(0, 70),
    dimensions: "ショップ記載サイズ",
    weight: "-",
    source: "rakuten",
  };
}

async function searchRakutenForBag(
  appId: string,
  brand: string,
  modelName: string,
  filters: SearchFilters,
  excludedIds: Set<string>,
  excludedNames: Set<string>
): Promise<BagItem | null> {
  const budgetOpt = BUDGET_OPTIONS.find((b) => b.value === filters.budget);
  const params = new URLSearchParams({
    applicationId: appId,
    keyword: `${brand} ${modelName} バッグ`,
    hits: "5",
    imageFlag: "1",
    format: "json",
  });
  if (budgetOpt?.min && budgetOpt.min > 0) {
    params.set("minPrice", String(budgetOpt.min));
  }
  if (budgetOpt?.max) {
    params.set("maxPrice", String(budgetOpt.max));
  }

  try {
    const res = await fetch(
      `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601?${params.toString()}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { Items?: RakutenItem[] };
    for (const entry of data.Items ?? []) {
      const item = entry.Item;
      if (!item?.itemCode || excludedIds.has(item.itemCode)) continue;
      if (excludedNames.has(normalizeName(brand, modelName))) continue;
      const mapped = mapRakutenItemToBag(item, filters, brand, modelName);
      if (mapped) return mapped;
    }
  } catch {
    return null;
  }
  return null;
}

async function searchRakutenApiDynamic(
  appId: string,
  keyword: string,
  filters: SearchFilters,
  excludedIds: Set<string>,
  excludedNames: Set<string>,
  page: number
): Promise<BagItem[]> {
  const budgetOpt = BUDGET_OPTIONS.find((b) => b.value === filters.budget);
  const params = new URLSearchParams({
    applicationId: appId,
    keyword,
    hits: "24",
    page: String(page),
    imageFlag: "1",
    format: "json",
  });
  if (budgetOpt?.min && budgetOpt.min > 0) {
    params.set("minPrice", String(budgetOpt.min));
  }
  if (budgetOpt?.max) {
    params.set("maxPrice", String(budgetOpt.max));
  }

  try {
    const res = await fetch(
      `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601?${params.toString()}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { Items?: RakutenItem[] };
    const results: BagItem[] = [];
    const usedShops = new Set<string>();

    for (const entry of data.Items ?? []) {
      if (results.length >= 4) break;
      const item = entry.Item;
      if (!item?.itemCode || !item.itemName) continue;
      if (excludedIds.has(item.itemCode)) continue;
      const shop = item.shopName ?? "";
      if (usedShops.has(shop) && (data.Items?.length ?? 0) > 8) continue;

      const mapped = mapRakutenItemToBag(item, filters);
      if (!mapped) continue;
      if (excludedNames.has(normalizeName(mapped.brand, mapped.modelName))) {
        continue;
      }
      results.push(mapped);
      usedShops.add(shop);
      excludedIds.add(mapped.id);
      excludedNames.add(normalizeName(mapped.brand, mapped.modelName));
    }
    return results;
  } catch {
    return [];
  }
}

/**
 * Live Rakuten Search fallback when RAKUTEN_APP_ID is not configured.
 * Parses Schema.org JSON-LD (ItemList / Product) from search.rakuten.co.jp SSR HTML.
 */
async function searchRakutenPublicLive(
  keyword: string,
  filters: SearchFilters,
  excludedIds: Set<string>,
  excludedNames: Set<string>,
  page: number
): Promise<BagItem[]> {
  const budgetOpt = BUDGET_OPTIONS.find((b) => b.value === filters.budget);
  const url = new URL(
    `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(keyword)}/`
  );
  if (budgetOpt?.min && budgetOpt.min > 0) {
    url.searchParams.set("min", String(budgetOpt.min));
  }
  if (budgetOpt?.max) {
    url.searchParams.set("max", String(budgetOpt.max));
  }
  if (page > 1) {
    url.searchParams.set("p", String(page));
  }

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "ja,en;q=0.9",
      },
      signal: AbortSignal.timeout(5500),
    });
    if (!res.ok) return [];
    const html = await res.text();

    const results: BagItem[] = [];
    const jsonLdMatches = html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    );

    for (const match of jsonLdMatches) {
      if (results.length >= 4) break;
      try {
        const parsed = JSON.parse(match[1]);
        const list = Array.isArray(parsed) ? parsed : [parsed];
        for (const node of list) {
          const items =
            node?.["@type"] === "ItemList" && Array.isArray(node.itemListElement)
              ? node.itemListElement.map((el: { item?: unknown }) => el.item ?? el)
              : node?.["@type"] === "Product"
                ? [node]
                : [];

          for (const prod of items) {
            if (results.length >= 4) break;
            const itemUrl: string | undefined = prod?.url || prod?.offers?.url;
            const name: string | undefined = prod?.name;
            const rawImage = Array.isArray(prod?.image)
              ? prod.image[0]
              : prod?.image;
            const price = Number(prod?.offers?.price ?? 0);

            if (!itemUrl || !name || !rawImage || !price) continue;
            if (!matchesBudget(price, filters.budget)) continue;

            const id = `rakuten-live-${Buffer.from(itemUrl).toString("base64").slice(0, 20)}`;
            if (excludedIds.has(id)) continue;

            const brand =
              prod?.brand?.name ||
              (itemUrl.match(/item\.rakuten\.co\.jp\/([^/]+)/)?.[1] ?? "楽天市場");
            const modelName = String(name).slice(0, 48);
            if (excludedNames.has(normalizeName(brand, modelName))) continue;

            const q = encodeURIComponent(modelName);
            results.push({
              id,
              brand,
              modelName,
              price,
              priceFormatted: `¥${price.toLocaleString("ja-JP")}`,
              imageUrl: String(rawImage).replace(/^http:\/\//, "https://"),
              productUrl: itemUrl,
              rakutenSearchUrl: `https://search.rakuten.co.jp/search/mall/${q}/`,
              googleSearchUrl: `https://www.google.com/search?tbm=shop&q=${q}`,
              size: filters.size,
              color: filters.colors[0] ?? "black",
              colorLabel:
                COLOR_SWATCHES.find((c) => c.value === filters.colors[0])
                  ?.label ?? "セレクトカラー",
              material: name.includes("本革") || name.includes("レザー")
                ? "本革・レザー"
                : name.includes("ナイロン")
                  ? "ナイロン"
                  : "商品ページ参照",
              styleTags: ["楽天市場", "ライブ検索"],
              description: String(name).slice(0, 70),
              dimensions: "ショップ記載サイズ",
              weight: "-",
              source: "rakuten",
            });
            excludedIds.add(id);
            excludedNames.add(normalizeName(brand, modelName));
          }
        }
      } catch {
        // ignore malformed JSON-LD block
      }
    }

    return results;
  } catch {
    return [];
  }
}

interface GeminiCandidate {
  brand: string;
  modelName: string;
  estimatedPrice: number;
  material: string;
  styleTags: string[];
  description: string;
}

interface GeminiStructuredOutput {
  summary: string;
  preferredMaterials: string[];
  preferredForms: string[];
  avoidedTendencies: string[];
  confidenceScore: number;
  candidates: GeminiCandidate[];
}

export async function generatePaletteResponse(
  req: PaletteApiRequest
): Promise<PaletteApiResponse> {
  const excludedIds = new Set(req.excludedProductIds);
  const excludedNames = new Set(
    req.excludedModelNames.map((n) => n.toLowerCase().trim())
  );

  for (const b of [
    ...req.selectedBagsFromPreviousRound,
    ...req.rejectedBagsFromPreviousRound,
  ]) {
    excludedIds.add(b.id);
    excludedNames.add(normalizeName(b.brand, b.modelName));
  }

  const geminiKey =
    req.apiKeys?.geminiApiKey?.trim() || process.env.GEMINI_API_KEY;
  const rakutenKey =
    req.apiKeys?.rakutenAppId?.trim() || process.env.RAKUTEN_APP_ID;

  // 1) Gemini 3.5 Flash + Google Search Grounding + Rakuten API
  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const sizeLabel =
        SIZE_OPTIONS.find((s) => s.value === req.filters.size)?.label ??
        req.filters.size;
      const budgetLabel =
        BUDGET_OPTIONS.find((b) => b.value === req.filters.budget)?.label ??
        "指定なし";

      const prompt = `あなたは上質なバッグ専門のパーソナルスタイリストです。
以下のユーザー条件と直前の選択結果から、ユーザーの嗜好プロファイルを更新し、実在する異なる4つのカバン（ブランド名＋具体的なモデル名）を提案してください。

【検索条件】
- 予算帯: ${budgetLabel}
- サイズ感: ${sizeLabel}
- 希望カラー: ${req.filters.colors.length > 0 ? req.filters.colors.join(", ") : "指定なし"}
- ユーザー軌道修正メモ: ${req.userMemo || "なし"}

【これまでのプロファイル】
- ラウンド数: ${req.currentProfile.roundCount}
- サマリー: ${req.currentProfile.summary}
- 好みの素材: ${req.currentProfile.preferredMaterials.join(", ")}
- 好みのフォルム・機能: ${req.currentProfile.preferredForms.join(", ")}

【直前ラウンドで「好き」と選ばれたカバン】
${req.selectedBagsFromPreviousRound.map((b) => `- ${b.brand} ${b.modelName} (${b.material}, ${b.styleTags.join("/")})`).join("\n") || "なし"}

【直前ラウンドで選ばれなかったカバン】
${req.rejectedBagsFromPreviousRound.map((b) => `- ${b.brand} ${b.modelName} (${b.material}, ${b.styleTags.join("/")})`).join("\n") || "なし"}

【絶対に除外する既出モデル（重複厳禁）】
${Array.from(excludedNames).slice(0, 60).join(", ") || "なし"}

必ず以下のJSON形式のみを出力してください（マークダウン記法なし、純粋なJSONのみ）：
{
  "summary": "1〜2文の客観的な好み言語化サマリー",
  "preferredMaterials": ["素材1", "素材2"],
  "preferredForms": ["特徴1", "特徴2", "特徴3"],
  "avoidedTendencies": ["避けている傾向1"],
  "confidenceScore": 50,
  "candidates": [
    {
      "brand": "実在ブランド名",
      "modelName": "具体的なモデル名",
      "estimatedPrice": 25000,
      "material": "素材",
      "styleTags": ["タグ1", "タグ2"],
      "description": "30文字以内の魅力説明"
    }
  ]
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          temperature: 0.7,
        },
      });

      const rawText = response.text ?? "";
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as GeminiStructuredOutput;
        const baseProfile = simulateProfileUpdate(req);
        const updatedProfile: PreferenceProfile = {
          ...baseProfile,
          summary: parsed.summary || baseProfile.summary,
          preferredMaterials:
            parsed.preferredMaterials?.length > 0
              ? parsed.preferredMaterials
              : baseProfile.preferredMaterials,
          preferredForms:
            parsed.preferredForms?.length > 0
              ? parsed.preferredForms
              : baseProfile.preferredForms,
          avoidedTendencies:
            parsed.avoidedTendencies?.length > 0
              ? parsed.avoidedTendencies
              : baseProfile.avoidedTendencies,
          confidenceScore:
            typeof parsed.confidenceScore === "number"
              ? Math.min(98, Math.max(15, parsed.confidenceScore))
              : baseProfile.confidenceScore,
          confidenceLevel: computeConfidenceLevel(
            typeof parsed.confidenceScore === "number"
              ? parsed.confidenceScore
              : baseProfile.confidenceScore
          ),
        };

        const resolvedBags: BagItem[] = [];
        if (rakutenKey && Array.isArray(parsed.candidates)) {
          const rakutenResults = await Promise.all(
            parsed.candidates
              .slice(0, 4)
              .map((c) =>
                searchRakutenForBag(
                  rakutenKey,
                  c.brand,
                  c.modelName,
                  req.filters,
                  excludedIds,
                  excludedNames
                )
              )
          );
          for (let i = 0; i < rakutenResults.length; i++) {
            const hit = rakutenResults[i];
            const cand = parsed.candidates[i];
            if (hit) {
              hit.material = cand.material || hit.material;
              hit.styleTags =
                cand.styleTags?.length > 0 ? cand.styleTags : hit.styleTags;
              hit.description = cand.description || hit.description;
              resolvedBags.push(hit);
              excludedIds.add(hit.id);
              excludedNames.add(normalizeName(hit.brand, hit.modelName));
            }
          }
        }

        if (resolvedBags.length < 4) {
          const keyword = buildDynamicSearchKeyword(
            req.filters,
            updatedProfile,
            req.userMemo,
            updatedProfile.roundCount
          );
          const liveHits = await searchRakutenPublicLive(
            keyword,
            req.filters,
            excludedIds,
            excludedNames,
            (updatedProfile.roundCount % 8) + 1
          );
          resolvedBags.push(...liveHits.slice(0, 4 - resolvedBags.length));
        }

        if (resolvedBags.length < 4) {
          const fallback = pickFallbackBags(
            req.filters,
            excludedIds,
            excludedNames,
            updatedProfile,
            req.userMemo,
            4 - resolvedBags.length
          );
          resolvedBags.push(...fallback.bags);
        }

        return {
          bags: resolvedBags.slice(0, 4),
          updatedProfile,
          mode: rakutenKey ? "ai_rakuten" : "ai_fallback",
        };
      }
    } catch (err) {
      console.warn("[BagPalette] Gemini fallback triggered:", err);
    }
  }

  // 2) Update profile locally
  const updatedProfile = simulateProfileUpdate(req);
  const keyword = buildDynamicSearchKeyword(
    req.filters,
    updatedProfile,
    req.userMemo,
    updatedProfile.roundCount
  );
  const page = (updatedProfile.roundCount % 10) + 1;

  // 3) If RAKUTEN_APP_ID is set (even without Gemini), search millions of real Rakuten items directly!
  if (rakutenKey) {
    const apiHits = await searchRakutenApiDynamic(
      rakutenKey,
      keyword,
      req.filters,
      excludedIds,
      excludedNames,
      page
    );
    if (apiHits.length >= 4) {
      return {
        bags: apiHits.slice(0, 4),
        updatedProfile,
        mode: "ai_rakuten",
      };
    }
    const fallback = pickFallbackBags(
      req.filters,
      excludedIds,
      excludedNames,
      updatedProfile,
      req.userMemo,
      4 - apiHits.length
    );
    return {
      bags: [...apiHits, ...fallback.bags].slice(0, 4),
      updatedProfile,
      mode: apiHits.length > 0 ? "ai_rakuten" : "simulation",
      notice: fallback.notice,
    };
  }

  // 4) Even without API keys, try live Rakuten public search on the server!
  const liveHits = await searchRakutenPublicLive(
    keyword,
    req.filters,
    excludedIds,
    excludedNames,
    page
  );
  if (liveHits.length >= 4) {
    return {
      bags: liveHits.slice(0, 4),
      updatedProfile,
      mode: "rakuten_live",
    };
  }

  // 5) Fill any remaining slots from local curated real-product dataset
  const fallback = pickFallbackBags(
    req.filters,
    excludedIds,
    excludedNames,
    updatedProfile,
    req.userMemo,
    4 - liveHits.length
  );

  return {
    bags: [...liveHits, ...fallback.bags].slice(0, 4),
    updatedProfile,
    mode: liveHits.length > 0 ? "rakuten_live" : "simulation",
    notice: fallback.notice,
  };
}
