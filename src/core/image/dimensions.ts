/**
 * 入力寸法と SNS プロファイルから出力寸法を計算する純粋関数。
 * ブラウザ API に依存しないため Vitest でフルカバレッジ可能。
 *
 * アップスケールしない方針を採用: 入力が target より小さい場合は元寸法を維持する。
 * これにより不要な画質劣化を防ぐ。
 */
import type { SnsProfile } from '@/core/sns/types';

export interface OutputDimensions {
  readonly width: number;
  readonly height: number;
  /** cover モードでのクロップ開始座標 (入力座標系) */
  readonly cropOffset?: { readonly x: number; readonly y: number };
}

/**
 * 出力寸法を計算する。
 *
 * @param input 入力画像の実際の寸法
 * @param profile SnsProfile の寸法関連フィールド
 * @returns 出力寸法 (整数) と、cover モードの場合は cropOffset
 */
export function calculateOutputDimensions(
  input: { readonly width: number; readonly height: number },
  profile: Pick<SnsProfile, 'maxWidth' | 'maxHeight' | 'aspectRatio'>,
): OutputDimensions {
  const { maxWidth, maxHeight, aspectRatio } = profile;

  // custom プロファイル等で maxWidth/maxHeight が 0 → 元寸法維持
  if (maxWidth === 0 || maxHeight === 0) {
    return { width: input.width, height: input.height };
  }

  // aspectRatio が指定されている場合は mode に応じた処理
  if (aspectRatio !== undefined) {
    // w または h が 0 の不正入力 → アスペクト無視で fit 動作にフォールバック
    if (aspectRatio.w === 0 || aspectRatio.h === 0) {
      return fitDimensions(input, maxWidth, maxHeight);
    }

    if (aspectRatio.mode === 'cover') {
      return coverDimensions(input, maxWidth, maxHeight, aspectRatio.w, aspectRatio.h);
    }

    // fit / pad は fit と同じ寸法計算
    return fitDimensions(input, maxWidth, maxHeight);
  }

  // aspectRatio 未指定 → fit (アスペクト維持で maxWidth/maxHeight に収める)
  return fitDimensions(input, maxWidth, maxHeight);
}

/**
 * fit モード: アスペクト比維持で maxWidth/maxHeight に収める。
 * アップスケールしない (入力 <= target ならそのまま返す)。
 */
function fitDimensions(
  input: { readonly width: number; readonly height: number },
  maxWidth: number,
  maxHeight: number,
): OutputDimensions {
  // 入力が target 以下なら縮小不要
  if (input.width <= maxWidth && input.height <= maxHeight) {
    return { width: input.width, height: input.height };
  }

  // どちらの軸がはみ出しているかを確認し、縮小スケールを決定
  const scaleW = maxWidth / input.width;
  const scaleH = maxHeight / input.height;
  // 両方に収まるように小さい方のスケールを採用
  const scale = Math.min(scaleW, scaleH);

  return {
    width: Math.round(input.width * scale),
    height: Math.round(input.height * scale),
  };
}

/**
 * cover モード: 指定アスペクト比でターゲット寸法を cover。
 * アップスケールしない方針: 入力が target より小さい場合は入力基準で計算する。
 *
 * 処理手順:
 * 1. アップスケール上限を決定 (入力と target の小さい方)
 * 2. ターゲットアスペクト比に合わせた寸法を計算
 * 3. クロップオフセット (入力座標系) を計算
 */
function coverDimensions(
  input: { readonly width: number; readonly height: number },
  targetW: number,
  targetH: number,
  aspectW: number,
  aspectH: number,
): OutputDimensions {
  const targetAspect = aspectW / aspectH;
  const inputAspect = input.width / input.height;

  // アップスケールしない: 出力幅/高さはそれぞれ target を超えない
  // かつ入力寸法も超えない
  const maxW = Math.min(targetW, input.width);
  const maxH = Math.min(targetH, input.height);

  let outW: number;
  let outH: number;

  // 入力アスペクト比と target アスペクト比を比較して cover 方向を決定
  if (inputAspect >= targetAspect) {
    // 入力の方が横長 → 高さを基準にして cover、幅をクロップ
    outH = maxH;
    outW = Math.round(outH * targetAspect);
    // outW が maxW を超える場合は maxW に制限
    if (outW > maxW) {
      outW = maxW;
      outH = Math.round(outW / targetAspect);
    }
  } else {
    // 入力の方が縦長 → 幅を基準にして cover、高さをクロップ
    outW = maxW;
    outH = Math.round(outW / targetAspect);
    // outH が maxH を超える場合は maxH に制限
    if (outH > maxH) {
      outH = maxH;
      outW = Math.round(outH * targetAspect);
    }
  }

  // クロップオフセットを入力座標系で計算 (中央クロップ)
  // まず入力画像をスケールしたときの仮想サイズを求める
  const scaleToFitW = outW / input.width;
  const scaleToFitH = outH / input.height;
  // cover なので大きい方のスケールを採用 (大きい側が基準)
  const scale = Math.max(scaleToFitW, scaleToFitH);

  const scaledW = input.width * scale;
  const scaledH = input.height * scale;

  // 入力座標系でのクロップ開始点 (中央)
  const cropX = Math.round((scaledW - outW) / 2 / scale);
  const cropY = Math.round((scaledH - outH) / 2 / scale);

  return {
    width: outW,
    height: outH,
    cropOffset: { x: cropX, y: cropY },
  };
}
