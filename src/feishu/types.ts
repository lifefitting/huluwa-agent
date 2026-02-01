/**
 * 飞书妙记类型定义
 */

/**
 * 妙记基本信息
 */
export type MinuteInfo = {
  /** 妙记 token */
  token: string;
  /** 标题 */
  title: string;
  /** 链接 */
  url: string;
  /** 创建时间 (时间戳字符串) */
  createTime: string;
  /** 时长 (秒) */
  duration: number;
  /** 所有者 ID */
  ownerId: string;
  /** 封面图片 URL */
  cover?: string;
};

/**
 * 妙记统计信息
 */
export type MinuteStats = {
  /** 页面浏览次数 */
  pageViewCount: number;
  /** 浏览用户数 */
  userViewCount: number;
};

/**
 * 妙记文字记录（解析后）
 */
export type MinuteTranscript = {
  /** 原始文本 */
  raw: string;
  /** 时间信息 */
  time?: string;
  /** 时长 */
  duration?: string;
  /** 关键词列表 */
  keywords: string[];
  /** 对话内容 */
  dialogues: TranscriptDialogue[];
};

/**
 * 对话条目
 */
export type TranscriptDialogue = {
  /** 说话人 */
  speaker: string;
  /** 内容 */
  content: string;
};
