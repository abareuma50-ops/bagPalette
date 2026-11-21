import { GoogleGenAI } from "@google/genai";
import { FALLBACK_BAGS } from "@/data/fallbackBags";
import {
  BUDGET_OPTIONS,
  BagItem,
  BudgetRange,
  ConfidenceLevel,
  PaletteApiRequest,
  PaletteApiResponse,
  PreferenceProfile,
  SIZE_OPTIONS,
  SearchFilters,
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
    if (bag.material) {
      if (bag.material.includes("革") || bag.material.includes("レザー")) {
        newMaterials.push("本革・上質レザー");
      } else if (bag.material.includes("ナイロン") || bag.material.includes("ポリエステル")) {
        newMaterials.push("軽量ナイロン・撥水");
      } else if (bag.material.includes("キャンバス")) {
        newMaterials.push("キャンバス");
      } else if (bag.material.includes("合皮") || bag.material.includes("PVC")) {
        newMaterials.push("お手入れ楽な合皮/PVC");
      } else {
        newMaterials.push(bag.material);
      }
    }
    for (const tag of bag.styleTags) {
      newForms.push(tag);
    }
  }

  // Extract avoided tendencies from rejected items not appearing in selected
  const selectedTags = new Set(
    selectedBagsFromPreviousRound.flatMap((b) => b.styleTags)
  );
  for (const bag of rejectedBagsFromPreviousRound) {
    if (bag.price > 45000 && !selectedBagsFromPreviousRound.some((s) => s.price > 45000)) {
      newAvoided.push("高価格帯");
    }
    for (const tag of bag.styleTags) {
      if (!selectedTags.has(tag) && newAvoided.length < 4) {
        if (tag === "プチプラ") newAvoided.push("カジュアルすぎ");
        if (tag === "リュック") newAvoided.push("スポーティ系");
      }
    }
  }

  // Incorporate userMemo hints
  const memo = userMemo.trim();
  if (memo) {
    if (memo.includes("カジュアル")) newForms.push("カジュアル");
    if (memo.includes("きれいめ") || memo.includes("通勤")) newForms.push("きれいめ");
    if (memo.includes("自立")) newForms.push("自立する");
    if (memo.includes("軽")) newForms.push("軽量");
    if (memo.includes("本革") || memo.includes("レザー")) newMaterials.push("本革・上質レザー");
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

  // Confidence score calculation
  const delta = selectedBagsFromPreviousRound.length > 0 ? 18 : 6;
  const confidenceScore = Math.min(
    96,
    Math.max(15, currentProfile.confidenceScore + delta)
  );
  const confidenceLevel = computeConfidenceLevel(confidenceScore);

  // Build natural Japanese summary
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

  // Match learned preferences
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

  // Match userMemo keywords
  const memo = userMemo.trim().toLowerCase();
  if (memo) {
    const haystack = `${bag.brand} ${bag.modelName} ${bag.material} ${bag.styleTags.join(" ")} ${bag.description}`.toLowerCase();
    const keywords = memo.split(/[\s、,。]+/).filter((k) => k.length >= 2);
    for (const kw of keywords) {
      if (haystack.includes(kw)) score += 18;
    }
    if (memo.includes("カジュアル") && haystack.includes("カジュアル")) score += 15;
    if (memo.includes("きれいめ") && haystack.includes("きれいめ")) score += 15;
    if (memo.includes("自立") && haystack.includes("自立")) score += 18;
    if (memo.includes("軽") && (haystack.includes("軽") || haystack.includes("超軽量"))) score += 15;
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

  // Sort unseen bags by relevance score (with small deterministic tiebreaker)
  const scored = unseen
    .map((bag) => ({
      bag,
      score: scoreBagForUser(bag, filters, profile, userMemo),
    }))
    .sort((a, b) => b.score - a.score);

  // Try to diversify brands/colors in the 4 picks when possible
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

  const strictMatches = picked.filter(
    (b) =>
      b.size === filters.size &&
      matchesBudget(b.price, filters.budget) &&
      (filters.colors.length === 0 || filters.colors.includes(b.color))
  );

  let notice: string | undefined;
  if (picked.length < count) {
    notice = `未表示の候補が残り${picked.length}点となりました。`;
  } else if (strictMatches.length === 0 && unseen.length >= count) {
    notice =
      "指定条件に合う未表示アイテムが少なくなったため、近いテイストの別候補も混ぜて表示しています。";
  }

  return { bags: picked, notice };
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

async function searchRakutenForBag(
  brand: string,
  modelName: string,
  filters: SearchFilters,
  excludedIds: Set<string>,
  excludedNames: Set<string>
): Promise<BagItem | null> {
  const appId = process.env.RAKUTEN_APP_ID;
  if (!appId) return null;

  const budgetOpt = BUDGET_OPTIONS.find((b) => b.value === filters.budget);
  const params = new URLSearchParams({
    applicationId: appId,
    keyword: `${brand} ${modelName} バッグ`,
    hits: "4",
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
    const items = data.Items ?? [];

    for (const entry of items) {
      const item = entry.Item;
      if (!item || !item.itemCode || !item.itemName || !item.itemUrl) continue;
      if (excludedIds.has(item.itemCode)) continue;
      if (excludedNames.has(normalizeName(brand, modelName))) continue;

      const rawImg = item.mediumImageUrls?.[0]?.imageUrl;
      if (!rawImg) continue;
      const imageUrl = rawImg
        .replace(/^http:\/\//, "https://")
        .replace(/\?_ex=\d+x\d+/, "?_ex=500x500");

      const price = item.itemPrice ?? 0;
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
        colorLabel: "セレクトカラー",
        material: "商品ページ参照",
        styleTags: ["実在モデル", "楽天市場"],
        description: item.itemName.slice(0, 60),
        dimensions: "ショップ記載サイズ",
        weight: "-",
        source: "rakuten",
      };
    }
  } catch {
    return null;
  }
  return null;
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

  // Always add previous round items to excluded sets just in case
  for (const b of [
    ...req.selectedBagsFromPreviousRound,
    ...req.rejectedBagsFromPreviousRound,
  ]) {
    excludedIds.add(b.id);
    excludedNames.add(normalizeName(b.brand, b.modelName));
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const rakutenKey = process.env.RAKUTEN_APP_ID;

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

  // Fallback simulation mode (works with zero API keys!)
  const updatedProfile = simulateProfileUpdate(req);
  const { bags, notice } = pickFallbackBags(
    req.filters,
    excludedIds,
    excludedNames,
    updatedProfile,
    req.userMemo,
    4
  );

  return {
    bags,
    updatedProfile,
    mode: "simulation",
    notice,
  };
}
