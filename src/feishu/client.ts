/**
 * 飞书客户端
 *
 * 基于官方 @larksuiteoapi/node-sdk
 * 文档: https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/server-side-sdk/nodejs-sdk/preparation-before-development
 */

import * as lark from "@larksuiteoapi/node-sdk";

// ─────────────────────────────────────────────────
// 配置
// ─────────────────────────────────────────────────

const DEFAULT_APP_ID = "cli_a180879668f9d013";

// ─────────────────────────────────────────────────
// 客户端管理
// ─────────────────────────────────────────────────

let cachedClient: lark.Client | null = null;

/**
 * 获取飞书客户端 (单例)
 */
export function getClient(): lark.Client {
  if (cachedClient) {
    return cachedClient;
  }

  const appId = process.env.FEISHU_APP_ID ?? DEFAULT_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;

  if (!appSecret) {
    throw new Error(
      "缺少 FEISHU_APP_SECRET 环境变量\n" +
        "请在 .env 文件中设置飞书应用密钥"
    );
  }

  cachedClient = new lark.Client({
    appId,
    appSecret,
    appType: lark.AppType.SelfBuild,
    domain: lark.Domain.Feishu,
    loggerLevel: lark.LoggerLevel.info,
  });

  return cachedClient;
}

/**
 * 清除客户端缓存
 */
export function clearClient(): void {
  cachedClient = null;
}

// ─────────────────────────────────────────────────
// Token 管理
// ─────────────────────────────────────────────────

/**
 * 获取 user_access_token
 */
export function getUserToken(): string | undefined {
  return process.env.FEISHU_USER_ACCESS_TOKEN;
}

/**
 * 获取 user_access_token (必须存在)
 */
export function requireUserToken(): string {
  const token = getUserToken();
  if (!token) {
    throw new Error(
      "缺少 FEISHU_USER_ACCESS_TOKEN 环境变量\n" +
        "请在 .env 文件中设置用户访问令牌"
    );
  }
  return token;
}

/**
 * 获取 SDK 请求选项 (自动选择 user/tenant token)
 */
export function getRequestOptions() {
  const userToken = getUserToken();
  return userToken ? lark.withUserAccessToken(userToken) : undefined;
}

// ─────────────────────────────────────────────────
// 导出
// ─────────────────────────────────────────────────

export { lark };
