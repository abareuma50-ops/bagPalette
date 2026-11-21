import { GoogleGenAI } from "@google/genai";
import {
  BUDGET_OPTIONS,
  BagItem,
  COLOR_SWATCHES,
  ConfidenceLevel,
  PaletteApiRequest,
  PaletteApiResponse,
  PreferenceProfile,
  SIZE_OPTIONS,
} from "@/types/bag";

export class PaletteApiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

function normalizeName(brand: string, modelName: string): string {
  return `${brand} ${modelName}`.toLowerCase().replace(/\s+/g, " ").trim();
}

function computeConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 75) return "high";
  if (score >= 45) return "narrowing";
  return "exploring";
}

function makeProductId(brand: string, modelName: string): string {
  return `${brand}::${modelName}`.trim();
}

async function verifyImageUrl(url?: string): Promise<string | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
  };

  try {
    const headRes = await fetch(url, {
      method: "HEAD",
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(4500),
    });
    const ct = headRes.headers.get("content-type") ?? "";
    if (headRes.ok && ct.toLowerCase().startsWith("image/")) {
      return headRes.url || url;
    }
  } catch {
    // Fall through to GET
  }

  try {
    const getRes = await fetch(url, {
      method: "GET",
      headers: { ...headers, Range: "bytes=0-2048" },
      redirect: "follow",
      signal: AbortSignal.timeout(4500),
    });
    const ct = getRes.headers.get("content-type") ?? "";
    if (getRes.ok && ct.toLowerCase().startsWith("image/")) {
      return getRes.url || url;
    }
  } catch {
    return null;
  }

  return null;
}

