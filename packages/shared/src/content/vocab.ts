// Starter vocabulary: Taiwan words, Traditional characters (zh-Hant-TW) and readings from the
// MOE 《重編國語辭典修訂本》, checked against moedict.tw (see README).
// pinyin: numbered, one syllable per character, citation tones, 5 = neutral.

import type { Note, Topic, TopicId, Word } from './types.ts';

export const TOPICS: Topic[] = [
  { id: 'greetings', zh: '問候', en: 'Greetings', ky: 'Саламдашуу' },
  { id: 'people', zh: '人', en: 'People', ky: 'Адамдар' },
  { id: 'numbers', zh: '數字', en: 'Numbers', ky: 'Сандар' },
  { id: 'food', zh: '吃喝', en: 'Food & drink', ky: 'Тамак-аш жана суусундук' },
  { id: 'taiwan', zh: '臺灣生活', en: 'Life in Taiwan', ky: 'Тайвандагы жашоо' },
  { id: 'time', zh: '時間', en: 'Time', ky: 'Убакыт' },
  { id: 'actions', zh: '動作', en: 'Actions', ky: 'Аракеттер' },
  { id: 'describing', zh: '形容', en: 'Describing', ky: 'Сыпаттоо' },
  { id: 'questions', zh: '問題', en: 'Questions', ky: 'Суроолор' },
];

type Extra = Pick<Word, 'mainland' | 'readingUnverified'>;
type Row = [
  id: string,
  hanzi: string,
  pinyin: string,
  en: string,
  ky: string,
  tw?: Note,
  extra?: Extra,
];

const rows = (topic: TopicId, list: Row[]): Word[] =>
  list.map(([id, hanzi, pinyin, en, ky, tw, extra]) => ({
    id,
    hanzi,
    pinyin,
    en,
    ky,
    topic,
    tw,
    ...extra,
  }));

