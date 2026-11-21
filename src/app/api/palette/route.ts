import { NextRequest, NextResponse } from "next/server";
import { PaletteApiError, generatePaletteResponse } from "@/lib/paletteEngine";
import { PaletteApiRequest } from "@/types/bag";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PaletteApiRequest;
    const result = await generatePaletteResponse(body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PaletteApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    const message =
      error instanceof Error && error.message
        ? `AI検索中にエラーが発生しました: ${error.message}`
        : "パレットの生成に失敗しました。";
    console.error("[/api/palette] Error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