async function extractOgImageFromPage(
  pageUrl?: string
): Promise<{ imageUrl: string; resolvedPageUrl: string } | null> {
  if (!pageUrl || !/^https?:\/\//i.test(pageUrl)) return null;
  try {
    const res = await fetch(pageUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "ja,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const resolvedPageUrl = res.url || pageUrl;

    const patterns = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        const candidateUrl = new URL(match[1], resolvedPageUrl).toString();
        const verified = await verifyImageUrl(candidateUrl);
        if (verified) {
          return { imageUrl: verified, resolvedPageUrl };
        }
      }
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
  colorLabel?: string;
  material: string;
  styleTags: string[];
  description: string;
  dimensions?: string;
  weight?: string;
  productUrl?: string;
  imageUrl?: string;
}

interface GeminiStructuredOutput {
  summary: string;
  preferredMaterials: string[];
  preferredForms: string[];
  avoidedTendencies: string[];
  confidenceScore: number;
  candidates: GeminiCandidate[];
}

async function queryGeminiForCandidates(
  ai: GoogleGenAI,
  req: PaletteApiRequest,
  excludedList: string[],
  neededCount: number,
  extraInstruction = ""
): Promise<{
  parsed: GeminiStructuredOutput;
  groundingUrls: string[];
}> {
  const sizeLabel =
    SIZE_OPTIONS.find((s) => s.value === req.filters.size)?.label ??
    req.filters.size;
  const budgetLabel =
    BUDGET_OPTIONS.find((b) => b.value === req.filters.budget)?.label ??
    "指定なし";
  const colorLabels =
    req.filters.colors.length > 0
      ? req.filters.colors
          .map((c) => COLOR_SWATCHES.find((s) => s.value === c)?.label ?? c)
          .join("・")
      : "指定なし";

  const candidateRequestCount = Math.max(neededCount + 2, 6);

  const prompt = `あなたは日本のファッション・バッグ市場に精通したパーソナルスタイリストです。
Google検索を使って、現在日本のオンラインショップ（楽天市場、Amazon、ZOZOTOWN、ブランド公式通販、セレクトショップなど）で実際に購入可能な実在の市販カバンをリサーチし、ユーザーの条件と好みに合う異なる ${candidateRequestCount} 点の候補を提案してください。

【検索条件】
- 予算帯: ${budgetLabel}
- サイズ・容量感: ${sizeLabel}
- 希望カラー: ${colorLabels}
- ユーザー軌道修正メモ: ${req.userMemo || "なし"}

【バリエーション方針】
- ハイブランド、ミドルブランド、国内セレクトショップ系、高コスパブランドまで幅広く偏りなく提案すること。
- 各候補は必ず異なるブランド・モデルにすること。

【これまでの嗜好プロファイル】
- ラウンド数: ${req.currentProfile.roundCount}
- サマリー: ${req.currentProfile.summary}
- 好みの素材・質感: ${req.currentProfile.preferredMaterials.join(", ") || "未定"}
- 好みのフォルム・機能: ${req.currentProfile.preferredForms.join(", ") || "未定"}
- 避けている傾向: ${req.currentProfile.avoidedTendencies.join(", ") || "なし"}

【直前ラウンドで「好き」と選ばれたカバン】
${req.selectedBagsFromPreviousRound.map((b) => `- ${b.brand} ${b.modelName} (${b.material}, ${b.styleTags.join("/")})`).join("\n") || "なし"}

【直前ラウンドで選ばれなかったカバン】
${req.rejectedBagsFromPreviousRound.map((b) => `- ${b.brand} ${b.modelName} (${b.material}, ${b.styleTags.join("/")})`).join("\n") || "なし"}

【絶対に除外する既出カバン（重複厳禁・二度と出さないこと）】
${excludedList.slice(-80).join(" / ") || "なし"}

${extraInstruction}

【重要：商品URLと画像URLの要件】
- 必ずGoogle検索で見つけた実在の商品ページURL（productUrl）と、実際に読み込める商品画像URL（imageUrl）を含めてください。
- 存在しない架空のURLやダミーURLは絶対に出力しないでください。

必ず以下の純粋なJSON形式のみを出力してください（マークダウンのコードブロック記号は不要）：
{
  "summary": "1〜2文の客観的な好み言語化サマリー（日本語）",
  "preferredMaterials": ["素材1", "素材2"],
  "preferredForms": ["特徴1", "特徴2", "特徴3"],
  "avoidedTendencies": ["避けている傾向1"],
  "confidenceScore": 50,
  "candidates": [
    {
      "brand": "実在ブランド名",
      "modelName": "正式モデル名",
      "estimatedPrice": 25000,
      "colorLabel": "カラー名",
      "material": "素材",
      "styleTags": ["タグ1", "タグ2"],
      "description": "35文字以内の魅力説明",
      "dimensions": "約 Wxx×Hxx×Dxxcm",
      "weight": "約xxxg",
      "productUrl": "https://...",
      "imageUrl": "https://..."
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
  if (!jsonMatch) {
    throw new PaletteApiError(
      "AIからの検索結果の解析に失敗しました。もう一度お試しください。",
      502
    );
  }

  const parsed = JSON.parse(jsonMatch[0]) as GeminiStructuredOutput;
  const chunks =
    response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const groundingUrls = chunks
    .map((c) => c.web?.uri)
    .filter((u): u is string => Boolean(u));

  return { parsed, groundingUrls };
}

async function resolveVerifiedBags(
  candidates: GeminiCandidate[],
  req: PaletteApiRequest,
  excludedIds: Set<string>,
  excludedNames: Set<string>,
  needed: number
): Promise<BagItem[]> {
  const verifiedBags: BagItem[] = [];

  // Process candidates concurrently for speed
  const checks = await Promise.all(
    candidates.map(async (cand): Promise<BagItem | null> => {
      if (!cand.brand || !cand.modelName) return null;
      const id = makeProductId(cand.brand, cand.modelName);
      const norm = normalizeName(cand.brand, cand.modelName);
      if (excludedIds.has(id) || excludedNames.has(norm)) return null;

      let validImage = await verifyImageUrl(cand.imageUrl);
      let validPageUrl = cand.productUrl;

      if (!validImage && validPageUrl) {
        const og = await extractOgImageFromPage(validPageUrl);
        if (og) {
          validImage = og.imageUrl;
          validPageUrl = og.resolvedPageUrl;
        }
      }

      if (!validImage) return null;

      const q = encodeURIComponent(`${cand.brand} ${cand.modelName}`);
      const price =
        typeof cand.estimatedPrice === "number" && cand.estimatedPrice > 0
          ? cand.estimatedPrice
          : 15000;

      return {
        id,
        brand: cand.brand,
        modelName: cand.modelName,
        price,
        priceFormatted: `¥${price.toLocaleString("ja-JP")}`,
        imageUrl: validImage,
        productUrl:
          validPageUrl && /^https?:\/\//i.test(validPageUrl)
            ? validPageUrl
            : `https://www.google.com/search?tbm=shop&q=${q}`,
        rakutenSearchUrl: `https://search.rakuten.co.jp/search/mall/${q}/`,
        googleSearchUrl: `https://www.google.com/search?tbm=shop&q=${q}`,
        size: req.filters.size,
        color: req.filters.colors[0] ?? "black",
        colorLabel: cand.colorLabel || "セレクトカラー",
        material: cand.material || "商品ページ参照",
        styleTags:
          Array.isArray(cand.styleTags) && cand.styleTags.length > 0
            ? cand.styleTags.slice(0, 4)
            : ["実在モデル"],
        description: cand.description || `${cand.brand} ${cand.modelName}`,
        dimensions: cand.dimensions || "公式サイズ参照",
        weight: cand.weight || "-",
        source: "gemini_grounded",
      };
    })
  );

  for (const bag of checks) {
    if (verifiedBags.length >= needed) break;
    if (!bag) continue;
    const norm = normalizeName(bag.brand, bag.modelName);
    if (excludedIds.has(bag.id) || excludedNames.has(norm)) continue;
    verifiedBags.push(bag);
    excludedIds.add(bag.id);
    excludedNames.add(norm);
  }

  return verifiedBags;
}