// prettier-ignore
export const VOCAB: Word[] = [
  ...rows('greetings', [
    ['ni-hao', '你好', 'ni3 hao3', 'hello', 'салам'],
    ['nin-hao', '您好', 'nin2 hao3', 'hello (polite)', 'саламатсызбы (сылык)'],
    ['ni-hao-ma', '你好嗎', 'ni3 hao3 ma5', 'how are you?', 'кандайсың?'],
    ['zao-an', '早安', 'zao3 an1', 'good morning', 'кутман таң', {
      en: 'The everyday morning greeting in Taiwan.',
      ky: 'Тайванда эртең менен эң көп колдонулган учурашуу.',
    }],
    ['wan-an', '晚安', 'wan3 an1', 'good night', 'жакшы түн'],
    ['xie-xie', '謝謝', 'xie4 xie5', 'thank you', 'рахмат'],
    ['bu-ke-qi', '不客氣', 'bu4 ke4 qi4', "you're welcome", 'эч нерсе эмес (рахматка жооп)', {
      en: '不 is read bú before a 4th tone. Taiwan keeps the full tone on 氣.',
      ky: '不 4-тондун алдында bú болуп окулат. Тайванда 氣 толук тону менен айтылат.',
    }],
    ['dui-bu-qi', '對不起', 'dui4 bu5 qi3', 'sorry', 'кечиресиз'],
    ['mei-guan-xi', '沒關係', 'mei2 guan1 xi5', "it's okay, never mind", 'эчтеке эмес'],
    ['bu-hao-yi-si', '不好意思', 'bu4 hao3 yi4 si5', 'excuse me, sorry (light)', 'кечиресиз, ыңгайсыз болду', {
      en: 'Very common in Taiwan: small apologies, getting attention, declining politely.',
      ky: 'Тайванда абдан көп: кичине кечирим, көңүл буруу, сылык баш тартуу үчүн.',
    }],
    ['qing-wen', '請問', 'qing3 wen4', 'excuse me, may I ask…', 'сурасам болобу…'],
    ['zai-jian', '再見', 'zai4 jian4', 'goodbye', 'көрүшкөнчө'],
  ]),
  ...rows('people', [
    ['wo', '我', 'wo3', 'I, me', 'мен'],
    ['ni', '你', 'ni3', 'you', 'сен'],
    ['ta-he', '他', 'ta1', 'he, him', 'ал (эркек)'],
    ['ta-she', '她', 'ta1', 'she, her', 'ал (аял)'],
    ['wo-men', '我們', 'wo3 men5', 'we, us', 'биз'],
    ['peng-you', '朋友', 'peng2 you3', 'friend', 'дос'],
    ['lao-shi', '老師', 'lao3 shi1', 'teacher', 'мугалим'],
    ['xue-sheng', '學生', 'xue2 sheng1', 'student', 'окуучу, студент'],
    ['tong-xue', '同學', 'tong2 xue2', 'classmate', 'классташ'],
    ['ba-ba', '爸爸', 'ba4 ba5', 'dad', 'ата'],
    ['ma-ma', '媽媽', 'ma1 ma5', 'mom', 'апа'],
    ['xian-sheng', '先生', 'xian1 sheng1', 'Mr., sir; husband', 'мырза; күйөө'],
    ['xiao-jie', '小姐', 'xiao3 jie3', 'Miss, young lady', 'айым, кыз'],
  ]),
  ...rows('numbers', [
    ['yi', '一', 'yi1', 'one', 'бир'],
    ['er', '二', 'er4', 'two', 'эки'],
    ['san', '三', 'san1', 'three', 'үч'],
    ['si', '四', 'si4', 'four', 'төрт'],
    ['wu', '五', 'wu3', 'five', 'беш'],
    ['liu', '六', 'liu4', 'six', 'алты'],
    ['qi', '七', 'qi1', 'seven', 'жети'],
    ['ba', '八', 'ba1', 'eight', 'сегиз'],
    ['jiu', '九', 'jiu3', 'nine', 'тогуз'],
    ['shi', '十', 'shi2', 'ten', 'он'],
    ['bai', '百', 'bai3', 'hundred', 'жүз'],
    ['liang', '兩', 'liang3', 'two (of something)', 'эки (эсептөөдө)'],
    ['yi-bai-kuai', '一百塊', 'yi1 bai3 kuai4', 'a hundred dollars (NT$100)', 'жүз доллар (NT$100)', {
      en: '塊 is the everyday word for NT dollars (元 in writing). 一 is read yì here.',
      ky: '塊 — жаңы Тайвань доллары үчүн күнүмдүк сөз (жазууда 元). Бул жерде 一 yì болуп окулат.',
    }],
  ]),
  ...rows('food', [
    ['chi', '吃', 'chi1', 'to eat', 'жеш'],
    ['he', '喝', 'he1', 'to drink', 'ичүү'],
    ['shui', '水', 'shui3', 'water', 'суу'],
    ['cha', '茶', 'cha2', 'tea', 'чай'],
    ['ka-fei', '咖啡', 'ka1 fei1', 'coffee', 'кофе'],
    ['fan', '飯', 'fan4', 'rice; meal', 'күрүч; тамак'],
    ['zao-can', '早餐', 'zao3 can1', 'breakfast', 'эртең мененки тамак'],
    ['bian-dang', '便當', 'bian4 dang1', 'lunch box (bento)', 'кутудагы түшкү тамак (бэнто)', {
      en: 'Boxed meals sold everywhere in Taiwan, from the Japanese bentō.',
      ky: 'Тайванда бардык жерде сатылган кутудагы тамак. Жапончо bentō сөзүнөн.',
    }],
    ['zhen-zhu-nai-cha', '珍珠奶茶', 'zhen1 zhu1 nai3 cha2', 'bubble milk tea', 'тапиока шарлары бар сүттүү чай', {
      en: 'Invented in Taiwan. Often shortened to 珍奶.',
      ky: 'Тайванда ойлоп табылган. Көбүнчө кыскача 珍奶 дешет.',
    }],
    ['niu-rou-mian', '牛肉麵', 'niu2 rou4 mian4', 'beef noodle soup', 'уй эти кошулган кесме шорпо', {
      en: "One of Taiwan's signature dishes.",
      ky: 'Тайвандын эң белгилүү тамактарынын бири.',
    }],
    ['xiao-long-bao', '小籠包', 'xiao3 long2 bao1', 'soup dumplings', 'шорполуу кичинекей манты'],
    ['dou-jiang', '豆漿', 'dou4 jiang1', 'soy milk', 'соя сүтү', {
      en: 'A classic Taiwanese breakfast drink, often with 蛋餅 (egg crepe).',
      ky: 'Тайвандын салттуу эртең мененки суусундугу, көбүнчө 蛋餅 менен.',
    }],
    ['cai-dan', '菜單', 'cai4 dan1', 'menu', 'меню'],
    ['hao-chi', '好吃', 'hao3 chi1', 'delicious', 'даамдуу'],
    ['e', '餓', 'e4', 'hungry', 'ачка'],
  ]),
  ...rows('taiwan', [
    ['tai-wan', '臺灣', 'tai2 wan1', 'Taiwan', 'Тайвань', {
      en: '臺 is the standard form, used in official names. 台 (台灣) is the common everyday form.',
      ky: '臺 — стандарттык түрү, расмий аталыштарда колдонулат. 台 (台灣) — күнүмдүк жазылышы.',
    }],
    ['tai-bei', '臺北', 'tai2 bei3', 'Taipei', 'Тайбэй', {
      en: 'Official form 臺北; everyday writing often uses 台北.',
      ky: 'Расмий түрү 臺北; күнүмдүк жазууда көбүнчө 台北.',
    }],
    ['jie-yun', '捷運', 'jie2 yun4', 'MRT, metro', 'метро', {
      en: 'Short for 大眾捷運系統: the MRT in Taipei, Kaohsiung and Taoyuan.',
      ky: '大眾捷運系統 сөзүнүн кыскартылышы: Тайбэй, Гаосюн жана Таоюандагы метро.',
    }, { mainland: '地鐵' }],
    ['gong-che', '公車', 'gong1 che1', 'bus', 'автобус', {
      en: 'City buses. Pay with 悠遊卡 or cash.',
      ky: 'Шаардык автобус. 悠遊卡 же накталай акча менен төлөйсүң.',
    }, { mainland: '公交車' }],
    ['ji-che', '機車', 'ji1 che1', 'scooter, motorbike', 'скутер, мотоцикл', {
      en: 'Scooters are everywhere in Taiwan. As slang, 機車 also means "annoying".',
      ky: 'Тайванда скутер бардык жерде. Жаргондо 機車 «жаман мүнөз, кыжырдантат» дегенди да билдирет.',
    }, { mainland: '摩托車' }],
    ['jiao-ta-che', '腳踏車', 'jiao3 ta4 che1', 'bicycle', 'велосипед', {
      en: 'Also called 單車. Rent one with YouBike.',
      ky: '單車 деп да айтылат. YouBike аркылуу ижарага алса болот.',
    }, { mainland: '自行車' }],
    ['gao-tie', '高鐵', 'gao1 tie3', 'high-speed rail', 'ылдам поезд', {
      en: 'Taiwan High Speed Rail (THSR), Taipei–Kaohsiung in about 90 minutes.',
      ky: 'Тайвандын ылдам темир жолу: Тайбэй–Гаосюн болжол менен 90 мүнөт.',
    }],
    ['huo-che-zhan', '火車站', 'huo3 che1 zhan4', 'train station', 'темир жол бекети'],
    ['ji-cheng-che', '計程車', 'ji4 cheng2 che1', 'taxi', 'такси', {
      en: 'Yellow taxis. Wave one down or book one in an app.',
      ky: 'Сары такси. Кол көтөрүп токтотсоң же колдонмо аркылуу чакырсаң болот.',
    }, { mainland: '出租車' }],
    ['you-you-ka', '悠遊卡', 'you1 you2 ka3', 'EasyCard (transit card)', 'EasyCard (транспорт картасы)', {
      en: 'Taipei transit card. Also pays at convenience stores.',
      ky: 'Тайбэйдин транспорт картасы. Дүкөндөрдө да төлөсө болот.',
    }],
    ['bian-li-shang-dian', '便利商店', 'bian4 li4 shang1 dian4', 'convenience store', '24 сааттык дүкөн', {
      en: '7-Eleven, FamilyMart… on every corner. You can also pay bills and pick up parcels there.',
      ky: '7-Eleven, FamilyMart… ар бир бурчта. Ал жерден эсеп төлөп, посылка да алса болот.',
    }, { mainland: '便利店' }],
    ['ye-shi', '夜市', 'ye4 shi4', 'night market', 'түнкү базар', {
      en: 'Street food and shopping at night, a core part of Taiwan life.',
      ky: 'Түнкү көчө тамагы жана соода. Тайвандагы жашоонун негизги бөлүгү.',
    }],
    ['le-se', '垃圾', 'le4 se4', 'garbage', 'таштанды', {
      en: 'Taiwan reading lè sè (MOE dictionary). Mainland: lā jī.',
      ky: 'Тайванча окулушу lè sè (Билим берүү министрлигинин сөздүгү). Материкте: lā jī.',
    }],
    ['le-se-che', '垃圾車', 'le4 se4 che1', 'garbage truck', 'таштанды машинасы', {
      en: 'Plays music (often Für Elise). You bring your trash out to meet it.',
      ky: 'Музыка ойнотуп келет (көбүнчө «Für Elise»). Таштандыны өзүң алып чыгасың.',
    }],
    ['shou-ji', '手機', 'shou3 ji1', 'mobile phone', 'уюлдук телефон'],
    ['wang-lu', '網路', 'wang3 lu4', 'internet', 'интернет', {
      en: 'The Taiwan word. 上網 means to go online.',
      ky: 'Тайванча айтылышы. 上網 — интернетке кирүү.',
    }, { mainland: '網絡' }],
    ['leng-qi', '冷氣', 'leng3 qi4', 'air conditioning', 'кондиционер', {
      en: 'On everywhere in summer. 開冷氣 means to turn on the AC.',
      ky: 'Жайында бардык жерде күйүп турат. 開冷氣 — кондиционерди күйгүзүү.',
    }, { mainland: '空調' }],
    ['ce-suo', '廁所', 'ce4 suo3', 'toilet, restroom', 'даараткана'],
  ]),
  ...rows('time', [
    ['jin-tian', '今天', 'jin1 tian1', 'today', 'бүгүн'],
    ['ming-tian', '明天', 'ming2 tian1', 'tomorrow', 'эртең'],
    ['zuo-tian', '昨天', 'zuo2 tian1', 'yesterday', 'кечээ'],
    ['xian-zai', '現在', 'xian4 zai4', 'now', 'азыр'],
    ['xing-qi', '星期', 'xing1 qi2', 'week', 'апта', {
      en: 'Taiwan reads 期 as qí (MOE dictionary). Mainland: qī.',
      ky: 'Тайванда 期 qí болуп окулат (Билим берүү министрлигинин сөздүгү). Материкте: qī.',
    }],
    ['xing-qi-yi', '星期一', 'xing1 qi2 yi1', 'Monday', 'дүйшөмбү'],
    ['xing-qi-tian', '星期天', 'xing1 qi2 tian1', 'Sunday', 'жекшемби', {
      en: '星期日 is also common in Taiwan, especially in writing.',
      ky: 'Тайванда 星期日 да көп колдонулат, айрыкча жазууда.',
    }],
    ['zao-shang', '早上', 'zao3 shang5', 'morning', 'эртең менен'],
    ['wan-shang', '晚上', 'wan3 shang5', 'evening', 'кечинде'],
    ['dian', '點', 'dian3', "o'clock", 'саат (убакыт)'],
    ['shi-hou', '時候', 'shi2 hou4', 'time, moment', 'убак, маал'],
    ['nian', '年', 'nian2', 'year', 'жыл'],
  ]),
  ...rows('actions', [
    ['qu', '去', 'qu4', 'to go', 'баруу'],
    ['lai', '來', 'lai2', 'to come', 'келүү'],
    ['kan', '看', 'kan4', 'to look, watch, read', 'көрүү, окуу'],
    ['ting', '聽', 'ting1', 'to listen', 'угуу'],
    ['shuo', '說', 'shuo1', 'to speak, say', 'айтуу, сүйлөө'],
    ['mai', '買', 'mai3', 'to buy', 'сатып алуу'],
    ['xue', '學', 'xue2', 'to learn', 'үйрөнүү'],
    ['xi-huan', '喜歡', 'xi3 huan1', 'to like', 'жактыруу', {
      en: 'Taiwan speakers usually keep the full tone: xǐhuān.',
      ky: 'Тайванда көбүнчө толук тону менен айтылат: xǐhuān.',
    }],
    ['xiang', '想', 'xiang3', 'to want; to think', 'каалоо; ойлоо'],
    ['yao', '要', 'yao4', 'to want, need', 'каалоо, керек'],
    ['you', '有', 'you3', 'to have; there is', 'бар'],
    ['shi-be', '是', 'shi4', 'to be', 'болуу (…болот)'],
    ['zuo', '坐', 'zuo4', 'to sit; to ride (bus, MRT)', 'отуруу; (унаага) түшүү'],
    ['shui-jiao', '睡覺', 'shui4 jiao4', 'to sleep', 'уктоо'],
    ['gong-zuo', '工作', 'gong1 zuo4', 'to work; job', 'иштөө; жумуш'],
  ]),
  ...rows('describing', [
    ['hao', '好', 'hao3', 'good', 'жакшы'],
    ['hen', '很', 'hen3', 'very', 'абдан'],
    ['da', '大', 'da4', 'big', 'чоң'],
    ['xiao', '小', 'xiao3', 'small', 'кичине'],
    ['duo', '多', 'duo1', 'many, much', 'көп'],
    ['shao', '少', 'shao3', 'few, little', 'аз'],
    ['re', '熱', 're4', 'hot', 'ысык'],
    ['leng', '冷', 'leng3', 'cold', 'суук'],
    ['gui', '貴', 'gui4', 'expensive', 'кымбат'],
    ['pian-yi', '便宜', 'pian2 yi5', 'cheap', 'арзан'],
    ['piao-liang', '漂亮', 'piao4 liang5', 'pretty, beautiful', 'сулуу, кооз'],
    ['ke-ai', '可愛', 'ke3 ai4', 'cute', 'сүйкүмдүү'],
    ['lei', '累', 'lei4', 'tired', 'чарчаган'],
    ['mang', '忙', 'mang2', 'busy', 'бош эмес'],
  ]),
  ...rows('questions', [
    ['shen-me', '什麼', 'shen2 me5', 'what', 'эмне'],
    ['shei', '誰', 'shei2', 'who', 'ким', {
      en: 'Taiwan says shéi (shuí is a formal reading).',
      ky: 'Тайванда shéi дешет (shuí — расмий окулушу).',
    }],
    ['na-li', '哪裡', 'na3 li3', 'where', 'кайда', {
      en: 'Taiwan uses 哪裡. 哪兒 sounds northern.',
      ky: 'Тайванда 哪裡 дешет. 哪兒 түндүк кытайча угулат.',
    }, { readingUnverified: true }],
    ['shen-me-shi-hou', '什麼時候', 'shen2 me5 shi2 hou4', 'when', 'качан'],
    ['wei-shen-me', '為什麼', 'wei4 shen2 me5', 'why', 'эмне үчүн'],
    ['zen-me', '怎麼', 'zen3 me5', 'how', 'кантип'],
    ['duo-shao-qian', '多少錢', 'duo1 shao3 qian2', 'how much (money)?', 'канча турат?'],
    ['ji', '幾', 'ji3', 'how many (small numbers)', 'канча (аз сан)'],
    ['ma', '嗎', 'ma5', 'question particle', 'суроо бөлүкчөсү (-бы/-би)'],
  ]),
];

export const WORD_BY_ID: ReadonlyMap<string, Word> = new Map(VOCAB.map((w) => [w.id, w]));
