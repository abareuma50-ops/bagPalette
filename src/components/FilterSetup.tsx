"use client";

import React from "react";
import { Check, Sparkles } from "lucide-react";
import {
  BUDGET_OPTIONS,
  COLOR_SWATCHES,
  ColorOption,
  SIZE_OPTIONS,
  SearchFilters,
} from "@/types/bag";

interface FilterSetupProps {
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
  onStart: () => void;
  isLoading: boolean;
  excludedCount: number;
  onResetHistory: () => void;
}

export function FilterSetup({
  filters,
  onChange,
  onStart,
  isLoading,
  excludedCount,
  onResetHistory,
}: FilterSetupProps) {
  const toggleColor = (color: ColorOption) => {
    const exists = filters.colors.includes(color);
    const nextColors = exists
      ? filters.colors.filter((c) => c !== color)
      : [...filters.colors, color];
    onChange({ ...filters, colors: nextColors });
  };

  return (
    <section
      id="filter-setup-screen"
      className="w-full max-w-md mx-auto px-3.5 pb-8 pt-2"
    >
      <div className="palette-case rounded-[28px] border border-[#E8D5E2] p-4 sm:p-5 space-y-5">
        {/* Intro */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 border border-[#E8D5E2] text-[11px] font-medium text-[#A46B7A]">
            <Sparkles className="w-3.5 h-3.5 text-[#E87A90]" />
            <span>STEP 1 · パレットの色と条件をセット</span>
          </div>
          <h2 className="text-lg font-bold text-[#4A353B] pt-1">
            どんなカバンをお探しですか？
          </h2>
          <p className="text-xs text-[#7D636B]">
            選んだ条件に合わせて4つのカバンをパレットに並べます
          </p>
        </div>

        {/* 1. Budget */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-[#5E444B] tracking-wide">
            1. 予算帯
          </label>
          <div className="grid grid-cols-3 gap-2">
            {BUDGET_OPTIONS.map((opt) => {
              const active = filters.budget === opt.value;
              return (
                <button
                  key={opt.value}
                  id={`budget-${opt.value}`}
                  type="button"
                  onClick={() => onChange({ ...filters, budget: opt.value })}
                  className={`py-2 px-2 rounded-2xl text-xs font-medium transition-all border ${
                    active
                      ? "bg-[#E87A90] text-white border-[#D9657D] shadow-sm scale-[1.02]"
                      : "bg-white/85 text-[#5E444B] border-[#E8D5E2] hover:border-[#D4A5A5]"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Size */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-[#5E444B] tracking-wide">
            2. サイズ・容量感
          </label>
          <div className="grid grid-cols-2 gap-2">
            {SIZE_OPTIONS.map((opt) => {
              const active = filters.size === opt.value;
              return (
                <button
                  key={opt.value}
                  id={`size-${opt.value}`}
                  type="button"
                  onClick={() => onChange({ ...filters, size: opt.value })}
                  className={`text-left p-2.5 rounded-2xl transition-all border ${
                    active
                      ? "bg-white border-[#E87A90] ring-2 ring-[#E87A90]/30 shadow-sm"
                      : "bg-white/80 border-[#E8D5E2] hover:border-[#D4A5A5]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#4A353B]">
                      {opt.label}
                    </span>
                    {active && (
                      <span className="w-4 h-4 rounded-full bg-[#E87A90] text-white flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#8B7179] mt-0.5 leading-snug">
                    {opt.detail}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Colors (Cosmetic Swatch Chips) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-[#5E444B] tracking-wide">
              3. カラー（複数選択可）
            </label>
            <span className="text-[11px] text-[#9B7E86]">
              {filters.colors.length === 0
                ? "未選択＝すべて"
                : `${filters.colors.length}色選択中`}
            </span>
          </div>

          <div className="bg-white/75 rounded-2xl border border-[#E8D5E2] p-3">
            <div className="grid grid-cols-4 gap-y-3 gap-x-1.5">
              {COLOR_SWATCHES.map((swatch) => {
                const active = filters.colors.includes(swatch.value);
                return (
                  <button
                    key={swatch.value}
                    id={`color-${swatch.value}`}
                    type="button"
                    onClick={() => toggleColor(swatch.value)}
                    className="flex flex-col items-center gap-1 group"
                  >
                    <div
                      className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                        active
                          ? "ring-2 ring-[#E87A90] ring-offset-2 ring-offset-[#FFF8F9] scale-105 shadow-md"
                          : "ring-1 ring-[#D4A5A5]/60 group-hover:scale-105"
                      }`}
                      style={{
                        background: swatch.gradient ?? swatch.hex,
                      }}
                    >
                      {/* Cosmetic pan inner shimmer */}
                      <span className="absolute inset-1 rounded-full border border-white/30 pointer-events-none" />
                      {active && (
                        <Check
                          className={`w-4 h-4 stroke-[3] ${
                            swatch.isLight ? "text-[#4A353B]" : "text-white"
                          }`}
                        />
                      )}
                    </div>
                    <span
                      className={`text-[10px] leading-tight text-center ${
                        active
                          ? "font-bold text-[#C8556F]"
                          : "text-[#6D545B]"
                      }`}
                    >
                      {swatch.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Start CTA */}
        <div className="pt-1 space-y-2">
          <button
            id="start-palette-btn"
            type="button"
            disabled={isLoading}
            onClick={onStart}
            className="w-full py-3.5 px-5 rounded-full bg-gradient-to-r from-[#E87A90] via-[#EB8CA0] to-[#DF8BA4] text-white font-bold text-sm shadow-md shadow-[#E87A90]/25 hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {isLoading ? "パレットを準備中..." : "この条件でパレットを開く"}
            </span>
          </button>

          {excludedCount > 0 && (
            <div className="flex items-center justify-between text-[11px] text-[#8B7179] px-1 pt-1">
              <span>これまでに {excludedCount} 個のカバンをチェック済み</span>
              <button
                id="reset-history-btn"
                type="button"
                onClick={onResetHistory}
                className="underline text-[#B86E7F] hover:text-[#964E5E]"
              >
                履歴をリセット
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
