// Mainland forms that must not appear as the main form anywhere in the app.
// OpenCC's Taiwan phrase table misses many of these when they are written in Traditional
// characters (地鐵, 出租車, 公交車, 空調, 便利店, 摩托車, 菠蘿, 質量 pass through unchanged),
// so they are listed explicitly. Only unambiguous terms belong here.

/** Mainland word → Taiwan word. */
export const MAINLAND_TERMS: Readonly<Record<string, string>> = {
  地鐵: '捷運',
  出租車: '計程車',
  的士: '計程車',
  公交車: '公車',
  自行車: '腳踏車',
  摩托車: '機車',
  空調: '冷氣',
  便利店: '便利商店',
  網絡: '網路',
  軟件: '軟體',
  視頻: '影片',
  質量: '品質',
  短信: '簡訊',
  菠蘿: '鳳梨',
  信息: '資訊',
  打印: '列印',
  鼠標: '滑鼠',
  激光: '雷射',
  博客: '部落格',
  人工智能: '人工智慧',
  酸奶: '優酪乳',
  冰激凌: '冰淇淋',
  盒飯: '便當',
};

/**
 * Character → Mainland readings (numbered pinyin) that differ from the Taiwan MOE reading.
 * 垃圾 lèsè, 期 qí, 危 wéi, 企 qì, 液 yì, 暫 zhàn, 綜 zòng, 研究 yánjiù, 頭髮 tóufǎ.
 */
export const MAINLAND_READINGS: Readonly<Record<string, readonly string[]>> = {
  垃: ['la1'],
  圾: ['ji1'],
  期: ['qi1'],
  危: ['wei1'],
  企: ['qi3'],
  液: ['ye4'],
  暫: ['zan4'],
  綜: ['zong1'],
  究: ['jiu1'],
  髮: ['fa4', 'fa5'],
};
