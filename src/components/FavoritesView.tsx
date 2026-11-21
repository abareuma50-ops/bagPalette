"use client";

import React from "react";
import { ExternalLink, Heart, Sparkles, Trash2 } from "lucide-react";
import { BagItem, SIZE_OPTIONS } from "@/types/bag";

interface FavoritesViewProps {
  favorites: BagItem[];
  onRemoveFavorite: (id: string) => void;
  onBackToPalette: () => void;
}

export function FavoritesView({
  favorites,
  onRemoveFavorite,
  onBackToPalette,
}: FavoritesViewProps) {
  const getSizeLabel = (size: BagItem["size"]) =>
    SIZE_OPTIONS.find((s) => s.value === size)?.label ?? size;

  if (favorites.length === 0) {
    return (
      <section
        id="favorites-empty-screen"
        className="w-full max-w-md mx-auto px-4 py-8"
      >
        <div className="palette-case rounded-[28px] border border-[#E8D5E2] p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-white/90 border border-[#E8D5E2] flex items-center justify-center">
            <Heart className="w-6 h-6 text-[#D4A5A5]" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[#4A353B]">
              お気に入りはまだありません
            </h2>
            <p className="text-xs text-[#7D636B] leading-relaxed">
              4択パレットの右上にあるハートボタンをタップすると、
              <br />
              ここに保存して横並びで比較できます。
            </p>
          </div>
          <button
            id="back-to-palette-from-empty"
            type="button"
            onClick={onBackToPalette}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#E87A90] text-white text-xs font-bold shadow-sm hover:brightness-105 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>パレットに戻る</span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      id="favorites-screen"
      className="w-full max-w-2xl mx-auto px-3.5 pb-10 pt-2 space-y-5"
    >
      {/* Saved List */}
      <div className="palette-case rounded-[26px] border border-[#E8D5E2] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#4A353B] flex items-center gap-1.5">
            <Heart className="w-4 h-4 text-[#E35D7A] fill-current" />
            <span>お気に入り一覧（{favorites.length}点）</span>
          </h2>
          <button
            type="button"
            onClick={onBackToPalette}
            className="text-xs font-bold text-[#C8556F] hover:underline"
          >
            パレットへ戻る
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {favorites.map((bag) => (
            <div
              key={bag.id}
              data-favorite-id={bag.id}
              className="rounded-2xl bg-[#FFFDFD] border border-[#EAD9E2] p-3 flex gap-3 items-center shadow-sm"
            >
              <div className="w-20 h-20 rounded-xl bg-[#FDF6F8] border border-[#F3E6EE] flex items-center justify-center shrink-0 p-1">
                  <img
                    src={bag.imageUrl}
                    alt={`${bag.brand} ${bag.modelName}`}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (!target.dataset.fallbackApplied) {
                        target.dataset.fallbackApplied = "1";
                        target.src = `/bags/${bag.id}.svg`;
                      }
                    }}
                    className="max-h-full max-w-full object-contain"
                  />
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-[10px] font-bold uppercase text-[#B07A88] truncate">
                  {bag.brand}
                </p>
                <h3 className="text-xs font-bold text-[#4A353B] leading-snug line-clamp-2">
                  {bag.modelName}
                </h3>
                <p className="text-xs font-bold text-[#C8556F]">
                  {bag.priceFormatted}
                </p>
                <div className="flex items-center gap-2 pt-0.5">
                  <a
                    href={bag.productUrl || bag.rakutenSearchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#F7E8EE] text-[#7A4A58] hover:bg-[#EED7E1] transition-colors"
                  >
                    <span>商品を見る</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => onRemoveFavorite(bag.id)}
                    aria-label={`${bag.modelName}をお気に入りから削除`}
                    className="inline-flex items-center gap-1 text-[10px] text-[#9B7E86] hover:text-[#C8556F] px-1.5 py-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>解除</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Side-by-side Spec Comparison Table */}
      <div
        id="favorites-comparison-table"
        className="rounded-[24px] bg-white/95 border border-[#E8D5E2] p-4 shadow-sm space-y-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#4A353B]">
            簡易スペック比較表
          </h3>
          <span className="text-[11px] text-[#8B7179]">
            横スクロールで見比べられます
          </span>
        </div>

        <div className="overflow-x-auto soft-scroll pb-2">
          <table className="w-full border-collapse text-left text-xs min-w-[460px]">
            <thead>
              <tr className="border-b border-[#F2DFE7]">
                <th className="py-2 pr-3 font-bold text-[#8E5B6B] w-24 align-top">
                  項目
                </th>
                {favorites.map((bag) => (
                  <th
                    key={bag.id}
                    className="py-2 px-2.5 font-bold text-[#4A353B] min-w-[140px] align-top"
                  >
                    <div className="w-16 h-16 mx-auto mb-1.5 rounded-xl bg-[#FDF6F8] border border-[#F3E6EE] flex items-center justify-center p-1">
                      <img
                        src={bag.imageUrl}
                        alt={bag.modelName}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <p className="text-[10px] text-[#B07A88] uppercase text-center">
                      {bag.brand}
                    </p>
                    <p className="text-[11px] text-center line-clamp-2">
                      {bag.modelName}
                    </p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F7ECF1]">
              <tr>
                <td className="py-2.5 pr-3 font-bold text-[#7D636B]">
                  参考価格
                </td>
                {favorites.map((bag) => (
                  <td
                    key={bag.id}
                    className="py-2.5 px-2.5 font-bold text-[#C8556F] text-center"
                  >
                    {bag.priceFormatted}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 pr-3 font-bold text-[#7D636B]">
                  サイズ感
                </td>
                {favorites.map((bag) => (
                  <td key={bag.id} className="py-2.5 px-2.5 text-center">
                    <div className="font-medium text-[#4A353B]">
                      {getSizeLabel(bag.size)}
                    </div>
                    <div className="text-[10px] text-[#8B7179]">
                      {bag.dimensions}
                    </div>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 pr-3 font-bold text-[#7D636B]">
                  カラー・素材
                </td>
                {favorites.map((bag) => (
                  <td key={bag.id} className="py-2.5 px-2.5 text-center">
                    <div className="text-[#4A353B]">{bag.colorLabel}</div>
                    <div className="text-[10px] text-[#8B7179]">
                      {bag.material}
                    </div>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 pr-3 font-bold text-[#7D636B]">
                  特徴
                </td>
                {favorites.map((bag) => (
                  <td key={bag.id} className="py-2.5 px-2.5">
                    <div className="flex flex-wrap gap-1 justify-center">
                      {bag.styleTags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-[#F7E8EE] text-[#6B4652]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 pr-3 font-bold text-[#7D636B]">
                  購入リンク
                </td>
                {favorites.map((bag) => (
                  <td key={bag.id} className="py-2.5 px-2.5 text-center">
                    <div className="flex flex-col gap-1 items-center">
                      <a
                        href={bag.rakutenSearchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#C8556F] hover:underline"
                      >
                        <span>楽天市場</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <a
                        href={bag.googleSearchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-[#7D636B] hover:underline"
                      >
                        <span>Google検索</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
