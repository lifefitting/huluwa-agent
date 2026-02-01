/**
 * 飞书妙记演示
 *
 * 使用: npm run demo:feishu [minute_token 或 链接]
 */

import "dotenv/config";
import {
  getMinuteInfo,
  getMinuteStats,
  getMinuteTranscriptRaw,
  extractToken,
  formatDuration,
  parseTranscript,
  formatTranscript,
} from "./index";

async function main() {
  const input = process.argv[2];

  // 显示帮助
  if (!input) {
    console.log("飞书妙记演示\n");
    console.log("使用方法:");
    console.log("  npm run demo:feishu <minute_token>");
    console.log("  npm run demo:feishu <妙记链接>");
    console.log("\n示例:");
    console.log("  npm run demo:feishu obcnjj5te6urc94376w78e89");
    console.log("  npm run demo:feishu https://xxx.feishu.cn/minutes/obcnjj5te6urc94376w78e89");
    process.exit(1);
  }

  try {
    const token = extractToken(input);
    console.log(`\n🔍 获取妙记: ${token}\n`);

    // ─────────────────────────────────────────────
    // 1. 获取妙记详情
    // ─────────────────────────────────────────────
    console.log("📋 妙记详情:");
    const info = await getMinuteInfo(token);
    console.log(`   标题: ${info.title}`);
    console.log(`   时长: ${formatDuration(info.duration)}`);
    console.log(`   创建时间: ${info.createTime}`);
    console.log(`   链接: ${info.url}`);

    // ─────────────────────────────────────────────
    // 2. 获取统计信息
    // ─────────────────────────────────────────────
    console.log("\n📊 统计信息:");
    const stats = await getMinuteStats(token);
    console.log(`   浏览次数: ${stats.pageViewCount}`);
    console.log(`   浏览人数: ${stats.userViewCount}`);

    // ─────────────────────────────────────────────
    // 3. 获取文字记录
    // ─────────────────────────────────────────────
    console.log("\n📝 文字记录:");
    try {
      // 获取原始文本
      const raw = await getMinuteTranscriptRaw(token);
      console.log("   ✅ 获取成功\n");

      // 解析文字记录
      const transcript = parseTranscript(raw);

      // 格式化输出
      const formatted = formatTranscript(transcript);
      console.log("─".repeat(50));

      // 截断显示
      if (formatted.length > 2000) {
        console.log(formatted.slice(0, 2000));
        console.log(`\n... (已截断，共 ${formatted.length} 字符)`);
      } else {
        console.log(formatted);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("FEISHU_USER_ACCESS_TOKEN")) {
        console.log("   ⚠️  需要设置 FEISHU_USER_ACCESS_TOKEN 环境变量");
      } else if (msg.includes("permission") || msg.includes("scope") || msg.includes("403")) {
        console.log("   ⚠️  需要 minutes:minutes.transcript:export 权限");
      } else {
        console.log(`   ❌ ${msg}`);
      }
    }

    console.log("\n✅ 完成");
  } catch (e) {
    console.error("\n❌ 错误:", e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

main();
