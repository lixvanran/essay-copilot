/**
 * 题目模板库
 * 分类：中考生 / 高考生 / 日常
 */

export type TopicCategory = '中考' | '高考' | '竞赛' | '日常';

export type TopicPreset = {
  topic: string;
  category: TopicCategory;
  brief?: string;  // 简要要求
};

export const TOPIC_PRESETS: TopicPreset[] = [
  // ===== 中考 =====
  { topic: '那一刻，我长大了', category: '中考', brief: '记叙文，初中阶段' },
  { topic: '原来，温暖一直都在', category: '中考', brief: '记叙文，写亲情/友情' },
  { topic: '最好的礼物', category: '中考', brief: '记叙文，可写实物或精神' },
  { topic: '那束光照亮了我', category: '中考', brief: '记叙文，喻体写法' },
  { topic: '我读懂了你', category: '中考', brief: '记叙文，写人物' },
  { topic: '在那个转弯处', category: '中考', brief: '记叙文，场景描写' },
  { topic: '谢谢那个为我提灯的人', category: '中考', brief: '记叙文，写帮助你的人' },
  { topic: '那一刻，我没有回头', category: '中考', brief: '记叙文，写决心' },
  { topic: '这才是该追的星', category: '中考', brief: '议论文，价值观' },
  { topic: '我们的节日', category: '中考', brief: '记叙文，可写传统节日' },
  { topic: '青春因奋斗而出彩', category: '中考', brief: '议论文' },
  { topic: '在这里，我读懂了___', category: '中考', brief: '半命题，记叙文' },
  { topic: '我的成长之路', category: '中考', brief: '记叙文/议论皆可' },
  { topic: '那一天，我与困难相拥', category: '中考', brief: '记叙文' },
  { topic: '让___开在心间', category: '中考', brief: '半命题' },

  // ===== 高考 =====
  { topic: '时间的礼物', category: '高考', brief: '议论文/散文，时间感悟' },
  { topic: '重塑自我', category: '高考', brief: '议论文' },
  { topic: '如何看待内卷', category: '高考', brief: '议论文，社会现象' },
  { topic: '何为真正的英雄', category: '高考', brief: '议论文，价值观' },
  { topic: '我想握住你的手', category: '高考', brief: '散文/记叙文' },
  { topic: '熟悉的地方也有风景', category: '高考', brief: '散文' },
  { topic: '人生需要留白', category: '高考', brief: '议论文/散文' },
  { topic: '穿越时空的对话', category: '高考', brief: '想象类' },
  { topic: '青年的责任与担当', category: '高考', brief: '议论文' },
  { topic: '也说"佛系"心态', category: '高考', brief: '议论文' },
  { topic: '大道至简', category: '高考', brief: '议论文/哲思' },
  { topic: '我看传统文化的回归', category: '高考', brief: '议论文' },

  // ===== 竞赛 =====
  { topic: '如果我可以重新定义失败', category: '竞赛', brief: '哲理散文' },
  { topic: '写给十年后自己的一封信', category: '竞赛', brief: '书信体' },
  { topic: '沉默的重量', category: '竞赛', brief: '散文' },
  { topic: '技术与人文的边界', category: '竞赛', brief: '议论文/学术' },
  { topic: '论怀疑精神的当代价值', category: '竞赛', brief: '议论文' },

  // ===== 日常 =====
  { topic: '下雨了', category: '日常' },
  { topic: '那个陌生人', category: '日常' },
  { topic: '今天我想___', category: '日常', brief: '半命题' },
  { topic: '我家的味道', category: '日常' }
];

/**
 * 按分类分组
 */
export function topicsByCategory(): Record<TopicCategory, TopicPreset[]> {
  const grouped: Record<TopicCategory, TopicPreset[]> = {
    '中考': [], '高考': [], '竞赛': [], '日常': []
  };
  for (const t of TOPIC_PRESETS) {
    grouped[t.category].push(t);
  }
  return grouped;
}