"use client";

import React, { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  MessageSquareHeart,
  Sparkles,
  Tag,
} from "lucide-react";
import { ConfidenceLevel, PreferenceProfile } from "@/types/bag";

interface PreferenceDrawerProps {
  profile: PreferenceProfile;
  userMemo: string;
  onMemoChange: (memo: string) => void;
}

const CONFIDENCE_LABELS: Record<
  ConfidenceLevel,
  { label: string; badgeClass: string }
> = {
  exploring: {
    label: "探索中",
    badgeClass: "bg-[#F3E6EE] text-[#8E5B6B] border-[#E0C7D6]",
  },
  narrowing: {
    label: "絞り込み中",
    badgeClass: "bg-[#FCE6EC] text-[#C4526D] border-[#F2BDCA]",
  },
  high: {
    label: "精度高",
    badgeClass: "bg-[#F8EBD8] text-[#9A6B2F] border-[#E6CA9F]",
  },
};

const QUICK_MEMO_CHIPS = [
  "もう少しカジュアル寄りで",
  "自立するタイプがいい",
  "とにかく軽量重視",
  "きれいめ通勤向け",
];

export function PreferenceDrawer({
  profile,
  userMemo,
  onMemoChange,
}: PreferenceDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const conf = CONFIDENCE_LABELS[profile.confidenceLevel];

  return (
    <div
      id="ai-preference-drawer"
      className="w-full rounded-2xl bg-white/90 border border-[#E8D5E2] shadow-sm overflow-hidden transition-all"
    >
      {/* 1-tap Accordion Header */}
      <button
        id="toggle-ai-karte-btn"
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-[#FDF6F8] transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-7 h-7 rounded-full bg-gradient-to-br from-[#F7D7E1] to-[#E8D5E2] flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-[#C8556F]" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-[#4A353B]">
                AI好みカルテ
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${conf.badgeClass}`}
              >
                {conf.label} {profile.confidenceScore}%
              </span>
            </div>
            <p className="text-[11px] text-[#7D636B] truncate">
              第{profile.roundCount}ラウンド（累計{profile.totalChecked}
              個チェック済み）
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[11px] font-medium text-[#A46B7A] shrink-0">
          <span>{isOpen ? "閉じる" : "詳しく見る"}</span>
          {isOpen ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isOpen && (
        <div
          id="ai-karte-content"
          className="px-3.5 pb-3.5 pt-2 border-t border-[#F3E6EE] space-y-3 bg-[#FFFDFD]"
        >
          {/* Confidence Gauge */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-[#8B7179]">
              <span>探索中</span>
              <span>絞り込み中</span>
              <span>精度高</span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#F3E6EE] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#F0A3B4] via-[#E87A90] to-[#D8B48A] transition-all duration-500"
                style={{ width: `${profile.confidenceScore}%` }}
              />
            </div>
          </div>

          {/* 1-2 sentence summary */}
          <div className="p-2.5 rounded-xl bg-[#FDF6F8] border border-[#F2DFE7]">
            <p className="text-[10px] font-bold text-[#B86E7F] mb-0.5">
              現在の好みサマリー
            </p>
            <p
              id="ai-karte-summary"
              className="text-xs text-[#4A353B] leading-relaxed"
            >
              {profile.summary}
            </p>
          </div>

          {/* 3 Tag Categories */}
          <div className="space-y-2 text-[11px]">
            <div>
              <span className="inline-flex items-center gap-1 font-bold text-[#5E444B] mb-1">
                <Tag className="w-3 h-3 text-[#D4A5A5]" />
                好みの素材・質感
              </span>
              <div className="flex flex-wrap gap-1.5">
                {profile.preferredMaterials.length > 0 ? (
                  profile.preferredMaterials.map((m) => (
                    <span
                      key={m}
                      className="px-2 py-0.5 rounded-full bg-[#F7E8EE] text-[#6B4652] border border-[#E8D5E2]"
                    >
                      {m}
                    </span>
                  ))
                ) : (
                  <span className="text-[#9B7E86]">選択すると自動抽出されます</span>
                )}
              </div>
            </div>

            <div>
              <span className="inline-flex items-center gap-1 font-bold text-[#5E444B] mb-1">
                <Tag className="w-3 h-3 text-[#D8B48A]" />
                好みのフォルム・機能
              </span>
              <div className="flex flex-wrap gap-1.5">
                {profile.preferredForms.length > 0 ? (
                  profile.preferredForms.map((f) => (
                    <span
                      key={f}
                      className="px-2 py-0.5 rounded-full bg-[#F8EFE6] text-[#7A5936] border border-[#E7D4BC]"
                    >
                      {f}
                    </span>
                  ))
                ) : (
                  <span className="text-[#9B7E86]">選択すると自動抽出されます</span>
                )}
              </div>
            </div>

            <div>
              <span className="inline-flex items-center gap-1 font-bold text-[#5E444B] mb-1">
                <Tag className="w-3 h-3 text-[#B5A0B0]" />
                避けている傾向
              </span>
              <div className="flex flex-wrap gap-1.5">
                {profile.avoidedTendencies.length > 0 ? (
                  profile.avoidedTendencies.map((a) => (
                    <span
                      key={a}
                      className="px-2 py-0.5 rounded-full bg-[#F2EEF5] text-[#6A5A75] border border-[#DDD4E3]"
                    >
                      {a}
                    </span>
                  ))
                ) : (
                  <span className="text-[#9B7E86]">まだ特になし</span>
                )}
              </div>
            </div>
          </div>

          {/* User Correction Memo */}
          <div className="pt-1 space-y-1.5">
            <label
              htmlFor="user-correction-memo"
              className="flex items-center gap-1 text-[11px] font-bold text-[#5E444B]"
            >
              <MessageSquareHeart className="w-3.5 h-3.5 text-[#E87A90]" />
              軌道修正メモ（次の4択にすぐ反映）
            </label>
            <input
              id="user-correction-memo"
              type="text"
              value={userMemo}
              onChange={(e) => onMemoChange(e.target.value)}
              placeholder="例：もう少しカジュアル寄りで、自立するタイプがいい"
              className="w-full px-3 py-2 rounded-xl bg-white border border-[#E8D5E2] text-xs text-[#4A353B] placeholder:text-[#B39AA2] focus:outline-none focus:border-[#E87A90] focus:ring-2 focus:ring-[#E87A90]/20"
            />
            <div className="flex flex-wrap gap-1">
              {QUICK_MEMO_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() =>
                    onMemoChange(
                      userMemo.includes(chip)
                        ? userMemo
                        : userMemo
                          ? `${userMemo}、${chip}`
                          : chip
                    )
                  }
                  className="text-[10px] px-2 py-0.5 rounded-full bg-[#FDF6F8] border border-[#E8D5E2] text-[#8E5B6B] hover:border-[#E87A90] transition-colors"
                >
                  + {chip}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
