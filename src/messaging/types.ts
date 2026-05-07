/**
 * メッセージング関連の型定義。
 * protocol.ts からの再エクスポートと、Phase 5 で詳細化するジョブ管理型。
 */

// protocol.ts の型を再エクスポート
export type {
  IngestRequest,
  IngestResponse,
  Message,
  OpenPanel,
} from './protocol';

/** 取り込みジョブの状態 (Phase 5 で詳細化) */
export type IngestJobStatus = 'pending' | 'running' | 'done' | 'error';

/** 取り込みジョブ (Phase 5 で詳細化) */
export interface IngestJob {
  readonly id: string;
  readonly status: IngestJobStatus;
  readonly createdAt: number;
}
