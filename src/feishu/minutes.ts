/**
 * 飞书妙记 API
 *
 * 所有 API 调用均使用官方 @larksuiteoapi/node-sdk
 */

import { getClient, getRequestOptions, requireUserToken, lark } from "./client";
import { extractToken } from "./utils";
import type { MinuteInfo, MinuteStats } from "./types";

// ─────────────────────────────────────────────────
// 获取妙记详情
// ─────────────────────────────────────────────────

/**
 * 获取妙记详情
 *
 * @param minuteToken - 妙记 token 或链接
 * @returns 妙记信息
 *
 * @example
 * const info = await getMinuteInfo("obcnjj5te6urc94376w78e89");
 * console.log(info.title, info.duration);
 */
export async function getMinuteInfo(minuteToken: string): Promise<MinuteInfo> {
  const client = getClient();
  const token = extractToken(minuteToken);
  const options = getRequestOptions();

  // 使用官方 SDK 调用 API
  const res = await client.minutes.v1.minute.get(
    { path: { minute_token: token } },
    options
  );

  // 错误处理
  if (res.code !== 0) {
    throw new Error(`获取妙记详情失败: [${res.code}] ${res.msg}`);
  }

  const data = res.data?.minute;
  if (!data) {
    throw new Error("API 未返回妙记数据");
  }

  // 转换为内部类型
  return {
    token: data.token ?? token,
    title: data.title ?? "",
    url: data.url ?? "",
    createTime: data.create_time ?? "",
    duration: parseInt(String(data.duration ?? 0), 10),
    ownerId: data.owner_id ?? "",
    cover: data.cover,
  };
}

// ─────────────────────────────────────────────────
// 获取妙记统计
// ─────────────────────────────────────────────────

/**
 * 获取妙记统计信息
 *
 * @param minuteToken - 妙记 token 或链接
 * @returns 统计信息
 */
export async function getMinuteStats(minuteToken: string): Promise<MinuteStats> {
  const client = getClient();
  const token = extractToken(minuteToken);
  const options = getRequestOptions();

  // 使用官方 SDK 调用 API
  const res = await client.minutes.v1.minuteStatistics.get(
    { path: { minute_token: token } },
    options
  );

  // 错误处理
  if (res.code !== 0) {
    throw new Error(`获取妙记统计失败: [${res.code}] ${res.msg}`);
  }

  const stats = res.data?.statistics;

  // 转换为内部类型
  return {
    pageViewCount: parseInt(stats?.page_view_count ?? "0", 10),
    userViewCount: parseInt(stats?.user_view_count ?? "0", 10),
  };
}

// ─────────────────────────────────────────────────
// 获取妙记文字记录
// ─────────────────────────────────────────────────

/**
 * 获取妙记文字记录 (原始文本)
 *
 * 需要权限:
 * - user_access_token
 * - minutes:minutes.transcript:export
 *
 * @param minuteToken - 妙记 token 或链接
 * @returns 文字记录纯文本
 */
export async function getMinuteTranscriptRaw(minuteToken: string): Promise<string> {
  const client = getClient();
  const token = extractToken(minuteToken);
  const userToken = requireUserToken();

  // 使用官方 SDK 调用 API
  // minuteTranscript.get 返回流类型，需要读取流内容
  const res = await client.minutes.v1.minuteTranscript.get(
    { path: { minute_token: token } },
    lark.withUserAccessToken(userToken)
  );

  // SDK 返回的是流对象，需要读取
  if (res.getReadableStream) {
    const stream = res.getReadableStream();
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks).toString("utf-8");
  }

  // 如果不是流，尝试作为文本处理
  return String(res);
}
