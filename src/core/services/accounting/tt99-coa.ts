/**
 * Full Vietnamese Chart of Accounts (COA) according to Circular 99/2025/TT-BTC
 * (Thông tư 99/2025/TT-BTC thay thế TT200/TT133 hiệu lực từ 01/01/2026).
 */
export type TT99AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export interface TT99CoaAccountSeed {
  readonly account_code: string;
  readonly account_name: string;
  readonly account_type: TT99AccountType;
  readonly parent_code?: string;
}

export const TT99_FULL_COA_CATALOG: readonly TT99CoaAccountSeed[] = [
  // ── LOẠI 1: TÀI SẢN NGẮN HẠN (ASSET) ──────────────────────────────────────
  { account_code: '111', account_name: 'Tiền mặt', account_type: 'ASSET' },
  { account_code: '1111', account_name: 'Tiền Việt Nam', account_type: 'ASSET', parent_code: '111' },
  { account_code: '1112', account_name: 'Ngoại tệ', account_type: 'ASSET', parent_code: '111' },
  { account_code: '112', account_name: 'Tiền gửi ngân hàng', account_type: 'ASSET' },
  { account_code: '1121', account_name: 'Tiền Việt Nam', account_type: 'ASSET', parent_code: '112' },
  { account_code: '1122', account_name: 'Ngoại tệ', account_type: 'ASSET', parent_code: '112' },
  { account_code: '113', account_name: 'Tiền đang chuyển', account_type: 'ASSET' },
  { account_code: '121', account_name: 'Chứng khoán kinh doanh', account_type: 'ASSET' },
  { account_code: '128', account_name: 'Đầu tư nắm giữ đến ngày đáo hạn', account_type: 'ASSET' },
  { account_code: '131', account_name: 'Phải thu của khách hàng', account_type: 'ASSET' },
  { account_code: '133', account_name: 'Thuế GTGT được khấu trừ', account_type: 'ASSET' },
  { account_code: '1331', account_name: 'Thuế GTGT được khấu trừ của hàng hóa, dịch vụ', account_type: 'ASSET', parent_code: '133' },
  { account_code: '1332', account_name: 'Thuế GTGT được khấu trừ của TSCĐ', account_type: 'ASSET', parent_code: '133' },
  { account_code: '136', account_name: 'Phải thu nội bộ', account_type: 'ASSET' },
  { account_code: '138', account_name: 'Phải thu khác', account_type: 'ASSET' },
  { account_code: '1381', account_name: 'Tài sản thiếu chờ xử lý', account_type: 'ASSET', parent_code: '138' },
  { account_code: '1383', account_name: 'Thuế TTĐB của hàng nhập khẩu (TT99)', account_type: 'ASSET', parent_code: '138' },
  { account_code: '1388', account_name: 'Phải thu khác', account_type: 'ASSET', parent_code: '138' },
  { account_code: '141', account_name: 'Tạm ứng', account_type: 'ASSET' },
  { account_code: '151', account_name: 'Hàng mua đang đi đường', account_type: 'ASSET' },
  { account_code: '152', account_name: 'Nguyên liệu, vật liệu', account_type: 'ASSET' },
  { account_code: '153', account_name: 'Công cụ, dụng cụ', account_type: 'ASSET' },
  { account_code: '154', account_name: 'Chi phí sản xuất, kinh doanh dở dang', account_type: 'ASSET' },
  { account_code: '155', account_name: 'Thành phẩm', account_type: 'ASSET' },
  { account_code: '156', account_name: 'Hàng hóa', account_type: 'ASSET' },
  { account_code: '157', account_name: 'Hàng gửi đi bán', account_type: 'ASSET' },

  // ── LOẠI 2: TÀI SẢN DÀI HẠN (ASSET) ───────────────────────────────────────
  { account_code: '211', account_name: 'Tài sản cố định hữu hình', account_type: 'ASSET' },
  { account_code: '213', account_name: 'Tài sản cố định vô hình', account_type: 'ASSET' },
  { account_code: '214', account_name: 'Hao mòn tài sản cố định', account_type: 'ASSET' },
  { account_code: '2141', account_name: 'Hao mòn TSCĐ hữu hình', account_type: 'ASSET', parent_code: '214' },
  { account_code: '2143', account_name: 'Hao mòn TSCĐ vô hình', account_type: 'ASSET', parent_code: '214' },
  { account_code: '215', account_name: 'Tài sản sinh học (TT99)', account_type: 'ASSET' },
  { account_code: '217', account_name: 'Bất động sản đầu tư', account_type: 'ASSET' },
  { account_code: '221', account_name: 'Đầu tư vào công ty con', account_type: 'ASSET' },
  { account_code: '222', account_name: 'Đầu tư vào công ty liên doanh, liên kết', account_type: 'ASSET' },
  { account_code: '228', account_name: 'Đầu tư góp vốn vào đơn vị khác', account_type: 'ASSET' },
  { account_code: '229', account_name: 'Dự phòng tổn thất tài sản', account_type: 'ASSET' },
  { account_code: '241', account_name: 'Xây dựng cơ bản dở dang', account_type: 'ASSET' },
  { account_code: '242', account_name: 'Chi phí trả trước', account_type: 'ASSET' },
  { account_code: '243', account_name: 'Tài sản thuế thu nhập hoãn lại', account_type: 'ASSET' },
  { account_code: '244', account_name: 'Cầm cố, thế chấp, ký quỹ, ký cược', account_type: 'ASSET' },

  // ── LOẠI 3: NỢ PHẢI TRẢ (LIABILITY) ───────────────────────────────────────
  { account_code: '331', account_name: 'Phải trả cho người bán', account_type: 'LIABILITY' },
  { account_code: '332', account_name: 'Phải trả cổ tức, lợi nhuận (TT99)', account_type: 'LIABILITY' },
  { account_code: '333', account_name: 'Thuế và các khoản phải nộp Nhà nước', account_type: 'LIABILITY' },
  { account_code: '3331', account_name: 'Thuế giá trị gia tăng phải nộp', account_type: 'LIABILITY', parent_code: '333' },
  { account_code: '3334', account_name: 'Thuế thu nhập doanh nghiệp', account_type: 'LIABILITY', parent_code: '333' },
  { account_code: '3335', account_name: 'Thuế thu nhập cá nhân', account_type: 'LIABILITY', parent_code: '333' },
  { account_code: '3338', account_name: 'Thuế bảo vệ môi trường và các loại thuế khác', account_type: 'LIABILITY', parent_code: '333' },
  { account_code: '334', account_name: 'Phải trả người lao động', account_type: 'LIABILITY' },
  { account_code: '335', account_name: 'Chi phí phải trả', account_type: 'LIABILITY' },
  { account_code: '336', account_name: 'Phải trả nội bộ', account_type: 'LIABILITY' },
  { account_code: '338', account_name: 'Phải trả, phải nộp khác', account_type: 'LIABILITY' },
  { account_code: '3382', account_name: 'Kinh phí công đoàn', account_type: 'LIABILITY', parent_code: '338' },
  { account_code: '3383', account_name: 'Bảo hiểm xã hội', account_type: 'LIABILITY', parent_code: '338' },
  { account_code: '3384', account_name: 'Bảo hiểm y tế', account_type: 'LIABILITY', parent_code: '338' },
  { account_code: '3386', account_name: 'Bảo hiểm thất nghiệp', account_type: 'LIABILITY', parent_code: '338' },
  { account_code: '3387', account_name: 'Doanh thu chưa thực hiện', account_type: 'LIABILITY', parent_code: '338' },
  { account_code: '3388', account_name: 'Phải trả, phải nộp khác', account_type: 'LIABILITY', parent_code: '338' },
  { account_code: '341', account_name: 'Vay và nợ thuê tài chính', account_type: 'LIABILITY' },
  { account_code: '344', account_name: 'Nhận ký quỹ, ký cược', account_type: 'LIABILITY' },
  { account_code: '347', account_name: 'Thuế thu nhập hoãn lại phải trả', account_type: 'LIABILITY' },
  { account_code: '352', account_name: 'Dự phòng phải trả (Bảo hành công trình)', account_type: 'LIABILITY' },
  { account_code: '353', account_name: 'Quỹ khen thưởng, phúc lợi', account_type: 'LIABILITY' },

  // ── LOẠI 4: VỐN CHỦ SỞ HỮU (EQUITY) ───────────────────────────────────────
  { account_code: '411', account_name: 'Vốn đầu tư của chủ sở hữu', account_type: 'EQUITY' },
  { account_code: '4111', account_name: 'Vốn góp của chủ sở hữu', account_type: 'EQUITY', parent_code: '411' },
  { account_code: '4112', account_name: 'Thặng dư vốn cổ phần', account_type: 'EQUITY', parent_code: '411' },
  { account_code: '4118', account_name: 'Vốn khác', account_type: 'EQUITY', parent_code: '411' },
  { account_code: '413', account_name: 'Chênh lệch tỷ giá hối đoái', account_type: 'EQUITY' },
  { account_code: '414', account_name: 'Quỹ đầu tư phát triển', account_type: 'EQUITY' },
  { account_code: '418', account_name: 'Các quỹ khác thuộc vốn chủ sở hữu', account_type: 'EQUITY' },
  { account_code: '421', account_name: 'Lợi nhuận sau thuế chưa phân phối', account_type: 'EQUITY' },
  { account_code: '4211', account_name: 'Lợi nhuận sau thuế chưa phân phối năm trước', account_type: 'EQUITY', parent_code: '421' },
  { account_code: '4212', account_name: 'Lợi nhuận sau thuế chưa phân phối năm nay', account_type: 'EQUITY', parent_code: '421' },

  // ── LOẠI 5: DOANH THU (REVENUE) ───────────────────────────────────────────
  { account_code: '511', account_name: 'Doanh thu bán hàng và cung cấp dịch vụ', account_type: 'REVENUE' },
  { account_code: '5111', account_name: 'Doanh thu bán hàng hóa', account_type: 'REVENUE', parent_code: '511' },
  { account_code: '5112', account_name: 'Doanh thu bán các thành phẩm', account_type: 'REVENUE', parent_code: '511' },
  { account_code: '5113', account_name: 'Doanh thu cung cấp dịch vụ', account_type: 'REVENUE', parent_code: '511' },
  { account_code: '5118', account_name: 'Doanh thu khác', account_type: 'REVENUE', parent_code: '511' },
  { account_code: '515', account_name: 'Doanh thu hoạt động tài chính', account_type: 'REVENUE' },
  { account_code: '521', account_name: 'Các khoản giảm trừ doanh thu', account_type: 'REVENUE' },
  { account_code: '5211', account_name: 'Chiết khấu thương mại', account_type: 'REVENUE', parent_code: '521' },
  { account_code: '5212', account_name: 'Giảm giá hàng bán', account_type: 'REVENUE', parent_code: '521' },
  { account_code: '5213', account_name: 'Hàng bán bị trả lại', account_type: 'REVENUE', parent_code: '521' },

  // ── LOẠI 6: CHI PHÍ SẢN XUẤT, KINH DOANH (EXPENSE) ─────────────────────────
  { account_code: '611', account_name: 'Mua hàng', account_type: 'EXPENSE' },
  { account_code: '621', account_name: 'Chi phí nguyên liệu, vật liệu trực tiếp', account_type: 'EXPENSE' },
  { account_code: '622', account_name: 'Chi phí nhân công trực tiếp', account_type: 'EXPENSE' },
  { account_code: '623', account_name: 'Chi phí sử dụng máy thi công', account_type: 'EXPENSE' },
  { account_code: '627', account_name: 'Chi phí sản xuất chung', account_type: 'EXPENSE' },
  { account_code: '632', account_name: 'Giá vốn hàng bán', account_type: 'EXPENSE' },
  { account_code: '635', account_name: 'Chi phí tài chính', account_type: 'EXPENSE' },
  { account_code: '641', account_name: 'Chi phí bán hàng', account_type: 'EXPENSE' },
  { account_code: '642', account_name: 'Chi phí quản lý doanh nghiệp', account_type: 'EXPENSE' },
  { account_code: '6421', account_name: 'Chi phí nhân viên quản lý', account_type: 'EXPENSE', parent_code: '642' },
  { account_code: '6422', account_name: 'Chi phí vật liệu quản lý', account_type: 'EXPENSE', parent_code: '642' },
  { account_code: '6423', account_name: 'Chi phí đồ dùng văn phòng', account_type: 'EXPENSE', parent_code: '642' },
  { account_code: '6424', account_name: 'Chi phí khấu hao TSCĐ', account_type: 'EXPENSE', parent_code: '642' },
  { account_code: '6425', account_name: 'Thuế, phí và lệ phí', account_type: 'EXPENSE', parent_code: '642' },
  { account_code: '6426', account_name: 'Chi phí dự phòng', account_type: 'EXPENSE', parent_code: '642' },
  { account_code: '6427', account_name: 'Chi phí dịch vụ mua ngoài', account_type: 'EXPENSE', parent_code: '642' },
  { account_code: '6428', account_name: 'Chi phí bằng tiền khác', account_type: 'EXPENSE', parent_code: '642' },

  // ── LOẠI 7: THU NHẬP KHÁC (REVENUE) ───────────────────────────────────────
  { account_code: '711', account_name: 'Thu nhập khác', account_type: 'REVENUE' },

  // ── LOẠI 8: CHI PHÍ KHÁC & THUẾ TNDN (EXPENSE) ────────────────────────────
  { account_code: '811', account_name: 'Chi phí khác', account_type: 'EXPENSE' },
  { account_code: '821', account_name: 'Chi phí thuế thu nhập doanh nghiệp', account_type: 'EXPENSE' },
  { account_code: '8211', account_name: 'Chi phí thuế TNDN hiện hành', account_type: 'EXPENSE', parent_code: '821' },
  { account_code: '8212', account_name: 'Chi phí thuế TNDN hoãn lại', account_type: 'EXPENSE', parent_code: '821' },

  // ── LOẠI 9: XÁC ĐỊNH KẾT QUẢ KINH DOANH (EQUITY) ──────────────────────────
  { account_code: '911', account_name: 'Xác định kết quả kinh doanh', account_type: 'EQUITY' },
];
