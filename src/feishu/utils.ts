/**
 * 飞书妙记工具函数
 */

import type { MinuteTranscript, TranscriptDialogue } from "./types";

/**
 * 从妙记链接或 token 中提取 minute_token
 *
 * @example
 * extractToken("obcnjj5te6urc94376w78e89") // => "obcnjj5te6urc94376w78e89"
 * extractToken("https://xxx.feishu.cn/minutes/obcnjj5te6urc94376w78e89") // => "obcnjj5te6urc94376w78e89"
 */
export function extractToken(input: string): string {
  const trimmed = input.trim();

  // 如果是链接，提取 token
  if (trimmed.includes("/")) {
    const match = trimmed.match(/\/minutes\/([a-zA-Z0-9]+)/);
    if (match) {
      return match[1];
    }
    throw new Error(`无法从链接提取 minute_token: ${input}`);
  }

  // 直接返回 token
  return trimmed;
}

/**
 * 格式化时长 (秒 -> 可读字符串)
 *
 * @example
 * formatDuration(3661) // => "1小时1分1秒"
 * formatDuration(61)   // => "1分1秒"
 * formatDuration(30)   // => "30秒"
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const parts: string[] = [];
  if (h > 0) parts.push(`${h}小时`);
  if (m > 0) parts.push(`${m}分`);
  if (s > 0 || parts.length === 0) parts.push(`${s}秒`);

  return parts.join("");
}

/**
 * 解析妙记文字记录文本
 *
 * 飞书妙记返回的文字记录格式:
 * ```
 * 2026-01-28 13:53:58 CST|1分钟 24秒
 *
 * 关键词:
 * 缓存、家乡话、脏话
 *
 * 说话人 1
 * 内容...
 *
 * 说话人 2
 * 内容...
 * ```
 */
export function parseTranscript(raw: string): MinuteTranscript {
  const lines = raw.split("\n");
  const result: MinuteTranscript = {
    raw,
    keywords: [],
    dialogues: [],
  };

  let currentSpeaker: string | null = null;
  let currentContent: string[] = [];
  let inKeywords = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // 解析第一行的时间和时长
    if (!result.time && trimmed.includes("|")) {
      const [time, duration] = trimmed.split("|");
      result.time = time.trim();
      result.duration = duration?.trim();
      continue;
    }

    // 解析关键词
    if (trimmed === "关键词:" || trimmed === "关键词：") {
      inKeywords = true;
      continue;
    }

    if (inKeywords && trimmed) {
      // 关键词行，用中文或英文逗号分隔
      result.keywords = trimmed.split(/[,，、]/).map((k) => k.trim()).filter(Boolean);
      inKeywords = false;
      continue;
    }

    // 解析说话人
    const speakerMatch = trimmed.match(/^说话人\s*(\d+|[A-Za-z]+)\s*$/);
    if (speakerMatch) {
      // 保存上一个说话人的内容
      if (currentSpeaker && currentContent.length > 0) {
        result.dialogues.push({
          speaker: currentSpeaker,
          content: currentContent.join("\n").trim(),
        });
      }
      currentSpeaker = `说话人 ${speakerMatch[1]}`;
      currentContent = [];
      continue;
    }

    // 收集对话内容
    if (currentSpeaker && trimmed) {
      currentContent.push(trimmed);
    }
  }

  // 保存最后一个说话人的内容
  if (currentSpeaker && currentContent.length > 0) {
    result.dialogues.push({
      speaker: currentSpeaker,
      content: currentContent.join("\n").trim(),
    });
  }

  return result;
}

/**
 * 格式化解析后的文字记录为可读文本
 */
export function formatTranscript(transcript: MinuteTranscript): string {
  const parts: string[] = [];

  // 时间和时长
  if (transcript.time) {
    parts.push(`📅 ${transcript.time}${transcript.duration ? ` | ${transcript.duration}` : ""}`);
  }

  // 关键词
  if (transcript.keywords.length > 0) {
    parts.push(`🏷️ 关键词: ${transcript.keywords.join("、")}`);
  }

  // 对话
  if (transcript.dialogues.length > 0) {
    parts.push("");
    for (const d of transcript.dialogues) {
      parts.push(`【${d.speaker}】`);
      parts.push(d.content);
      parts.push("");
    }
  }

  return parts.join("\n");
}
