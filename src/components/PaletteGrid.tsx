"use client";

import React from "react";
import {
  Check,
  ExternalLink,
  Heart,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { BagItem, PreferenceProfile } from "@/types/bag";
import { PreferenceDrawer } from "./PreferenceDrawer";

interface PaletteGridProps {
  bags: BagItem[];
  selectedIds: string[];
  favoriteIds: Set<string>;
  profile: PreferenceProfile;
  userMemo: string;
  isLoading: boolean;
  notice?: string;
  onToggleSelect: (id: string) => void;
  onToggleFavorite: (bag: BagItem) => void;
  onNextRound: () => void;
  onMemoChange: (memo: string) => void;
  onChangeFilters: () => void;
}

export function PaletteGrid({
  bags,
  selectedIds,
  favoriteIds,
  profile,
  userMemo,
  isLoading,
  notice,
  onToggleSelect,
  onToggleFavorite,
  onNextRound,
  onMemoChange,
  onChangeFilters,
}: PaletteGridProps) {
  const selectedCount = selectedIds.length;

  return (
    <section
      id="palette-main-screen"
      className="w-full max-w-md mx-auto px-3 pb-5 pt-1 flex flex-col gap-2.5"
    >
      {/* Top: AI Learning Status Drawer */}
      <PreferenceDrawer
        profile={profile}
        userMemo={userMemo}
        onMemoChange={onMemoChange}
      />

      {/* Compact Eyeshadow Palette Case */}
      <div className="palette-case rounded-[26px] border border-[#E2C8D4] p-2.5 sm:p-3.5 space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <p className="text-[11px] font-bold text-[#7A5460] flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-[#D8B48A]" />
            <span>直感で「好き」をタップ（複数OK）</span>
          </p>
          <button
            id="change-filters-btn"
            type="button"
            onClick={onChangeFilters}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#965C6E] bg-white/80 hover:bg-white px-2.5 py-1 rounded-full border border-[#E8D5E2] transition-colors"
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>条件変更</span>
          </button>
        </div>

        {notice && (
          <div className="px-3 py-1.5 rounded-xl bg-[#FFFDFD]/90 border border-[#E8D5E2] text-[11px] text-[#7D636B]">
            {notice}
          </div>
        )}

        {/* 2x2 Palette Grid */}
        {bags.length === 0 && !isLoading ? (
          <div className="py-10 text-center space-y-3 bg-white/75 rounded-2xl border border-[#E8D5E2]">
            <p className="text-sm font-bold text-[#5E444B]">
              表示できるカバンがなくなりました
            </p>
            <button
              type="button"
              onClick={onChangeFilters}
              className="px-4 py-2 rounded-full bg-[#E87A90] text-white text-xs font-bold"
            >
              条件を変える・リセットする
            </button>
          </div>
        ) : (
          <div
            id="palette-2x2-grid"
            className={`grid grid-cols-2 gap-2.5 transition-opacity duration-200 ${
              isLoading ? "opacity-55 pointer-events-none" : "opacity-100"
            }`}
          >
            {bags.map((bag, idx) => {
              const isSelected = selectedIds.includes(bag.id);
              const isFav = favoriteIds.has(bag.id);

              return (
                <div
                  key={bag.id}
                  id={`palette-card-${idx}`}
                  data-bag-id={bag.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onToggleSelect(bag.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onToggleSelect(bag.id);
                    }
                  }}
                  className={`relative rounded-[20px] bg-[#FFFDFD] border-2 p-2 flex flex-col justify-between cursor-pointer select-none overflow-hidden transition-all duration-200 ${
                    isSelected
                      ? "pan-selected pan-selected-shimmer scale-[1.015]"
                      : "border-[#EAD9E2] hover:border-[#D4A5A5] shadow-sm"
                  }`}
                >
                  {/* Top action icons: External link (left) & Heart favorite (right) */}
                  <div className="flex items-center justify-between z-10">
                    <a
                      id={`ext-link-${idx}`}
                      href={bag.productUrl || bag.rakutenSearchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title="楽天・検索で実物を見る"
                      className="w-6 h-6 rounded-full bg-[#FAF2F5] hover:bg-[#F3E1E8] text-[#8E6270] flex items-center justify-center transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>

                    <button
                      id={`fav-btn-${idx}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(bag);
                      }}
                      aria-label={
                        isFav ? "お気に入りから外す" : "お気に入りに登録"
                      }
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                        isFav
                          ? "bg-[#FCE3E9] text-[#E35D7A] scale-110"
                          : "bg-[#FAF2F5] text-[#B496A0] hover:text-[#E35D7A]"
                      }`}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${isFav ? "fill-current" : ""}`}
                      />
                    </button>
                  </div>

                  {/* Product Image (object-contain so full bag is visible) */}
                  <div className="relative w-full h-24 sm:h-28 my-1 flex items-center justify-center bg-gradient-to-b from-[#FFFDFD] to-[#FDF6F8] rounded-xl overflow-hidden">
                    <img
                      src={bag.imageUrl}
                      alt={`${bag.brand} ${bag.modelName}`}
                      className="max-h-full max-w-full object-contain p-1 transition-transform duration-300"
                    />
                    {isSelected && (
                      <span className="absolute bottom-1 right-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-[#E87A90] to-[#D8A27C] text-white text-[9px] font-bold shadow-sm">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                        LIKE
                      </span>
                    )}
                  </div>

                  {/* Brand, Model Name, Price */}
                  <div className="space-y-0.5 pt-0.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#B07A88] truncate">
                      {bag.brand}
                    </p>
                    <h3 className="text-[11px] font-bold text-[#4A353B] leading-tight line-clamp-2 min-h-[28px]">
                      {bag.modelName}
                    </h3>
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-xs font-bold text-[#C8556F]">
                        {bag.priceFormatted}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#F7E8EE] text-[#7D5864] truncate max-w-[74px]">
                        {bag.styleTags[0] ?? bag.material}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Primary Action Button */}
        {bags.length > 0 && (
          <div className="pt-1">
            {selectedCount > 0 ? (
              <button
                id="learn-and-next-btn"
                type="button"
                disabled={isLoading}
                onClick={onNextRound}
                className="w-full py-3 px-4 rounded-full bg-gradient-to-r from-[#E87A90] via-[#EB8CA0] to-[#D99B78] text-white font-bold text-xs sm:text-sm shadow-md shadow-[#E87A90]/25 hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {isLoading
                    ? "AIが好みを学習中..."
                    : `選んだカバン（${selectedCount}個）を学習させて次の4択へ`}
                </span>
              </button>
            ) : (
              <button
                id="skip-round-btn"
                type="button"
                disabled={isLoading}
                onClick={onNextRound}
                className="w-full py-3 px-4 rounded-full bg-white/90 hover:bg-white text-[#7D5864] border border-[#DFC7D4] font-bold text-xs sm:text-sm shadow-sm active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`}
                />
                <span>
                  {isLoading
                    ? "別の4択を探しています..."
                    : "どれもピンとこない（別の4択を見る）"}
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
