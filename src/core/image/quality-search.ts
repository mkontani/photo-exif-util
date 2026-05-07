/**
 * 品質バイナリサーチ。
 * encode 関数を引数で受け取る純粋関数として実装し、
 * ブラウザ環境に依存しない形でユニットテストできるようにする。
 */

export interface QualitySearchOptions {
  readonly targetSizeBytes: number;
  /** 許容差 (例: 0.1 = ±10%) */
  readonly tolerance: number;
  /** 最小品質 (0-100) */
  readonly minQuality: number;
  /** 最大品質 (0-100) */
  readonly maxQuality: number;
  /** 最大反復回数 (デフォルト 8) */
  readonly maxIterations?: number;
}

export interface QualitySearchResult {
  readonly quality: number;
  readonly sizeBytes: number;
  readonly iterations: number;
  /** target に収束したか (false なら bestEffort) */
  readonly converged: boolean;
}

interface Candidate {
  quality: number;
  sizeBytes: number;
}

/**
 * 品質バイナリサーチ。encode 関数を注入する純粋関数。
 * encode(quality) は Promise<{ sizeBytes }> を返す関数。
 *
 * アルゴリズム:
 * lo=minQuality, hi=maxQuality でバイナリサーチ。
 * mid のサイズが tolerance 範囲に入れば収束。
 * maxIterations 超過時は target に最も近い結果を返し converged=false。
 */
export async function searchQuality(
  encode: (quality: number) => Promise<{ sizeBytes: number }>,
  options: QualitySearchOptions,
): Promise<QualitySearchResult> {
  const { targetSizeBytes, tolerance, minQuality, maxQuality, maxIterations = 8 } = options;

  const lowerBound = targetSizeBytes * (1 - tolerance);
  const upperBound = targetSizeBytes * (1 + tolerance);

  let lo = minQuality;
  let hi = maxQuality;
  let iterations = 0;

  // lo = hi = 同じ品質の場合は 1 回だけ試行
  if (lo === hi) {
    const { sizeBytes } = await encode(lo);
    const converged = sizeBytes >= lowerBound && sizeBytes <= upperBound;
    return { quality: lo, sizeBytes, iterations: 1, converged };
  }

  // target との距離が最小の候補を追跡 (収束しない場合のフォールバック)
  // 初回 encode 結果で必ず設定されるため、後続処理では non-null を保証できる
  let bestQuality = lo;
  let bestSizeBytes = 0;
  let bestInitialized = false;

  while (lo <= hi && iterations < maxIterations) {
    const mid = Math.round((lo + hi) / 2);
    const { sizeBytes } = await encode(mid);
    iterations++;

    // target に最も近い候補を更新
    if (
      !bestInitialized ||
      Math.abs(sizeBytes - targetSizeBytes) < Math.abs(bestSizeBytes - targetSizeBytes)
    ) {
      bestQuality = mid;
      bestSizeBytes = sizeBytes;
      bestInitialized = true;
    }

    // 許容範囲内に収まっていれば収束
    if (sizeBytes >= lowerBound && sizeBytes <= upperBound) {
      return { quality: mid, sizeBytes, iterations, converged: true };
    }

    if (sizeBytes > upperBound) {
      // サイズが大きすぎる → 品質を下げる
      hi = mid - 1;
    } else {
      // sizeBytes < lowerBound: サイズが小さすぎる → 品質を上げる
      lo = mid + 1;
    }
  }

  // while ループを抜けた時点で少なくとも 1 回は encode しているため
  // bestInitialized は true のはずだが、型安全のためデフォルト値を用意する
  const candidate: Candidate = { quality: bestQuality, sizeBytes: bestSizeBytes };

  // maxIterations 超過 or lo > hi で収束しなかった場合
  // 仕様: target が極大で hi=maxQuality でも下回る場合は converged=true
  if (candidate.sizeBytes <= upperBound && candidate.quality === maxQuality) {
    return { ...candidate, iterations, converged: true };
  }

  // minQuality でも target オーバー → フォールバック (converged=false)
  return { ...candidate, iterations, converged: false };
}
