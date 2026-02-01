/**
 * 飞书模块
 *
 * 提供飞书妙记的获取和处理功能
 *
 * @example
 * import { getMinuteInfo, getMinuteTranscriptRaw, parseTranscript } from "./feishu";
 *
 * const info = await getMinuteInfo("obcnjj5te6urc94376w78e89");
 * const raw = await getMinuteTranscriptRaw("obcnjj5te6urc94376w78e89");
 * const transcript = parseTranscript(raw);
 */

// ─────────────────────────────────────────────────
// 客户端
// ─────────────────────────────────────────────────

export {
  getClient,
  clearClient,
  getUserToken,
  requireUserToken,
  getRequestOptions,
  lark,
} from "./client";

// ─────────────────────────────────────────────────
// 妙记 API
// ─────────────────────────────────────────────────

export {
  getMinuteInfo,
  getMinuteStats,
  getMinuteTranscriptRaw,
} from "./minutes";

// ─────────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────────

export {
  extractToken,
  formatDuration,
  parseTranscript,
  formatTranscript,
} from "./utils";

// ─────────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────────

export type {
  MinuteInfo,
  MinuteStats,
  MinuteTranscript,
  TranscriptDialogue,
} from "./types";
