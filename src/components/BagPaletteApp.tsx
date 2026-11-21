"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Heart, KeyRound, Palette, Sparkles, X } from "lucide-react";
import {
  BagItem,
  INITIAL_PREFERENCE_PROFILE,
  PaletteApiRequest,
  PaletteApiResponse,
  PreferenceProfile,
  SearchFilters,
} from "@/types/bag";
import { FilterSetup } from "./FilterSetup";
import { PaletteGrid } from "./PaletteGrid";
import { FavoritesView } from "./FavoritesView";

const STORAGE_KEYS = {
  EXCLUDED_IDS: "excludedProductIds",
  EXCLUDED_NAMES: "bagPalette_excludedModelNames",
  FAVORITES: "favoriteBags",
  PROFILE: "preferenceProfile",
  FILTERS: "bagPalette_filters",
  API_KEYS: "bagPalette_apiKeys",
};

const DEFAULT_FILTERS: SearchFilters = {
  budget: "any",
  size: "small",
  colors: [],
};

export function BagPaletteApp() {
  const [hydrated, setHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<"palette" | "favorites">("palette");
  const [stage, setStage] = useState<"filter" | "grid">("filter");

  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [excludedProductIds, setExcludedProductIds] = useState<string[]>([]);
  const [excludedModelNames, setExcludedModelNames] = useState<string[]>([]);
  const [favoriteBags, setFavoriteBags] = useState<BagItem[]>([]);
  const [preferenceProfile, setPreferenceProfile] = useState<PreferenceProfile>(
    INITIAL_PREFERENCE_PROFILE
  );
  const [userMemo, setUserMemo] = useState<string>("");
  const [apiKeys, setApiKeys] = useState<{
    geminiApiKey: string;
    rakutenAppId: string;
  }>({ geminiApiKey: "", rakutenAppId: "" });
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [paletteMode, setPaletteMode] = useState<
    PaletteApiResponse["mode"] | undefined
  >(undefined);

  const [currentBags, setCurrentBags] = useState<BagItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<string | undefined>(undefined);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const savedIds = localStorage.getItem(STORAGE_KEYS.EXCLUDED_IDS);
      if (savedIds) setExcludedProductIds(JSON.parse(savedIds));

      const savedNames = localStorage.getItem(STORAGE_KEYS.EXCLUDED_NAMES);
      if (savedNames) setExcludedModelNames(JSON.parse(savedNames));

      const savedFavs = localStorage.getItem(STORAGE_KEYS.FAVORITES);
      if (savedFavs) setFavoriteBags(JSON.parse(savedFavs));

      const savedProfile = localStorage.getItem(STORAGE_KEYS.PROFILE);
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile) as PreferenceProfile;
        setPreferenceProfile(parsed);
        if (parsed.userMemo) setUserMemo(parsed.userMemo);
      }

      const savedFilters = localStorage.getItem(STORAGE_KEYS.FILTERS);
      if (savedFilters) setFilters(JSON.parse(savedFilters));

      const savedKeys = localStorage.getItem(STORAGE_KEYS.API_KEYS);
      if (savedKeys) setApiKeys(JSON.parse(savedKeys));
    } catch (e) {
      console.warn("Failed to hydrate localStorage:", e);
    } finally {
      setHydrated(true);
    }
  }, []);

  // Persist to localStorage whenever state updates
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
      STORAGE_KEYS.EXCLUDED_IDS,
      JSON.stringify(excludedProductIds)
    );
  }, [excludedProductIds, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
      STORAGE_KEYS.EXCLUDED_NAMES,
      JSON.stringify(excludedModelNames)
    );
  }, [excludedModelNames, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favoriteBags));
  }, [favoriteBags, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
      STORAGE_KEYS.PROFILE,
      JSON.stringify(preferenceProfile)
    );
  }, [preferenceProfile, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEYS.FILTERS, JSON.stringify(filters));
  }, [filters, hydrated]);

  const favoriteIdSet = useMemo(
    () => new Set(favoriteBags.map((b) => b.id)),
    [favoriteBags]
  );

  const fetchPaletteRound = useCallback(
    async (
      selectedFromPrev: BagItem[],
      rejectedFromPrev: BagItem[],
      customFilters?: SearchFilters
    ) => {
      setIsLoading(true);
      setNotice(undefined);
      try {
        const payload: PaletteApiRequest = {
          filters: customFilters ?? filters,
          excludedProductIds,
          excludedModelNames,
          selectedBagsFromPreviousRound: selectedFromPrev,
          rejectedBagsFromPreviousRound: rejectedFromPrev,
          currentProfile: preferenceProfile,
          userMemo,
          apiKeys:
            apiKeys.geminiApiKey || apiKeys.rakutenAppId ? apiKeys : undefined,
        };

        const res = await fetch("/api/palette", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error("API error");
        }

        const data = (await res.json()) as PaletteApiResponse;
        setCurrentBags(data.bags);
        setPreferenceProfile(data.updatedProfile);
        setPaletteMode(data.mode);
        setSelectedIds([]);
        setNotice(data.notice);

        // Record ALL shown bags into excludedProductIds & excludedModelNames immediately
        if (data.bags.length > 0) {
          const newIds = data.bags.map((b) => b.id);
          const newNames = data.bags.map((b) =>
            `${b.brand} ${b.modelName}`.toLowerCase().trim()
          );
          setExcludedProductIds((prev) =>
            Array.from(new Set([...prev, ...newIds]))
          );
          setExcludedModelNames((prev) =>
            Array.from(new Set([...prev, ...newNames]))
          );
        }

        setStage("grid");
      } catch (err) {
        console.error(err);
        setNotice("通信エラーが発生しました。もう一度お試しください。");
      } finally {
        setIsLoading(false);
      }
    },
    [
      filters,
      excludedProductIds,
      excludedModelNames,
      preferenceProfile,
      userMemo,
      apiKeys,
    ]
  );

  const handleStartFromFilters = () => {
    fetchPaletteRound([], [], filters);
  };

  const handleNextRound = () => {
    const selectedSet = new Set(selectedIds);
    const selectedFromPrev = currentBags.filter((b) => selectedSet.has(b.id));
    const rejectedFromPrev = currentBags.filter((b) => !selectedSet.has(b.id));
    fetchPaletteRound(selectedFromPrev, rejectedFromPrev);
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleFavorite = (bag: BagItem) => {
    setFavoriteBags((prev) => {
      const exists = prev.some((f) => f.id === bag.id);
      if (exists) {
        return prev.filter((f) => f.id !== bag.id);
      }
      return [bag, ...prev];
    });
  };

  const handleRemoveFavorite = (id: string) => {
    setFavoriteBags((prev) => prev.filter((f) => f.id !== id));
  };

  const handleResetHistory = () => {
    setExcludedProductIds([]);
    setExcludedModelNames([]);
    setPreferenceProfile(INITIAL_PREFERENCE_PROFILE);
    setUserMemo("");
    setCurrentBags([]);
    setSelectedIds([]);
    setNotice(undefined);
    localStorage.removeItem(STORAGE_KEYS.EXCLUDED_IDS);
    localStorage.removeItem(STORAGE_KEYS.EXCLUDED_NAMES);
    localStorage.removeItem(STORAGE_KEYS.PROFILE);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Compact Cosmetic Header */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-[#FFF8F9]/85 border-b border-[#EFE0E8]">
        <div className="max-w-2xl mx-auto px-3.5 py-2.5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("palette")}
            className="flex items-center gap-2 text-left"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#F7D1DC] via-[#E8D5E2] to-[#E8C5B0] border border-[#D8B48A]/60 flex items-center justify-center shadow-sm">
              <Sparkles className="w-4 h-4 text-[#9A4E62]" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-[#4A353B] leading-none">
                Bag Palette
              </h1>
              <p className="text-[10px] text-[#8E6D77] mt-0.5">
                私だけのカバン見つけパレット
              </p>
            </div>
          </button>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1.5 bg-[#F7E8EE] p-1 rounded-full border border-[#E8D5E2]">
            <button
              id="tab-palette"
              type="button"
              onClick={() => setActiveTab("palette")}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeTab === "palette"
                  ? "bg-white text-[#C8556F] shadow-sm"
                  : "text-[#7D636B] hover:text-[#4A353B]"
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>パレット</span>
            </button>
            <button
              id="tab-favorites"
              type="button"
              onClick={() => setActiveTab("favorites")}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeTab === "favorites"
                  ? "bg-white text-[#C8556F] shadow-sm"
                  : "text-[#7D636B] hover:text-[#4A353B]"
              }`}
            >
              <Heart
                className={`w-3.5 h-3.5 ${
                  favoriteBags.length > 0 ? "fill-[#E87A90] text-[#E87A90]" : ""
                }`}
              />
              <span>お気に入り</span>
              {favoriteBags.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-[#FCE3E9] text-[#C8556F] text-[10px]">
                  {favoriteBags.length}
                </span>
              )}
            </button>
            <button
              id="open-api-settings-btn"
              type="button"
              onClick={() => setShowKeyModal(true)}
              title="APIキー設定（楽天・Gemini）"
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                apiKeys.rakutenAppId || apiKeys.geminiApiKey
                  ? "bg-white text-[#C8556F] shadow-sm"
                  : "text-[#8E6D77] hover:bg-white/60"
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {activeTab === "favorites" ? (
          <FavoritesView
            favorites={favoriteBags}
            onRemoveFavorite={handleRemoveFavorite}
            onBackToPalette={() => setActiveTab("palette")}
          />
        ) : stage === "filter" ? (
          <FilterSetup
            filters={filters}
            onChange={setFilters}
            onStart={handleStartFromFilters}
            isLoading={isLoading}
            excludedCount={excludedProductIds.length}
            onResetHistory={handleResetHistory}
          />
        ) : (
          <PaletteGrid
            bags={currentBags}
            selectedIds={selectedIds}
            favoriteIds={favoriteIdSet}
            profile={preferenceProfile}
            userMemo={userMemo}
            isLoading={isLoading}
            notice={notice}
            paletteMode={paletteMode}
            onToggleSelect={handleToggleSelect}
            onToggleFavorite={handleToggleFavorite}
            onNextRound={handleNextRound}
            onMemoChange={setUserMemo}
            onChangeFilters={() => setStage("filter")}
          />
        )}
      </main>

      {/* Optional API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 bg-[#4A353B]/35 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-[24px] bg-[#FFFDFD] border border-[#E8D5E2] p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#4A353B] flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-[#E87A90]" />
                <span>APIキー設定（任意）</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="w-7 h-7 rounded-full bg-[#F7E8EE] flex items-center justify-center text-[#7D636B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-[#7D636B] leading-relaxed">
              楽天市場の公式APIやGemini 3.5 Flashを使う場合に入力してください（端末のブラウザ内にのみ保存されます）。
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[#5E444B] mb-1">
                  楽天アプリケーションID（RAKUTEN_APP_ID）
                </label>
                <input
                  type="text"
                  value={apiKeys.rakutenAppId}
                  onChange={(e) =>
                    setApiKeys((prev) => ({
                      ...prev,
                      rakutenAppId: e.target.value,
                    }))
                  }
                  placeholder="例: 10xxxxxxxxxxxxxxx"
                  className="w-full px-3 py-2 rounded-xl border border-[#E8D5E2] text-xs focus:outline-none focus:border-[#E87A90]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#5E444B] mb-1">
                  Gemini APIキー（GEMINI_API_KEY）
                </label>
                <input
                  type="password"
                  value={apiKeys.geminiApiKey}
                  onChange={(e) =>
                    setApiKeys((prev) => ({
                      ...prev,
                      geminiApiKey: e.target.value,
                    }))
                  }
                  placeholder="AIza..."
                  className="w-full px-3 py-2 rounded-xl border border-[#E8D5E2] text-xs focus:outline-none focus:border-[#E87A90]"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                localStorage.setItem(
                  STORAGE_KEYS.API_KEYS,
                  JSON.stringify(apiKeys)
                );
                setShowKeyModal(false);
              }}
              className="w-full py-2.5 rounded-full bg-[#E87A90] text-white text-xs font-bold shadow-sm hover:brightness-105"
            >
              保存して閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
