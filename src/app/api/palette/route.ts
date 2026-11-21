import { NextRequest, NextResponse } from "next/server";
import { generatePaletteResponse } from "@/lib/paletteEngine";
import { PaletteApiRequest } from "@/types/bag";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PaletteApiRequest;
    const result = await generatePaletteResponse(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[/api/palette] Error:", error);
    return NextResponse.json(
      { error: "パレットの生成に失敗しました。" },
      { status: 500 }
    );
  }
}
