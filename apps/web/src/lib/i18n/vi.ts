// The app's words in Vietnamese (tiếng Việt), key for key with en.ts.

import type { Messages } from './en';

export const vi: Messages = {
  app: {
    name: 'Tiếng Hoa Đài Loan',
    offlineReady: 'Sẵn sàng dùng ngoại tuyến',
    offlineReadyBody: 'Những từ bạn mở từ giờ sẽ dùng được cả khi không có mạng.',
    loadFailed: 'Không tải được danh sách từ.',
    tryAgain: 'Thử lại',
    dismiss: 'Đóng',
  },

  titles: {
    today: 'Hôm nay',
    study: 'Học',
    path: 'Lộ trình',
    read: 'Đọc',
    dict: 'Từ điển',
    talk: 'Trò chuyện',
    me: 'Tôi',
    'me-account': 'Tài khoản',
    'me-settings': 'Cài đặt',
    'me-garden': 'Khu vườn',
    'me-levels': 'Theo cấp độ',
    'me-about': 'Giới thiệu',
    welcome: 'Chào mừng',
    level: 'Cấp độ',
    word: 'Từ',
    reader: 'Bài đọc',
  },

  nav: {
    main: 'Điều hướng chính',
    home: 'Trang chủ 臺灣華語',
    due: (n) => `${n} thẻ đến hạn`,
  },

  levels: {
    N1: 'Dự bị 1',
    N2: 'Dự bị 2',
    L1: 'Cấp 1',
    L2: 'Cấp 2',
    L3: 'Cấp 3',
    L4: 'Cấp 4',
    L5: 'Cấp 5',
    L6: 'Cấp 6',
  },
  topics: {
    core: 'Từ cốt lõi',
    personal: 'Về bản thân',
    social: 'Con người & quan hệ',
    daily: 'Sinh hoạt & nhà cửa',
    food: 'Ăn uống & nấu nướng',
    shopping: 'Mua sắm',
    travel: 'Đi lại & du lịch',
    leisure: 'Thời gian rảnh',
    education: 'Trường học & học tập',
    work: 'Công việc',
    body: 'Cơ thể & sức khỏe',
    feelings: 'Cảm xúc & thái độ',
    nature: 'Thiên nhiên & thời tiết',
    culture: 'Văn hóa',
    society: 'Xã hội',
    public: 'Dịch vụ công',
    safety: 'An toàn',
    tech: 'Công nghệ',
  },
  scenarios: {
    'night-market': 'Gọi món ở quầy chợ đêm',
    'bubble-tea': 'Mua trà sữa',
    mrt: 'Hỏi đường ở ga MRT',
    'convenience-store': 'Ở cửa hàng tiện lợi',
    classmate: 'Làm quen bạn học mới',
    clinic: 'Đi khám bệnh',
    renting: 'Xem phòng cho thuê',
    free: 'Trò chuyện tự do',
  },

  companion: {
    welcome: 'xin chào!',
    today: 'chào buổi sáng!',
    study: 'cố lên!',
    path: 'từng bước một',
    level: 'leo núi nào',
    word: 'từ này nè',
    read: 'giờ đọc sách',
    reader: 'suỵt…',
    dict: 'tra thử xem',
    talk: 'nói chuyện nhé',
    me: 'là bạn nè!',
    'me-account': 'chào mừng',
    'me-settings': 'chỉnh chút nào',
    'me-garden': 'đẹp quá',
    'me-levels': 'nhiều cấp quá',
    'me-about': 'mình là Mặc',
  },
  taps: ['này!', 'haha', 'tưng!', 'nữa đi!', 'nhột quá'],

  week: {
    label: 'Tuần này',
    days: ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'],
    done: 'đã học',
    mended: 'đã hàn vàng',
    crack: 'bỏ lỡ, vẫn còn hàn lại được',
    empty: 'không học',
    today: 'hôm nay, chưa học',
    future: 'chưa tới',
  },

  interval: {
    underMinute: '<1 ph',
    minutes: (n) => `${n} ph`,
    hours: (n) => `${n} giờ`,
    days: (n) => `${n} ngày`,
    months: (n) => `${n} th`,
    years: (n) => `${n} năm`,
  },

  seals: {
    names: {
      'first-day': 'Ngày học đầu tiên',
      'first-gold': 'Lần đầu hàn vàng chỗ hở',
      'bowl-7': 'Cây non 7 ngày',
      'bowl-30': 'Ra nụ sau 30 ngày',
      'bowl-100': 'Nở rộ sau 100 ngày',
      'words-100': '100 từ mới',
      'words-500': '500 từ mới',
      'words-1000': '1.000 từ mới',
      'xp-10000': '10.000 XP',
    },
    count: (earned, total) => `${earned}/${total} con dấu`,
    progress: (percent) => `đã được ${percent}%`,
  },

  celebrate: {
    mended: 'Hàn vàng',
    mendedBody: (missed, days) =>
      `Bạn đã quay lại, và ${missed === 1 ? 'ngày bỏ lỡ' : `${missed} ngày bỏ lỡ`} đã hóa vàng. ` +
      `${days} ngày lớn lên.`,
    sprout: 'Mầm mới',
    sproutBody:
      'Cây trước của bạn đã vào khu vườn, cùng những đường vàng. Cây này bắt đầu từ hôm nay.',
    newSeal: (name) => `Con dấu mới · ${name}`,
    plant: 'Cây chuỗi ngày của bạn',
  },

  welcome: {
    says: [
      'xin chào!',
      'lên đường nào',
      'từng bước một',
      'cứ từ từ',
      'cố lên!',
      'giỏi quá',
      'sắp tới rồi',
      'thêm chút nữa',
      'tới nơi rồi!',
    ],
    bloomed: 'nở hoa rồi!',
  },
};