export async function generatePaletteResponse(
  req: PaletteApiRequest
): Promise<PaletteApiResponse> {
  const geminiKey =
    req.apiKeys?.geminiApiKey?.trim() || process.env.GEMINI_API_KEY?.trim();

  if (!geminiKey) {
    throw new PaletteApiError(
      "GEMINI_API_KEY が設定されていません。環境変数または画面右上の鍵アイコンから Gemini API キーを設定してください。",
      400
    );
  }

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

  const ai = new GoogleGenAI({ apiKey: geminiKey });

  // Turn 1: Primary Gemini Search Grounding query
  const { parsed } = await queryGeminiForCandidates(
    ai,
    req,
    Array.from(excludedNames),
    4
  );

  const validBags = await resolveVerifiedBags(
    parsed.candidates ?? [],
    req,
    excludedIds,
    excludedNames,
    4
  );

  // Turn 2 (Auto-retry): If fewer than 4 verified images, re-query Gemini for the missing slots
  if (validBags.length < 4) {
    const needed = 4 - validBags.length;
    try {
      const retry = await queryGeminiForCandidates(
        ai,
        req,
        Array.from(excludedNames),
        needed,
        `【再検索指示】先ほどの候補のうち ${needed} 点分の有効な画像URLが取得できませんでした。確実に画像が表示可能な実在ショップの商品ページURLと商品画像URLを ${needed + 2} 点提案してください。`
      );
      const moreBags = await resolveVerifiedBags(
        retry.parsed.candidates ?? [],
        req,
        excludedIds,
        excludedNames,
        needed
      );
      validBags.push(...moreBags);
    } catch (retryErr) {
      console.warn("[BagPalette] Retry query failed:", retryErr);
    }
  }

  if (validBags.length === 0) {
    throw new PaletteApiError(
      "実在商品の有効な画像を取得できませんでした。条件やメモを少し変えてもう一度お試しください。",
      502
    );
  }

  const isInitialRound =
    req.selectedBagsFromPreviousRound.length === 0 &&
    req.rejectedBagsFromPreviousRound.length === 0;

  const nextRound = isInitialRound
    ? req.currentProfile.roundCount
    : req.currentProfile.roundCount + 1;
  const prevShownCount =
    req.selectedBagsFromPreviousRound.length +
    req.rejectedBagsFromPreviousRound.length;
  const nextTotalChecked = req.currentProfile.totalChecked + prevShownCount;

  const confidenceScore =
    typeof parsed.confidenceScore === "number"
      ? Math.min(98, Math.max(15, parsed.confidenceScore))
      : isInitialRound
        ? req.currentProfile.confidenceScore
        : Math.min(96, req.currentProfile.confidenceScore + 18);

  const roundHistory = isInitialRound
    ? req.currentProfile.roundHistory
    : [
        ...req.currentProfile.roundHistory,
        {
          round: nextRound,
          shownIds: [
            ...req.selectedBagsFromPreviousRound.map((b) => b.id),
            ...req.rejectedBagsFromPreviousRound.map((b) => b.id),
          ],
          selectedIds: req.selectedBagsFromPreviousRound.map((b) => b.id),
          selectedNames: req.selectedBagsFromPreviousRound.map(
            (b) => `${b.brand} ${b.modelName}`
          ),
          rejectedNames: req.rejectedBagsFromPreviousRound.map(
            (b) => `${b.brand} ${b.modelName}`
          ),
          memoAtTurn: req.userMemo.trim() || undefined,
        },
      ];

  const updatedProfile: PreferenceProfile = {
    summary: parsed.summary || req.currentProfile.summary,
    preferredMaterials:
      parsed.preferredMaterials?.length > 0
        ? parsed.preferredMaterials
        : req.currentProfile.preferredMaterials,
    preferredForms:
      parsed.preferredForms?.length > 0
        ? parsed.preferredForms
        : req.currentProfile.preferredForms,
    avoidedTendencies:
      parsed.avoidedTendencies?.length > 0
        ? parsed.avoidedTendencies
        : req.currentProfile.avoidedTendencies,
    roundCount: nextRound,
    totalChecked: nextTotalChecked,
    confidenceLevel: computeConfidenceLevel(confidenceScore),
    confidenceScore,
    userMemo: req.userMemo.trim(),
    roundHistory,
  };

  return {
    bags: validBags.slice(0, 4),
    updatedProfile,
    mode: "gemini_grounded",
    notice:
      validBags.length < 4
        ? `有効な画像が確認できた ${validBags.length} 点の実在商品を表示しています。`
        : undefined,
  };
}
