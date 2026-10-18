'use client';

/**
 * Bella Education — Student 360° Comprehensive Profile Workspace
 * 
 * Central Student 360° Architecture:
 * - Domain Convergence: Guardians, Enrollment History, Attendance, Health, Nutrition, Parent Comms, Finance
 * - Tabs: Tổng Quan 360° | Cá Nhân & Giám Hộ | Lịch Sử Ghi Danh | Sức Khỏe & Dinh Dưỡng
 * - Direct deep links to vertical services (Sổ liên lạc, Điểm danh, Đánh giá phát triển, Học phí)
 * - Comprehensive canonical dataset covering all children in health alerts, incomplete docs, birthdays, pending admissions
 * - Strict type safety: Zero any and zero unknown
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { 
  ArrowLeft, 
  Baby, 
  Users, 
  CalendarCheck, 
  Heart, 
  Utensils, 
  MessageSquare, 
  GraduationCap, 
  MapPin, 
  CheckCircle2, 
  AlertTriangle, 
  Phone, 
  Mail, 
  Home, 
  CreditCard, 
  Clock, 
  Activity, 
  Syringe, 
  Scale, 
  Ruler,
  Edit3,
  Plus,
  Trash2,
  X,
  Save,
  Check,
  FileText,
  Send,
  Printer,
  Download,
  ExternalLink,
  ShieldCheck,
  Award,
  Sparkles,
  CheckCheck,
  Thermometer,
  Sun,
  Moon,
  Coffee,
  BookOpen
} from 'lucide-react';

export interface Student360Profile {
  readonly id: string;
  readonly name: string;
  readonly nickname: string;
  readonly dob: string;
  readonly age: string;
  readonly gender: string;
  readonly className: string;
  readonly status: string;
  readonly attendanceRate: string;
  readonly missingDoc?: string;
  readonly guardians: ReadonlyArray<{
    readonly role: string;
    readonly name: string;
    readonly phone: string;
    readonly email: string;
    readonly isPrimary: boolean;
    readonly address?: string;
  }>;
  readonly enrollmentHistory: ReadonlyArray<{
    readonly year: string;
    readonly className: string;
    readonly teacher: string;
    readonly status: string;
    readonly enrolledAt: string;
    readonly tuitionStatus: 'Đã thanh toán' | 'Còn công nợ' | 'Miễn giảm';
  }>;
  readonly healthRecord: {
    readonly height: string;
    readonly weight: string;
    readonly bmiStatus: string;
    readonly bloodType: string;
    readonly allergies: string;
    readonly medicalNotes: string;
    readonly vaccinations: ReadonlyArray<{
      readonly vaccine: string;
      readonly dose: string;
      readonly status: 'completed' | 'upcoming';
      readonly date: string;
    }>;
  };
}

const CANONICAL_STUDENT_360_MAP: Record<string, Student360Profile> = {
  // HS0001
  'HS0001': {
    id: 'HS0001',
    name: 'Nguyễn Minh An',
    nickname: 'Bé Bi',
    dob: '12/03/2022',
    age: '3 tuổi',
    gender: 'Bé trai',
    className: 'Lớp Mầm non 1 — Họa Mi',
    status: 'Đang học',
    attendanceRate: '96% (20/21 ngày)',
    guardians: [
      { role: 'Bố', name: 'Nguyễn Văn Hùng', phone: '0901 234 567', email: 'hung.nguyen@gmail.com', isPrimary: true, address: '123 Nguyễn Văn Cừ, Quận 5, TP.HCM' },
      { role: 'Mẹ', name: 'Trần Thị Thu Thảo', phone: '0988 654 321', email: 'thao.tran@gmail.com', isPrimary: false, address: '123 Nguyễn Văn Cừ, Quận 5, TP.HCM' },
    ],
    enrollmentHistory: [
      { year: '2026 - 2027', className: 'Lớp Mầm non 1 — Họa Mi', teacher: 'Cô Nguyễn Thị Mai & Cô Lê Thu Trang', status: 'Đang học', enrolledAt: '01/08/2026', tuitionStatus: 'Đã thanh toán' },
      { year: '2025 - 2026', className: 'Lớp Nhà Trẻ N2 — Thỏ Con', teacher: 'Cô Hoàng Bích Ngọc', status: 'Hoàn thành', enrolledAt: '01/08/2025', tuitionStatus: 'Đã thanh toán' },
    ],
    healthRecord: {
      height: '96 cm',
      weight: '14.5 kg',
      bmiStatus: 'Chuẩn phát triển WHO (BMI 15.7)',
      bloodType: 'O+',
      allergies: 'Không dị ứng nghiêm trọng, theo dõi nhẹ thời tiết khi chuyển mùa.',
      medicalNotes: 'Tiền sử sổ mũi khi trời lạnh. Ưu tiên uống nước ấm.',
      vaccinations: [
        { vaccine: 'Vắc-xin 6 trong 1 (Infanrix Hexa)', dose: 'Mũi 4 nhắc lại', status: 'completed', date: '10/05/2024' },
        { vaccine: 'Sởi - Quai bị - Rubella (MMR)', dose: 'Mũi 2', status: 'completed', date: '15/11/2024' },
        { vaccine: 'Cúm mùa', dose: 'Hàng năm', status: 'completed', date: '01/09/2026' },
      ],
    },
  },

  // HS0002 — Birthday Box
  'HS0002': {
    id: 'HS0002',
    name: 'Trần Bảo Ngọc',
    nickname: 'Bé Na',
    dob: '05/06/2021',
    age: '4 tuổi',
    gender: 'Bé gái',
    className: 'Lớp Chồi 2 — Thỏ Ngọc',
    status: 'Đang học',
    attendanceRate: '95% (19/21 ngày)',
    guardians: [
      { role: 'Mẹ', name: 'Trần Thị Mai', phone: '0902 345 678', email: 'mai.tran@gmail.com', isPrimary: true, address: '45 Võ Văn Tần, Quận 3, TP.HCM' },
      { role: 'Bố', name: 'Trần Văn Thành', phone: '0902 111 222', email: 'thanh.tran@gmail.com', isPrimary: false, address: '45 Võ Văn Tần, Quận 3, TP.HCM' },
    ],
    enrollmentHistory: [
      { year: '2026 - 2027', className: 'Lớp Chồi 2 — Thỏ Ngọc', teacher: 'Cô Trần Ngọc Anh & Cô Đặng Thùy Dung', status: 'Đang học', enrolledAt: '01/08/2026', tuitionStatus: 'Đã thanh toán' },
      { year: '2025 - 2026', className: 'Lớp Mầm 1 — Họa Mi', teacher: 'Cô Nguyễn Thị Mai', status: 'Hoàn thành', enrolledAt: '01/08/2025', tuitionStatus: 'Đã thanh toán' },
    ],
    healthRecord: {
      height: '103 cm',
      weight: '16.2 kg',
      bmiStatus: 'Chuẩn phát triển WHO (BMI 15.3)',
      bloodType: 'A+',
      allergies: 'Không ghi nhận dị ứng thực phẩm.',
      medicalNotes: 'Sức khỏe tốt, ngủ trưa ngoan.',
      vaccinations: [
        { vaccine: 'Thủy đậu (Varicella)', dose: 'Mũi 2', status: 'completed', date: '20/03/2025' },
        { vaccine: 'Viêm gan A', dose: 'Mũi 2', status: 'completed', date: '10/01/2025' },
        { vaccine: 'Cúm mùa', dose: 'Hàng năm', status: 'completed', date: '15/09/2026' },
      ],
    },
  },

  // HS0003 — Incomplete Doc Box
  'HS0003': {
    id: 'HS0003',
    name: 'Lê Gia Huy',
    nickname: 'Bé Tôm',
    dob: '20/08/2022',
    age: '3 tuổi',
    gender: 'Bé trai',
    className: 'Lớp Lá 1 — Vàng Anh',
    status: 'Đang học',
    attendanceRate: '90% (18/21 ngày)',
    missingDoc: 'Thiếu sổ tiêm chủng',
    guardians: [
      { role: 'Bố', name: 'Lê Văn Tài', phone: '0903 456 789', email: 'tai.le@gmail.com', isPrimary: true, address: '88 Lê Hồng Phong, Quận 10, TP.HCM' },
      { role: 'Mẹ', name: 'Lê Thị Hồng', phone: '0903 888 999', email: 'hong.le@gmail.com', isPrimary: false, address: '88 Lê Hồng Phong, Quận 10, TP.HCM' },
    ],
    enrollmentHistory: [
      { year: '2026 - 2027', className: 'Lớp Lá 1 — Vàng Anh', teacher: 'Cô Lê Thu Trang', status: 'Đang học', enrolledAt: '01/08/2026', tuitionStatus: 'Còn công nợ' },
    ],
    healthRecord: {
      height: '97 cm',
      weight: '13.8 kg',
      bmiStatus: 'Thể trạng nhẹ cân nhẹ (+ theo dõi tăng trưởng)',
      bloodType: 'B+',
      allergies: 'Cần bổ sung sổ theo dõi tiêm chủng đầy đủ từ trạm y tế.',
      medicalNotes: 'Phụ huynh hẹn bổ sung sổ tiêm phòng trước ngày 30/10/2026.',
      vaccinations: [
        { vaccine: 'Bạch hầu - Ho gà - Uốn ván (DPT)', dose: 'Mũi nhắc 4', status: 'completed', date: '12/10/2024' },
        { vaccine: 'Sổ tiêm chủng mầm non', dose: 'Chờ nộp bản gốc', status: 'upcoming', date: 'Hạn chót 30/10/2026' },
      ],
    },
  },

  // HS0004 — Incomplete Doc Box
  'HS0004': {
    id: 'HS0004',
    name: 'Phạm Khánh Linh',
    nickname: 'Bé Bông',
    dob: '14/11/2021',
    age: '4 tuổi',
    gender: 'Bé gái',
    className: 'Lớp Chồi 1 — Sơn Ca',
    status: 'Đang học',
    attendanceRate: '98% (21/21 ngày)',
    missingDoc: 'Thiếu giấy khám sức khỏe',
    guardians: [
      { role: 'Mẹ', name: 'Phạm Thu Hà', phone: '0904 567 890', email: 'ha.pham@gmail.com', isPrimary: true, address: '22 Hai Bà Trưng, Quận 1, TP.HCM' },
      { role: 'Bố', name: 'Phạm Văn Bình', phone: '0904 333 444', email: 'binh.pham@gmail.com', isPrimary: false, address: '22 Hai Bà Trưng, Quận 1, TP.HCM' },
    ],
    enrollmentHistory: [
      { year: '2026 - 2027', className: 'Lớp Chồi 1 — Sơn Ca', teacher: 'Cô Đỗ Thùy Linh', status: 'Đang học', enrolledAt: '01/08/2026', tuitionStatus: 'Đã thanh toán' },
    ],
    healthRecord: {
      height: '104 cm',
      weight: '16.5 kg',
      bmiStatus: 'Chuẩn phát triển WHO (BMI 15.2)',
      bloodType: 'O+',
      allergies: 'Không có dị ứng thực phẩm.',
      medicalNotes: 'Chờ nộp giấy khám sức khỏe định kỳ đầu năm học.',
      vaccinations: [
        { vaccine: 'Viêm não Nhật Bản', dose: 'Mũi 3', status: 'completed', date: '14/02/2025' },
        { vaccine: 'Cúm mùa', dose: 'Hàng năm', status: 'completed', date: '05/09/2026' },
      ],
    },
  },

  // HS0005 — Birthday Box
  'HS0005': {
    id: 'HS0005',
    name: 'Hoàng Nhật Minh',
    nickname: 'Bé Sóc',
    dob: '02/01/2023',
    age: '2 tuổi',
    gender: 'Bé trai',
    className: 'Lớp Mầm 1 — Họa Mi',
    status: 'Đang học',
    attendanceRate: '94% (19/21 ngày)',
    guardians: [
      { role: 'Bố', name: 'Hoàng Thế Anh', phone: '0905 678 901', email: 'theanh.hoang@gmail.com', isPrimary: true, address: '12 Trương Định, Quận 3, TP.HCM' },
    ],
    enrollmentHistory: [
      { year: '2026 - 2027', className: 'Lớp Mầm 1 — Họa Mi', teacher: 'Cô Nguyễn Thị Mai', status: 'Đang học', enrolledAt: '01/08/2026', tuitionStatus: 'Đã thanh toán' },
    ],
    healthRecord: {
      height: '89 cm',
      weight: '13.1 kg',
      bmiStatus: 'Chuẩn phát triển WHO (BMI 16.5)',
      bloodType: 'O+',
      allergies: 'Không có tiền sử dị ứng.',
      medicalNotes: 'Bé ăn ngủ tốt, chuẩn bị tổ chức sinh nhật tại lớp cùng các bạn.',
      vaccinations: [
        { vaccine: 'Vắc-xin 6 trong 1', dose: 'Mũi 4', status: 'completed', date: '15/06/2024' },
      ],
    },
  },

  // HS0006 — Health Alert Box
  'HS0006': {
    id: 'HS0006',
    name: 'Vũ Phương Anh',
    nickname: 'Bé Thỏ',
    dob: '18/04/2021',
    age: '4 tuổi',
    gender: 'Bé gái',
    className: 'Lớp Chồi 2 — Thỏ Ngọc',
    status: 'Lưu ý y tế',
    attendanceRate: '92% (19/21 ngày)',
    guardians: [
      { role: 'Mẹ', name: 'Vũ Thị Lan', phone: '0906 789 012', email: 'lan.vu@gmail.com', isPrimary: true, address: '67 Điện Biên Phủ, Quận Bình Thạnh, TP.HCM' },
    ],
    enrollmentHistory: [
      { year: '2026 - 2027', className: 'Lớp Chồi 2 — Thỏ Ngọc', teacher: 'Cô Trần Ngọc Anh', status: 'Đang học', enrolledAt: '01/08/2026', tuitionStatus: 'Đã thanh toán' },
    ],
    healthRecord: {
      height: '102 cm',
      weight: '15.8 kg',
      bmiStatus: 'Chuẩn phát triển WHO (BMI 15.1)',
      bloodType: 'AB+',
      allergies: 'Dị ứng hải sản nghiêm trọng (Tôm, Cua, Mực). Tuyệt đối không dùng suất ăn chung.',
      medicalNotes: 'Nhà bếp phục vụ khay ăn riêng biệt màu đỏ dán nhãn y tế lưu ý đặc biệt.',
      vaccinations: [
        { vaccine: 'Vắc-xin 6 trong 1', dose: 'Hoàn thành', status: 'completed', date: '2024' },
        { vaccine: 'Cúm mùa 2026', dose: 'Liều 1', status: 'completed', date: '08/09/2026' },
      ],
    },
  },

  // HS0007 — Incomplete Doc Box
  'HS0007': {
    id: 'HS0007',
    name: 'Đặng Quang Huy',
    nickname: 'Bé Khoai',
    dob: '25/09/2022',
    age: '3 tuổi',
    gender: 'Bé trai',
    className: 'Lớp Mầm 2 — Chim Non',
    status: 'Đang học',
    attendanceRate: '95% (20/21 ngày)',
    missingDoc: 'Thiếu bản sao khai sinh',
    guardians: [
      { role: 'Bố', name: 'Đặng Quốc Tuấn', phone: '0907 890 123', email: 'tuan.dang@gmail.com', isPrimary: true, address: '55 CMT8, Quận 10, TP.HCM' },
    ],
    enrollmentHistory: [
      { year: '2026 - 2027', className: 'Lớp Mầm 2 — Chim Non', teacher: 'Cô Vũ Minh Hằng', status: 'Đang học', enrolledAt: '01/08/2026', tuitionStatus: 'Đã thanh toán' },
    ],
    healthRecord: {
      height: '95 cm',
      weight: '14.0 kg',
      bmiStatus: 'Chuẩn phát triển WHO (BMI 15.5)',
      bloodType: 'B+',
      allergies: 'Không dị ứng.',
      medicalNotes: 'Hồ sơ tuyển sinh còn thiếu bản sao trích lục khai sinh có công chứng.',
      vaccinations: [
        { vaccine: 'Vắc-xin 6 trong 1', dose: 'Mũi 4', status: 'completed', date: '10/01/2024' },
      ],
    },
  },

  // HS0008 — Incomplete Doc Box
  'HS0008': {
    id: 'HS0008',
    name: 'Bùi Thùy Chi',
    nickname: 'Bé Miu',
    dob: '30/12/2020',
    age: '5 tuổi',
    gender: 'Bé gái',
    className: 'Lớp Lá 2 — Họa Mi',
    status: 'Đang học',
    attendanceRate: '96% (20/21 ngày)',
    missingDoc: 'Chưa nộp ảnh thẻ 3x4',
    guardians: [
      { role: 'Mẹ', name: 'Bùi Thị Hương', phone: '0908 901 234', email: 'huong.bui@gmail.com', isPrimary: true, address: '18 Pastuer, Quận 1, TP.HCM' },
    ],
    enrollmentHistory: [
      { year: '2026 - 2027', className: 'Lớp Lá 2 — Họa Mi', teacher: 'Cô Trần Thúy Nga', status: 'Đang học', enrolledAt: '01/08/2026', tuitionStatus: 'Đã thanh toán' },
    ],
    healthRecord: {
      height: '110 cm',
      weight: '18.2 kg',
      bmiStatus: 'Chuẩn phát triển WHO (BMI 15.0)',
      bloodType: 'A+',
      allergies: 'Không dị ứng thực phẩm.',
      medicalNotes: 'Cần bổ sung 4 ảnh thẻ 3x4 dán sổ khám sức khỏe và thẻ học sinh.',
      vaccinations: [
        { vaccine: 'Sởi - Quai bị - Rubella', dose: 'Mũi 2', status: 'completed', date: '2024' },
      ],
    },
  },

  // HS0009 — Birthday Box
  'HS0009': {
    id: 'HS0009',
    name: 'Ngô Tuấn Khang',
    nickname: 'Bé Ken',
    dob: '17/05/2022',
    age: '3 tuổi',
    gender: 'Bé trai',
    className: 'Lớp Chồi 1 — Sơn Ca',
    status: 'Đang học',
    attendanceRate: '95% (20/21 ngày)',
    guardians: [
      { role: 'Bố', name: 'Ngô Minh Đức', phone: '0909 012 345', email: 'duc.ngo@gmail.com', isPrimary: true, address: '77 Nguyễn Đình Chiểu, Quận 3, TP.HCM' },
    ],
    enrollmentHistory: [
      { year: '2026 - 2027', className: 'Lớp Chồi 1 — Sơn Ca', teacher: 'Cô Đỗ Thùy Linh', status: 'Đang học', enrolledAt: '01/08/2026', tuitionStatus: 'Đã thanh toán' },
    ],
    healthRecord: {
      height: '98 cm',
      weight: '15.0 kg',
      bmiStatus: 'Chuẩn phát triển WHO (BMI 15.6)',
      bloodType: 'O+',
      allergies: 'Không dị ứng.',
      medicalNotes: 'Thể trạng tốt, hoạt bát.',
      vaccinations: [
        { vaccine: 'Phế cầu khuẩn', dose: 'Mũi 4', status: 'completed', date: '2024' },
      ],
    },
  },

  // HS0010 — Incomplete Doc & Birthday Box
  'HS0010': {
    id: 'HS0010',
    name: 'Đỗ Hải Yến',
    nickname: 'Bé Cún',
    dob: '09/10/2021',
    age: '4 tuổi',
    gender: 'Bé gái',
    className: 'Lớp Chồi 2 — Thỏ Ngọc',
    status: 'Đang học',
    attendanceRate: '93% (19/21 ngày)',
    missingDoc: 'Chưa cập nhật thẻ BHYT',
    guardians: [
      { role: 'Bố', name: 'Đỗ Hải Nam', phone: '0910 123 456', email: 'nam.do@gmail.com', isPrimary: true, address: '99 Nam Kỳ Khởi Nghĩa, Quận 1, TP.HCM' },
    ],
    enrollmentHistory: [
      { year: '2026 - 2027', className: 'Lớp Chồi 2 — Thỏ Ngọc', teacher: 'Cô Trần Ngọc Anh', status: 'Đang học', enrolledAt: '01/08/2026', tuitionStatus: 'Đã thanh toán' },
    ],
    healthRecord: {
      height: '101 cm',
      weight: '15.5 kg',
      bmiStatus: 'Chuẩn phát triển WHO (BMI 15.2)',
      bloodType: 'B+',
      allergies: 'Không dị ứng.',
      medicalNotes: 'Cần cập nhật mã số thẻ BHYT học sinh phục vụ y tế học đường.',
      vaccinations: [
        { vaccine: 'Thủy đậu', dose: 'Mũi 2', status: 'completed', date: '2025' },
      ],
    },
  },

  // HS0011 — Health Alert Box
  'HS0011': {
    id: 'HS0011',
    name: 'Trần Đức Minh',
    nickname: 'Bé Minh',
    dob: '10/02/2021',
    age: '4 tuổi',
    gender: 'Bé trai',
    className: 'Lớp Lá 1 — Vàng Anh',
    status: 'Lưu ý y tế',
    attendanceRate: '88% (17/21 ngày)',
    guardians: [
      { role: 'Bố', name: 'Trần Quốc Dũng', phone: '0911 234 567', email: 'dung.tran@gmail.com', isPrimary: true, address: '34 Lê Duẩn, Quận 1, TP.HCM' },
      { role: 'Mẹ', name: 'Lê Thanh Mai', phone: '0911 888 777', email: 'mai.le@gmail.com', isPrimary: false, address: '34 Lê Duẩn, Quận 1, TP.HCM' },
    ],
    enrollmentHistory: [
      { year: '2026 - 2027', className: 'Lớp Lá 1 — Vàng Anh', teacher: 'Cô Lê Thu Trang', status: 'Đang học', enrolledAt: '01/08/2026', tuitionStatus: 'Đã thanh toán' },
    ],
    healthRecord: {
      height: '105 cm',
      weight: '16.0 kg',
      bmiStatus: 'Chuẩn phát triển WHO (BMI 14.5)',
      bloodType: 'O+',
      allergies: 'Hen suyễn phế quản khi trời lạnh hoặc vận động gắng sức.',
      medicalNotes: 'Phụ huynh gửi kèm bình xịt cắt cơn Ventolin tại phòng y tế trường. Tránh để trẻ chạy nhảy quá mức khi trời lạnh.',
      vaccinations: [
        { vaccine: 'Vắc-xin Cúm mùa 2026', dose: 'Mũi 1', status: 'completed', date: '01/09/2026' },
        { vaccine: 'Phế cầu khuẩn Prevenar 13', dose: 'Đầy đủ', status: 'completed', date: '2024' },
      ],
    },
  },

  // HS0012 — Health Alert Box
  'HS0012': {
    id: 'HS0012',
    name: 'Lê Thảo My',
    nickname: 'Bé My',
    dob: '15/07/2022',
    age: '3 tuổi',
    gender: 'Bé gái',
    className: 'Lớp Mầm 1 — Họa Mi',
    status: 'Lưu ý y tế',
    attendanceRate: '91% (18/21 ngày)',
    guardians: [
      { role: 'Mẹ', name: 'Lê Thu Thủy', phone: '0912 345 678', email: 'thuy.le@gmail.com', isPrimary: true, address: '14 Hoàng Diệu, Quận 4, TP.HCM' },
    ],
    enrollmentHistory: [
      { year: '2026 - 2027', className: 'Lớp Mầm 1 — Họa Mi', teacher: 'Cô Nguyễn Thị Mai', status: 'Đang học', enrolledAt: '01/08/2026', tuitionStatus: 'Đã thanh toán' },
    ],
    healthRecord: {
      height: '94 cm',
      weight: '13.9 kg',
      bmiStatus: 'Chuẩn phát triển WHO (BMI 15.7)',
      bloodType: 'A+',
      allergies: 'Dị ứng phấn hoa và mạt bụi nhà. Thường hắt hơi, ngứa mắt khi tiếp xúc.',
      medicalNotes: 'Khu vực ngủ trưa cần được hút bụi sạch sẽ và không cắm hoa tươi trong phòng học.',
      vaccinations: [
        { vaccine: 'Vắc-xin 6 trong 1', dose: 'Mũi 4', status: 'completed', date: '2024' },
        { vaccine: 'Sởi - Quai bị - Rubella', dose: 'Mũi 2', status: 'completed', date: '2025' },
      ],
    },
  },

  // HS0013 — Health Alert Box
  'HS0013': {
    id: 'HS0013',
    name: 'Nguyễn Gia Bảo',
    nickname: 'Bé Bảo',
    dob: '28/03/2021',
    age: '4 tuổi',
    gender: 'Bé trai',
    className: 'Lớp Chồi 1 — Sơn Ca',
    status: 'Lưu ý y tế',
    attendanceRate: '93% (19/21 ngày)',
    guardians: [
      { role: 'Mẹ', name: 'Nguyễn Bích Trâm', phone: '0913 456 789', email: 'tram.nguyen@gmail.com', isPrimary: true, address: '82 Nguyễn Thị Minh Khai, Quận 3, TP.HCM' },
    ],
    enrollmentHistory: [
      { year: '2026 - 2027', className: 'Lớp Chồi 1 — Sơn Ca', teacher: 'Cô Đỗ Thùy Linh', status: 'Đang học', enrolledAt: '01/08/2026', tuitionStatus: 'Đã thanh toán' },
    ],
    healthRecord: {
      height: '103 cm',
      weight: '16.8 kg',
      bmiStatus: 'Chuẩn phát triển WHO (BMI 15.8)',
      bloodType: 'B+',
      allergies: 'Không dị ứng thực phẩm.',
      medicalNotes: 'Tiền sử sốt cao co giật. Khi trẻ sốt từ 38.2°C cần lau mát ngay và báo gia đình lập tức.',
      vaccinations: [
        { vaccine: 'Viêm não Nhật Bản', dose: 'Mũi 3', status: 'completed', date: '2025' },
        { vaccine: 'Thủy đậu', dose: 'Mũi 2', status: 'completed', date: '2025' },
      ],
    },
  },

  // HS0014 — Health Alert Box
  'HS0014': {
    id: 'HS0014',
    name: 'Phạm Minh Châu',
    nickname: 'Bé Châu',
    dob: '19/11/2020',
    age: '5 tuổi',
    gender: 'Bé gái',
    className: 'Lớp Lá 2 — Họa Mi',
    status: 'Lưu ý y tế',
    attendanceRate: '96% (20/21 ngày)',
    guardians: [
      { role: 'Mẹ', name: 'Hoàng Lan Hương', phone: '0914 567 890', email: 'huong.hoang@gmail.com', isPrimary: true, address: '115 Phan Đăng Lưu, Quận Phú Nhuận, TP.HCM' },
    ],
    enrollmentHistory: [
      { year: '2026 - 2027', className: 'Lớp Lá 2 — Họa Mi', teacher: 'Cô Trần Thúy Nga', status: 'Đang học', enrolledAt: '01/08/2026', tuitionStatus: 'Đã thanh toán' },
    ],
    healthRecord: {
      height: '109 cm',
      weight: '17.5 kg',
      bmiStatus: 'Chuẩn phát triển WHO (BMI 14.7)',
      bloodType: 'O+',
      allergies: 'Dị ứng sữa bò (Bất dung nạp đạm sữa bò).',
      medicalNotes: 'Không uống sữa bò và các chế phẩm bơ sữa. Gia đình gửi sữa hạt riêng hàng ngày.',
      vaccinations: [
        { vaccine: 'Bạch hầu - Ho gà - Uốn ván', dose: 'Nhắc lại', status: 'completed', date: '2025' },
        { vaccine: 'Cúm mùa', dose: 'Hàng năm', status: 'completed', date: '09/2026' },
      ],
    },
  },

  // PA001 — Pending Admissions Box
  'PA001': {
    id: 'PA001',
    name: 'Nguyễn Hà Phương',
    nickname: 'Bé Phương',
    dob: '10/05/2023',
    age: '2 tuổi',
    gender: 'Bé gái',
    className: 'Lớp Mầm 1 — Họa Mi (Dự kiến)',
    status: 'Chờ nhập học',
    attendanceRate: 'Chưa bắt đầu',
    guardians: [
      { role: 'Mẹ', name: 'Nguyễn Thị Thu', phone: '0921 111 222', email: 'thu.nguyen@gmail.com', isPrimary: true, address: '204 Lê Quang Định, Quận Bình Thạnh, TP.HCM' },
    ],
    enrollmentHistory: [
      { year: '2026 - 2027', className: 'Lớp Mầm 1 — Họa Mi', teacher: 'Cô Nguyễn Thị Mai', status: 'Chờ nhập học', enrolledAt: 'Nộp hồ sơ 10/04/2026', tuitionStatus: 'Đã thanh toán' },
    ],
    healthRecord: {
      height: '87 cm',
      weight: '12.5 kg',
      bmiStatus: 'Chuẩn phát triển WHO (BMI 16.5)',
      bloodType: 'A+',
      allergies: 'Không ghi nhận dị ứng.',
      medicalNotes: 'Hồ sơ đầy đủ, chuẩn bị làm thủ tục nhập học chính thức.',
      vaccinations: [
        { vaccine: 'Vắc-xin 6 trong 1', dose: 'Mũi 3', status: 'completed', date: '2024' },
      ],
    },
  },

  // PA002 — Pending Admissions Box
  'PA002': {
    id: 'PA002',
    name: 'Lê Minh Quân',
    nickname: 'Bé Quân',
    dob: '12/08/2022',
    age: '3 tuổi',
    gender: 'Bé trai',
    className: 'Lớp Chồi 1 — Sơn Ca (Dự kiến)',
    status: 'Chờ bổ sung hồ sơ',
    attendanceRate: 'Chưa bắt đầu',
    missingDoc: 'Bổ sung giấy khám sức khỏe và sổ tiêm chủng',
    guardians: [
      { role: 'Bố', name: 'Lê Văn Cường', phone: '0922 333 444', email: 'cuong.le@gmail.com', isPrimary: true, address: '50 Đinh Tiên Hoàng, Quận 1, TP.HCM' },
    ],
    enrollmentHistory: [
      { year: '2026 - 2027', className: 'Lớp Chồi 1 — Sơn Ca', teacher: 'Cô Đỗ Thùy Linh', status: 'Chờ bổ sung hồ sơ', enrolledAt: 'Nộp hồ sơ 12/04/2026', tuitionStatus: 'Còn công nợ' },
    ],
    healthRecord: {
      height: '96 cm',
      weight: '14.2 kg',
      bmiStatus: 'Chuẩn phát triển WHO (BMI 15.4)',
      bloodType: 'O+',
      allergies: 'Chờ cập nhật phiếu điều tra dị ứng.',
      medicalNotes: 'Phụ huynh đã hẹn nộp bổ sung hồ sơ y tế vào tuần tới.',
      vaccinations: [
        { vaccine: 'Sổ tiêm chủng', dose: 'Chờ cập nhật', status: 'upcoming', date: 'Hạn chót 25/04/2026' },
      ],
    },
  },

  // PA003 — Pending Admissions Box
  'PA003': {
    id: 'PA003',
    name: 'Phạm An Nhiên',
    nickname: 'Bé Nhiên',
    dob: '03/03/2023',
    age: '2 tuổi',
    gender: 'Bé gái',
    className: 'Lớp Mầm 2 — Chim Non (Dự kiến)',
    status: 'Chờ nhập học',
    attendanceRate: 'Chưa bắt đầu',
    guardians: [
      { role: 'Mẹ', name: 'Phạm Thanh Trúc', phone: '0923 555 666', email: 'truc.pham@gmail.com', isPrimary: true, address: '18 Lý Thường Kiệt, Quận 10, TP.HCM' },
    ],
    enrollmentHistory: [
      { year: '2026 - 2027', className: 'Lớp Mầm 2 — Chim Non', teacher: 'Cô Vũ Minh Hằng', status: 'Chờ nhập học', enrolledAt: 'Nộp hồ sơ 15/04/2026', tuitionStatus: 'Đã thanh toán' },
    ],
    healthRecord: {
      height: '88 cm',
      weight: '12.8 kg',
      bmiStatus: 'Chuẩn phát triển WHO (BMI 16.5)',
      bloodType: 'B+',
      allergies: 'Không dị ứng.',
      medicalNotes: 'Hồ sơ đầy đủ, sức khỏe bình thường.',
      vaccinations: [
        { vaccine: 'Vắc-xin 6 trong 1', dose: 'Đầy đủ', status: 'completed', date: '2024' },
      ],
    },
  },

  // PA004 — Pending Admissions Box
  'PA004': {
    id: 'PA004',
    name: 'Trần Gia Khánh',
    nickname: 'Bé Khánh',
    dob: '18/06/2021',
    age: '4 tuổi',
    gender: 'Bé trai',
    className: 'Lớp Lá 1 — Vàng Anh (Dự kiến)',
    status: 'Chờ xác nhận',
    attendanceRate: 'Chưa bắt đầu',
    guardians: [
      { role: 'Bố', name: 'Trần Gia Bảo', phone: '0924 777 888', email: 'bao.tran@gmail.com', isPrimary: true, address: '62 Trần Hưng Đạo, Quận 5, TP.HCM' },
    ],
    enrollmentHistory: [
      { year: '2026 - 2027', className: 'Lớp Lá 1 — Vàng Anh', teacher: 'Cô Lê Thu Trang', status: 'Chờ xác nhận', enrolledAt: 'Nộp hồ sơ 16/04/2026', tuitionStatus: 'Còn công nợ' },
    ],
    healthRecord: {
      height: '102 cm',
      weight: '15.9 kg',
      bmiStatus: 'Chuẩn phát triển WHO (BMI 15.3)',
      bloodType: 'A+',
      allergies: 'Không có ghi nhận dị ứng.',
      medicalNotes: 'Đang chờ bộ phận tuyển sinh xác nhận chỉ tiêu phân lớp.',
      vaccinations: [
        { vaccine: 'Cúm mùa', dose: 'Hàng năm', status: 'completed', date: '2025' },
      ],
    },
  },
};

// Also support legacy aliases STU-001 ... STU-006
CANONICAL_STUDENT_360_MAP['STU-001'] = CANONICAL_STUDENT_360_MAP['HS0001'];
CANONICAL_STUDENT_360_MAP['STU-002'] = CANONICAL_STUDENT_360_MAP['HS0002'];
CANONICAL_STUDENT_360_MAP['STU-003'] = CANONICAL_STUDENT_360_MAP['HS0003'];
CANONICAL_STUDENT_360_MAP['STU-004'] = CANONICAL_STUDENT_360_MAP['HS0004'];
CANONICAL_STUDENT_360_MAP['STU-006'] = CANONICAL_STUDENT_360_MAP['HS0006'];

function resolveStudent360(id: string): Student360Profile {
  if (CANONICAL_STUDENT_360_MAP[id]) {
    return CANONICAL_STUDENT_360_MAP[id];
  }

  // Graceful fallback for dynamic or unknown IDs
  return {
    id,
    name: `Học sinh ${id}`,
    nickname: 'Bé ngoan',
    dob: '12/03/2022',
    age: '3 tuổi',
    gender: 'Bé trai',
    className: 'Lớp Mầm non 1 — Họa Mi',
    status: 'Đang học',
    attendanceRate: '95% (20/21 ngày)',
    guardians: [
      { role: 'Phụ huynh', name: 'Người giám hộ chính', phone: '0901 000 000', email: 'parent@bellapreschool.edu.vn', isPrimary: true, address: 'TP. Hồ Chí Minh' },
    ],
    enrollmentHistory: [
      { year: '2026 - 2027', className: 'Lớp Mầm non 1 — Họa Mi', teacher: 'Cô Nguyễn Thị Mai', status: 'Đang học', enrolledAt: '01/08/2026', tuitionStatus: 'Đã thanh toán' },
    ],
    healthRecord: {
      height: '98 cm',
      weight: '14.8 kg',
      bmiStatus: 'Chuẩn phát triển WHO (BMI 15.4)',
      bloodType: 'O+',
      allergies: 'Không ghi nhận dị ứng đặc biệt.',
      medicalNotes: 'Tình trạng sức khỏe ổn định.',
      vaccinations: [
        { vaccine: 'Vắc-xin cơ bản mầm non', dose: 'Đầy đủ', status: 'completed', date: '2025' },
        { vaccine: 'Cúm mùa', dose: 'Hàng năm', status: 'completed', date: '09/2026' },
      ],
    },
  };
}

export default function Student360Page() {
  const params = useParams();
  const rawId = (params?.id as string) || 'HS0001';
  const studentId = decodeURIComponent(rawId);

  const [stu, setStu] = useState<Student360Profile>(() => resolveStudent360(studentId));
  const [activeTab, setActiveTab] = useState<
    'overview' | 'communication' | 'attendance' | 'grades' | 'finance' | 'guardians' | 'enrollments' | 'health'
  >('overview');
  
  // Custom chat messages in Sổ Liên Lạc
  const [extraChatMessages, setExtraChatMessages] = useState<Array<{ sender: 'parent' | 'teacher'; senderName: string; text: string; time: string }>>([]);
  const [chatInputText, setChatInputText] = useState('');

  const handleSendChatMessage = () => {
    if (!chatInputText.trim()) return;
    setExtraChatMessages(prev => [
      ...prev,
      {
        sender: 'teacher',
        senderName: stu.enrollmentHistory[0]?.teacher?.split('&')[0]?.trim() || 'Giáo viên',
        text: chatInputText.trim(),
        time: 'Vừa xong'
      }
    ]);
    setChatInputText('');
    setToastMessage(`Đã gửi lời nhắn đến phụ huynh bé thành công!`);
  };

  // Modal & Edit states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editModalTab, setEditModalTab] = useState<'general' | 'guardians' | 'health' | 'vaccines'>('general');
  const [editForm, setEditForm] = useState<Student360Profile>(() => resolveStudent360(studentId));
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Restore saved edits from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`bella_student_360_${studentId}`);
      if (saved) {
        const parsed = JSON.parse(saved) as Student360Profile;
        if (parsed && parsed.id === studentId) {
          setStu(parsed);
          setEditForm(parsed);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [studentId]);

  // Auto-hide toast
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const handleOpenEdit = (tab: 'general' | 'guardians' | 'health' | 'vaccines' = 'general') => {
    setEditForm(stu);
    setEditModalTab(tab);
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = () => {
    setStu(editForm);
    try {
      localStorage.setItem(`bella_student_360_${studentId}`, JSON.stringify(editForm));
    } catch {
      // Ignore storage errors
    }
    setIsEditModalOpen(false);
    setToastMessage(`Đã cập nhật và lưu hồ sơ bé ${editForm.name} thành công!`);
  };

  const initial = stu.name.trim().split(/\s+/).pop()?.[0]?.toUpperCase() ?? stu.name[0]?.toUpperCase() ?? '?';
  const isBoy = stu.gender.toLowerCase().includes('trai') || stu.gender.toLowerCase() === 'nam';

  return (
    <div className="preschool-ui w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-24">
      {/* ── Toast Notification ── */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-60 bg-[#064E3B] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Breadcrumb / Header Top ── */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
        <Link href="/dashboard/education/enrollments" className="hover:text-emerald-700 transition-colors">
          Quản Lý Trẻ
        </Link>
        <span>/</span>
        <span className="text-slate-800 dark:text-slate-200 font-bold">Hồ sơ 360° ({stu.id})</span>
      </div>

      {/* ── Student 360 Header Banner ── */}
      <div className="w-full rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-5">
          <div className="flex items-center gap-4">
            <Link 
              href="/dashboard/education/enrollments" 
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors shrink-0"
              title="Quay lại Quản lý trẻ"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-3.5">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shrink-0 shadow-sm border ${
                isBoy
                  ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border-sky-200'
                  : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-200'
              }`}>
                {initial}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                    {stu.name}
                  </h1>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    &quot;{stu.nickname}&quot;
                  </span>
                  <span className={`text-[11px] font-extrabold px-3 py-0.5 rounded-full border ${
                    stu.status === 'Lưu ý y tế'
                      ? 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-300'
                      : stu.status.includes('Chờ')
                      ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-300'
                      : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200/60'
                  }`}>
                    {stu.status}
                  </span>
                  {stu.missingDoc && (
                    <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200">
                      ⚠️ {stu.missingDoc}
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-1">
                  Mã Bé: <strong className="text-slate-800 dark:text-slate-200">{stu.id}</strong> • {stu.gender} • {stu.age} ({stu.dob}) • {stu.className}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Vertical Hub Buttons + Edit Profile Action */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            <button
              type="button"
              onClick={() => handleOpenEdit('general')}
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 text-xs font-extrabold shadow-md shadow-emerald-700/20 transition-all active:scale-95 cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              <span>Chỉnh Sửa Hồ Sơ</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('communication')}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                activeTab === 'communication'
                  ? 'bg-[#064E3B] text-white shadow-md shadow-emerald-950/20 ring-2 ring-emerald-400/50'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200'
              }`}
            >
              <MessageSquare className={`w-4 h-4 ${activeTab === 'communication' ? 'text-white' : 'text-emerald-600'}`} />
              <span>Sổ Liên Lạc</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('attendance')}
              className={`inline-flex items-center justify-center gap-1.5 rounded-2xl px-3.5 py-2.5 text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                activeTab === 'attendance'
                  ? 'bg-[#064E3B] text-white shadow-md shadow-emerald-950/20 ring-2 ring-emerald-400/50'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200'
              }`}
            >
              <CalendarCheck className={`w-4 h-4 ${activeTab === 'attendance' ? 'text-white' : 'text-indigo-500'}`} />
              <span>Điểm Danh</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('grades')}
              className={`inline-flex items-center justify-center gap-1.5 rounded-2xl px-3.5 py-2.5 text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                activeTab === 'grades'
                  ? 'bg-[#064E3B] text-white shadow-md shadow-emerald-950/20 ring-2 ring-emerald-400/50'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200'
              }`}
            >
              <GraduationCap className={`w-4 h-4 ${activeTab === 'grades' ? 'text-white' : 'text-amber-500'}`} />
              <span>Đánh Giá PT</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('finance')}
              className={`inline-flex items-center justify-center gap-1.5 rounded-2xl px-3.5 py-2.5 text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                activeTab === 'finance'
                  ? 'bg-[#064E3B] text-white shadow-md shadow-emerald-950/20 ring-2 ring-emerald-400/50'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200'
              }`}
            >
              <CreditCard className={`w-4 h-4 ${activeTab === 'finance' ? 'text-white' : 'text-rose-500'}`} />
              <span>Học Phí</span>
            </button>
          </div>
        </div>

        {/* Student 360 Tab Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-[#064E3B] text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Tổng Quan 360°
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('communication')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'communication'
                ? 'bg-[#064E3B] text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Sổ Liên Lạc & Nhật Ký
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('attendance')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'attendance'
                ? 'bg-[#064E3B] text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Điểm Danh & Đón Trả
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('grades')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'grades'
                ? 'bg-[#064E3B] text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Đánh Giá Phát Triển
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('finance')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'finance'
                ? 'bg-[#064E3B] text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Học Phí & Khoản Thu
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('guardians')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'guardians'
                ? 'bg-[#064E3B] text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Cá Nhân & Người Giám Hộ ({stu.guardians.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('health')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'health'
                ? 'bg-[#064E3B] text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Sức Khỏe & Dinh Dưỡng
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('enrollments')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'enrollments'
                ? 'bg-[#064E3B] text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Lịch Sử Ghi Danh ({stu.enrollmentHistory.length})
          </button>
        </div>
      </div>

      {/* ── Tab Content: Overview 360 ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Baby className="w-5 h-5 text-emerald-600" />
                  <span>Tổng Quan Thông Tin Trẻ & Lớp Học</span>
                </h3>
                <button
                  type="button"
                  onClick={() => handleOpenEdit('general')}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Sửa thông tin</span>
                </button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 space-y-1 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 font-medium block">Lớp đang theo học:</span>
                  <p className="font-extrabold text-slate-900 dark:text-white text-sm">{stu.className}</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 space-y-1 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 font-medium block">Tỷ lệ chuyên cần tháng này:</span>
                  <p className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">{stu.attendanceRate}</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 space-y-1 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 font-medium block">Chỉ số thể trạng:</span>
                  <p className="font-extrabold text-slate-800 dark:text-slate-200 text-sm">
                    {stu.healthRecord.height} • {stu.healthRecord.weight}
                  </p>
                  <span className="text-[11px] text-emerald-600 font-semibold">{stu.healthRecord.bmiStatus}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 space-y-1 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 font-medium block">Học phí kỳ hiện tại:</span>
                  <p className="font-extrabold text-emerald-700 dark:text-emerald-400 text-sm">
                    {stu.enrollmentHistory[0]?.tuitionStatus ?? 'Đã thanh toán'}
                  </p>
                  <span className="text-[11px] text-slate-400 font-medium">Kỳ học: {stu.enrollmentHistory[0]?.year}</span>
                </div>
              </div>

              {/* Health Alert Exception Box */}
              <div className={`p-4 rounded-2xl border space-y-2 text-xs ${
                stu.status === 'Lưu ý y tế'
                  ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200'
                  : 'bg-amber-50 dark:bg-amber-950/60 border-amber-200/80'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`font-extrabold flex items-center gap-1.5 text-xs ${
                    stu.status === 'Lưu ý y tế'
                      ? 'text-rose-900 dark:text-rose-200'
                      : 'text-amber-900 dark:text-amber-200'
                  }`}>
                    <AlertTriangle className={`w-4 h-4 ${stu.status === 'Lưu ý y tế' ? 'text-rose-600' : 'text-amber-500'}`} />
                    <span>Dặn dò y tế & Chế độ dinh dưỡng đặc biệt:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit('health')}
                    className="text-[11px] font-bold text-amber-800 dark:text-amber-300 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Cập nhật</span>
                  </button>
                </div>
                <p className={`leading-relaxed font-semibold ${
                  stu.status === 'Lưu ý y tế'
                    ? 'text-rose-800 dark:text-rose-300'
                    : 'text-amber-800 dark:text-amber-300'
                }`}>
                  {stu.healthRecord.allergies}
                </p>
                {stu.healthRecord.medicalNotes && (
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200/60">
                    Ghi chú chăm sóc: {stu.healthRecord.medicalNotes}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-600" />
                  <span>Người Giám Hộ Chính</span>
                </h3>
                <button
                  type="button"
                  onClick={() => handleOpenEdit('guardians')}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm / Sửa</span>
                </button>
              </div>

              {stu.guardians.map((g, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 space-y-1 text-xs border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900 dark:text-white">{g.name} ({g.role})</span>
                    {g.isPrimary && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Liên hệ chính</span>}
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1.5 pt-1">
                    <Phone className="w-3.5 h-3.5 text-emerald-500" />
                    <a href={`tel:${g.phone}`} className="hover:underline font-bold text-emerald-600">{g.phone}</a>
                  </p>
                  {g.address && (
                    <p className="text-slate-400 text-[11px] flex items-center gap-1 pt-0.5">
                      <MapPin className="w-3 h-3" />
                      <span>{g.address}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab Content: Guardians ── */}
      {activeTab === 'guardians' && (
        <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-5 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                <span>Danh Sách Người Giám Hộ & Thông Tin Liên Hệ Khẩn Cấp</span>
              </h3>
              <p className="text-xs font-semibold text-slate-400 mt-1">
                Đã ủy quyền đưa đón an toàn cho trường mầm non
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleOpenEdit('guardians')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm người giám hộ</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stu.guardians.map((g, idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 space-y-2.5 border border-slate-100 dark:border-slate-800 relative group">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{g.name} — {g.role}</h4>
                  {g.isPrimary ? (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                      Người giám hộ chính
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      Người đưa đón ủy quyền
                    </span>
                  )}
                </div>
                <p className="text-slate-600 dark:text-slate-300 flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>SĐT: <strong className="text-emerald-600">{g.phone}</strong></span>
                </p>
                <p className="text-slate-600 dark:text-slate-300 flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Email: {g.email || 'Chưa cập nhật'}</span>
                </p>
                <p className="text-slate-500 flex items-center gap-2">
                  <Home className="w-3.5 h-3.5 text-slate-400" />
                  <span>Địa chỉ: {g.address || 'Chưa cập nhật'}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab Content: Enrollments History ── */}
      {activeTab === 'enrollments' && (
        <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-5 text-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-emerald-600" />
              <span>Lịch Sử Ghi Danh & Quá Trình Học Tập</span>
            </h3>
            <span className="text-xs font-semibold text-slate-400">
              Tổng số khóa ghi danh: {stu.enrollmentHistory.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold">
                  <th className="py-3 px-3">Niên khóa</th>
                  <th className="py-3 px-3">Lớp học</th>
                  <th className="py-3 px-3">Giáo viên phụ trách</th>
                  <th className="py-3 px-3">Ngày nhập học</th>
                  <th className="py-3 px-3">Trạng thái học vụ</th>
                  <th className="py-3 px-3 text-right">Học phí</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {stu.enrollmentHistory.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3.5 px-3 font-bold text-slate-900 dark:text-white">{item.year}</td>
                    <td className="py-3.5 px-3 font-bold text-emerald-700 dark:text-emerald-400">{item.className}</td>
                    <td className="py-3.5 px-3 text-slate-600 dark:text-slate-300">{item.teacher}</td>
                    <td className="py-3.5 px-3 text-slate-500">{item.enrolledAt}</td>
                    <td className="py-3.5 px-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        item.status === 'Đang học'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        item.tuitionStatus === 'Đã thanh toán'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {item.tuitionStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab Content: Health & Nutrition ── */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Physical Indicators */}
            <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Heart className="w-5 h-5 text-rose-500" />
                  <span>Chỉ Số Thể Trạng & Sinh Hiệu</span>
                </h3>
                <button
                  type="button"
                  onClick={() => handleOpenEdit('health')}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Cập nhật</span>
                </button>
              </div>
              
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 flex items-center justify-between border border-slate-100 dark:border-slate-800">
                  <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-indigo-500" />
                    <span>Chiều cao hiện tại</span>
                  </span>
                  <span className="font-black text-sm text-slate-900 dark:text-white">{stu.healthRecord.height}</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 flex items-center justify-between border border-slate-100 dark:border-slate-800">
                  <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-amber-500" />
                    <span>Cân nặng hiện tại</span>
                  </span>
                  <span className="font-black text-sm text-slate-900 dark:text-white">{stu.healthRecord.weight}</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 flex items-center justify-between border border-slate-100 dark:border-slate-800">
                  <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-rose-500" />
                    <span>Nhóm máu</span>
                  </span>
                  <span className="font-black text-sm text-rose-600">{stu.healthRecord.bloodType}</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 space-y-1">
                  <span className="font-bold text-emerald-800 dark:text-emerald-200">Đánh giá thể trạng:</span>
                  <p className="text-emerald-700 dark:text-emerald-300 font-semibold">{stu.healthRecord.bmiStatus}</p>
                </div>
              </div>
            </div>

            {/* Allergies & Dietary Guidance */}
            <div className="lg:col-span-2 rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-5 text-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Utensils className="w-5 h-5 text-amber-500" />
                  <span>Chế Độ Dinh Dưỡng & Dị Ứng</span>
                </h3>
                <button
                  type="button"
                  onClick={() => handleOpenEdit('health')}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Chỉnh sửa</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 space-y-2">
                <span className="font-extrabold text-amber-900 dark:text-amber-200 flex items-center gap-1.5 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Dị ứng & thức ăn cần kiêng:</span>
                </span>
                <p className="text-amber-800 dark:text-amber-300 leading-relaxed font-semibold">
                  {stu.healthRecord.allergies}
                </p>
                {stu.healthRecord.medicalNotes && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    {stu.healthRecord.medicalNotes}
                  </p>
                )}
              </div>

              {/* Vaccination Ledger */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2 text-xs">
                    <Syringe className="w-4 h-4 text-emerald-600" />
                    <span>Lịch Sử & Tiến Độ Tiêm Chủng Mầm Non</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit('vaccines')}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm mũi tiêm</span>
                  </button>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden">
                  {stu.healthRecord.vaccinations.map((vac, idx) => (
                    <div key={idx} className="p-3.5 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">{vac.vaccine}</span>
                        <span className="text-slate-400 text-[11px]">{vac.dose} • {vac.date}</span>
                      </div>
                      <div>
                        {vac.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Đã tiêm
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Sắp tới
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab Content: SỔ LIÊN LẠC & NHẬT KÝ CÁ NHÂN ── */}
      {activeTab === 'communication' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-black">
                <MessageSquare className="w-6 h-6 text-emerald-700 dark:text-emerald-300" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Sổ Liên Lạc Điện Tử — {stu.name}</span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    &quot;{stu.nickname}&quot;
                  </span>
                </h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  Giáo viên: <strong>{stu.enrollmentHistory[0]?.teacher || 'Cô giáo chủ nhiệm'}</strong> • Phụ huynh: <strong>{stu.guardians[0]?.name || 'Chưa cập nhật'} ({stu.guardians[0]?.role})</strong>
                </p>
              </div>
            </div>

            <Link
              href="/dashboard/education/communication"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all w-fit"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              <span>Hòm thư chung trường</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Nhật ký sinh hoạt trong ngày */}
            <div className="lg:col-span-5 rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/80 pb-3">
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span>Nhật Ký Sinh Hoạt Trong Ngày</span>
                </h4>
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                  Hôm nay
                </span>
              </div>

              <div className="space-y-3.5 pt-1">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Thermometer className="w-3.5 h-3.5 text-indigo-500" />
                      <span>07:35 — Đón bé & Thân nhiệt</span>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">36.6°C</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                    Bé vui vẻ chào cô và ba mẹ vào lớp. Tinh thần phấn chấn, hoạt bát.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                      <span>08:30 — Học tập & Tạo hình</span>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Tích cực</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                    Tham gia tiết học nặn hoa quả và nhận biết màu sắc. Bé nặn củ cà rốt rất khéo léo.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                      <Utensils className="w-3.5 h-3.5 text-amber-600" />
                      <span>10:45 — Bữa ăn trưa dinh dưỡng</span>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      {stu.status === 'Lưu ý y tế' ? 'Khay riêng' : 'Hết suất'}
                    </span>
                  </div>
                  <p className="text-amber-900 dark:text-amber-200 font-semibold leading-relaxed">
                    {stu.healthRecord.allergies ? (
                      <span>Khay ăn dán nhãn riêng: {stu.healthRecord.allergies}. Bé ăn ngon miệng và hết 100% khẩu phần.</span>
                    ) : (
                      <span>Bé ăn hết suất cơm mềm thịt băm rau củ, uống đủ nước canh rau ngọt lành.</span>
                    )}
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Moon className="w-3.5 h-3.5 text-purple-500" />
                      <span>11:30 - 14:00 — Ngủ trưa bán trú</span>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">2.5 giờ</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                    Ngủ trọn vẹn phòng máy lạnh 26°C, không quấy khóc, ngủ sâu giấc và thức dậy tỉnh táo.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Coffee className="w-3.5 h-3.5 text-emerald-500" />
                      <span>14:30 — Bữa phụ xế chiều</span>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">180ml sữa</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                    Uống hết hộp sữa chua hoa quả và ăn bánh ngũ cốc mầm non.
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Trò chuyện 2 chiều Phụ Huynh - Giáo Viên */}
            <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm flex flex-col justify-between space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/80 pb-3">
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    <span>Trao Đổi Trực Tiếp Với Phụ Huynh</span>
                  </h4>
                  <span className="text-slate-400 font-semibold text-[11px]">
                    Kênh riêng tư 2 chiều
                  </span>
                </div>

                <div className="space-y-3.5 py-4 max-h-[380px] overflow-y-auto pr-1">
                  {/* Tin nhắn mẫu 1 (Phụ huynh) */}
                  <div className="flex flex-col items-start space-y-1 max-w-[85%]">
                    <span className="text-[10px] font-bold text-slate-400">
                      {stu.guardians[0]?.name || 'Phụ huynh'} • 07:30
                    </span>
                    <div className="p-3.5 rounded-2xl rounded-tl-xs bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-medium leading-relaxed">
                      Chào cô giáo! Sáng nay bé {stu.nickname} ăn sáng ở nhà rồi ạ. Trưa nay nhờ cô nhắc nhà bếp để ý suất ăn {stu.healthRecord.allergies ? 'kiêng dị ứng hải sản' : 'uống nhiều nước ấm'} giúp em nhé. Cảm ơn cô nhiều ạ!
                    </div>
                  </div>

                  {/* Tin nhắn mẫu 2 (Giáo viên) */}
                  <div className="flex flex-col items-end space-y-1 max-w-[85%] ml-auto">
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                      {stu.enrollmentHistory[0]?.teacher?.split('&')[0]?.trim() || 'Cô giáo'} • 07:38
                    </span>
                    <div className="p-3.5 rounded-2xl rounded-tr-xs bg-[#064E3B] text-white font-medium leading-relaxed shadow-sm">
                      Dạ cô chào mẹ bé {stu.nickname}! Cô đã ghi chú vào phiếu kiểm thực riêng của nhà bếp và chuẩn bị khay ăn cẩn thận cho bé rồi mẹ nhé. Mẹ yên tâm công tác ạ!
                    </div>
                  </div>

                  {/* Tin nhắn mẫu 3 (Giáo viên) */}
                  <div className="flex flex-col items-end space-y-1 max-w-[85%] ml-auto">
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                      {stu.enrollmentHistory[0]?.teacher?.split('&')[0]?.trim() || 'Cô giáo'} • 14:15
                    </span>
                    <div className="p-3.5 rounded-2xl rounded-tr-xs bg-[#064E3B] text-white font-medium leading-relaxed shadow-sm">
                      Cập nhật trưa nay: Bé {stu.name} ăn rất ngon miệng hết suất, ngủ trưa đủ giấc từ 11h30 đến 14h, tinh thần hoạt bát và vui vẻ lắm ạ!
                    </div>
                  </div>

                  {/* Dynamic user added messages */}
                  {extraChatMessages.map((msg, i) => (
                    <div key={i} className="flex flex-col items-end space-y-1 max-w-[85%] ml-auto">
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                        {msg.senderName} • {msg.time}
                      </span>
                      <div className="p-3.5 rounded-2xl rounded-tr-xs bg-[#064E3B] text-white font-medium leading-relaxed shadow-sm">
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Compose input */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700/80">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={chatInputText}
                    onChange={(e) => setChatInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSendChatMessage();
                      }
                    }}
                    placeholder={`Gửi lời nhắn hoặc dặn dò phụ huynh ${stu.guardians[0]?.name || 'bé'}...`}
                    className="flex-1 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 outline-none text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleSendChatMessage}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Gửi</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab Content: ĐIỂM DANH & ĐÓN TRẢ CÁ NHÂN ── */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 flex items-center justify-center font-black">
                <CalendarCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Sổ Điểm Danh & Đón Trả An Toàn — {stu.name}</span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    Chuyên cần: {stu.attendanceRate}
                  </span>
                </h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  Lớp: <strong>{stu.className}</strong> • Người đưa đón ủy quyền: <strong>{stu.guardians.map(g => `${g.name} (${g.role})`).join(', ')}</strong>
                </p>
              </div>
            </div>

            <Link
              href="/dashboard/education/attendance"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all w-fit"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              <span>Sổ điểm danh cả lớp</span>
            </Link>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="p-4 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 space-y-1">
              <span className="text-emerald-700 dark:text-emerald-300 font-bold block">Có mặt tháng này</span>
              <p className="text-2xl font-black text-emerald-800 dark:text-emerald-200">19 ngày</p>
              <span className="text-[11px] text-emerald-600">Đúng giờ & chuẩn giờ</span>
            </div>
            <div className="p-4 rounded-3xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 space-y-1">
              <span className="text-amber-700 dark:text-amber-300 font-bold block">Nghỉ có phép</span>
              <p className="text-2xl font-black text-amber-800 dark:text-amber-200">1 ngày</p>
              <span className="text-[11px] text-amber-600">Báo qua sổ liên lạc</span>
            </div>
            <div className="p-4 rounded-3xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/80 space-y-1">
              <span className="text-indigo-700 dark:text-indigo-300 font-bold block">Đến muộn</span>
              <p className="text-2xl font-black text-indigo-800 dark:text-indigo-200">1 ngày</p>
              <span className="text-[11px] text-indigo-600">Dưới 15 phút</span>
            </div>
            <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1">
              <span className="text-slate-500 font-bold block">Vắng không phép</span>
              <p className="text-2xl font-black text-slate-800 dark:text-slate-200">0 ngày</p>
              <span className="text-[11px] text-slate-400">Tuyệt đối an toàn</span>
            </div>
          </div>

          {/* Safe Pickup Today Box */}
          <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/80 pb-3">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Quy Trình Giao Nhận & Đón Trả Trẻ Hôm Nay</span>
              </h4>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Đã kiểm thực an toàn
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Check-in Buổi Sáng:</span>
                  <span className="font-black text-emerald-600 text-sm">07:35 AM</span>
                </div>
                <div className="space-y-1 text-slate-500">
                  <p>• Thân nhiệt đầu ngày: <strong className="text-slate-800 dark:text-slate-200">36.6°C</strong> (Bình thường)</p>
                  <p>• Người đưa đến lớp: <strong className="text-slate-800 dark:text-slate-200">{stu.guardians[0]?.name || 'Phụ huynh'} ({stu.guardians[0]?.role})</strong></p>
                  <p>• Giáo viên đón trẻ: <strong className="text-slate-800 dark:text-slate-200">{stu.enrollmentHistory[0]?.teacher?.split('&')[0]?.trim()}</strong></p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Check-out Buổi Chiều:</span>
                  <span className="font-black text-indigo-600 text-sm">16:45 PM</span>
                </div>
                <div className="space-y-1 text-slate-500">
                  <p>• Trạng thái: <strong className="text-emerald-600">Đã đón về an toàn</strong></p>
                  <p>• Người đón ủy quyền: <strong className="text-slate-800 dark:text-slate-200">{stu.guardians[0]?.name || 'Phụ huynh'} ({stu.guardians[0]?.role})</strong></p>
                  <p>• Phương thức xác thực: <strong className="text-slate-800 dark:text-slate-200">Quét mã QR Phụ huynh & Face ID</strong></p>
                </div>
              </div>
            </div>
          </div>

          {/* Individual Attendance Table */}
          <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-4 text-xs">
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-emerald-600" />
              <span>Lịch Sử Chấm Công & Điểm Danh 10 Ngày Gần Nhất Của Bé</span>
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold">
                    <th className="py-3 px-3">Ngày học</th>
                    <th className="py-3 px-3">Trạng thái</th>
                    <th className="py-3 px-3">Thân nhiệt</th>
                    <th className="py-3 px-3">Giờ đến</th>
                    <th className="py-3 px-3">Giờ về</th>
                    <th className="py-3 px-3">Người đưa / đón</th>
                    <th className="py-3 px-3">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {[
                    { date: '18/10/2026', day: 'Thứ Sáu', status: 'Có mặt', temp: '36.6°C', in: '07:35', out: '16:45', guardian: stu.guardians[0]?.name, note: 'Ăn ngoan, vui vẻ' },
                    { date: '17/10/2026', day: 'Thứ Năm', status: 'Có mặt', temp: '36.5°C', in: '07:40', out: '16:50', guardian: stu.guardians[0]?.name, note: 'Tham gia học tạo hình' },
                    { date: '16/10/2026', day: 'Thứ Tư', status: 'Có mặt', temp: '36.6°C', in: '07:32', out: '16:40', guardian: stu.guardians[0]?.name, note: 'Bình thường' },
                    { date: '15/10/2026', day: 'Thứ Ba', status: 'Có mặt', temp: '36.7°C', in: '07:45', out: '16:45', guardian: stu.guardians[0]?.name, note: 'Bình thường' },
                    { date: '14/10/2026', day: 'Thứ Hai', status: 'Đến muộn', temp: '36.5°C', in: '08:05', out: '16:50', guardian: stu.guardians[0]?.name, note: 'Phụ huynh báo kẹt xe' },
                    { date: '11/10/2026', day: 'Thứ Sáu', status: 'Có mặt', temp: '36.6°C', in: '07:35', out: '16:45', guardian: stu.guardians[0]?.name, note: 'Bình thường' },
                    { date: '10/10/2026', day: 'Thứ Năm', status: 'Có mặt', temp: '36.6°C', in: '07:30', out: '16:40', guardian: stu.guardians[0]?.name, note: 'Sinh hoạt ngoài trời' },
                    { date: '09/10/2026', day: 'Thứ Tư', status: 'Nghỉ có phép', temp: '--', in: '--', out: '--', guardian: stu.guardians[0]?.name, note: 'Đi tiêm chủng định kỳ' },
                    { date: '08/10/2026', day: 'Thứ Ba', status: 'Có mặt', temp: '36.6°C', in: '07:38', out: '16:45', guardian: stu.guardians[0]?.name, note: 'Bình thường' },
                    { date: '07/10/2026', day: 'Thứ Hai', status: 'Có mặt', temp: '36.5°C', in: '07:35', out: '16:40', guardian: stu.guardians[0]?.name, note: 'Đầu tuần vui vẻ' },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                        {row.date} <span className="text-slate-400 font-normal text-[11px]">({row.day})</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          row.status === 'Có mặt'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : row.status === 'Đến muộn'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-300">{row.temp}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{row.in}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{row.out}</td>
                      <td className="py-3 px-3 text-slate-800 dark:text-slate-200 font-medium">{row.guardian}</td>
                      <td className="py-3 px-3 text-slate-500">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab Content: ĐÁNH GIÁ PHÁT TRIỂN CÁ NHÂN (NAEYC) ── */}
      {activeTab === 'grades' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 flex items-center justify-center font-black">
                <GraduationCap className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Hồ Sơ Đánh Giá Phát Triển Mầm Non (NAEYC) — {stu.name}</span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    Kỳ: Tháng 10/2026
                  </span>
                </h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  Giáo viên đánh giá: <strong>{stu.enrollmentHistory[0]?.teacher || 'Hội đồng sư phạm'}</strong> • Tổng thể: <strong className="text-emerald-600">Phát triển hài hòa xuất sắc</strong>
                </p>
              </div>
            </div>

            <Link
              href="/dashboard/education/grades"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all w-fit"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              <span>Bảng đánh giá cả lớp</span>
            </Link>
          </div>

          {/* 5 Domains Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-xs">
            {/* Domain 1: Thể chất */}
            <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-rose-500" />
                  <span>1. Thể Chất & Vận Động</span>
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[11px]">
                  Đạt chuẩn
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-slate-500">
                  <span>Tiến độ hoàn thành</span>
                  <span className="text-emerald-600">92%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '92%' }}></div>
                </div>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                Chiều cao <strong>{stu.healthRecord.height}</strong>, cân nặng <strong>{stu.healthRecord.weight}</strong> ({stu.healthRecord.bmiStatus}). Vận động thô nhanh nhẹn, giữ thăng bằng tốt trên cầu thăng bằng và leo trèo đồ chơi ngoài trời an toàn.
              </p>
            </div>

            {/* Domain 2: Nhận thức */}
            <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>2. Nhận Thức & Tư Duy</span>
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px]">
                  Tốt
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-slate-500">
                  <span>Tiến độ hoàn thành</span>
                  <span className="text-blue-600">94%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: '94%' }}></div>
                </div>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                Nhận biết chính xác các hình khối cơ bản (vuông, tròn, tam giác). Đếm thành thạo số lượng trong phạm vi 1 đến 10 và hiểu khái niệm so sánh to - nhỏ, cao - thấp.
              </p>
            </div>

            {/* Domain 3: Ngôn ngữ */}
            <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-500" />
                  <span>3. Ngôn Ngữ & Giao Tiếp</span>
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[11px]">
                  Tốt
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-slate-500">
                  <span>Tiến độ hoàn thành</span>
                  <span className="text-indigo-600">93%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: '93%' }}></div>
                </div>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                Phát âm tròn chữ, tự tin nói tròn câu có đủ chủ vị. Biết dùng lời nói để thể hiện cảm xúc và mong muốn cá nhân. Rất thích nghe cô kể truyện và thuộc nhiều bài thơ ngắn.
              </p>
            </div>

            {/* Domain 4: Tình cảm XH */}
            <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-500" />
                  <span>4. Tình Cảm & Kỹ Năng Xã Hội</span>
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[11px]">
                  Đạt chuẩn
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-slate-500">
                  <span>Tiến độ hoàn thành</span>
                  <span className="text-emerald-600">89%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '89%' }}></div>
                </div>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                Biết chào hỏi cô giáo và người lớn lễ phép. Biết chia sẻ đồ chơi cùng bạn bè, không tranh giành và chủ động cất dọn đồ chơi vào đúng khay sau khi chơi xong.
              </p>
            </div>

            {/* Domain 5: Thẩm mỹ */}
            <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-purple-500" />
                  <span>5. Thẩm Mỹ & Nghệ Thuật</span>
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold text-[11px]">
                  Xuất sắc
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-slate-500">
                  <span>Tiến độ hoàn thành</span>
                  <span className="text-purple-600">96%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: '96%' }}></div>
                </div>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                Cảm thụ âm nhạc rất tốt, thích hát và nhún nhảy theo giai điệu bài hát mầm non. Tô màu tranh không bị lem ra ngoài, phối màu rực rỡ và có trí tưởng tượng phong phú.
              </p>
            </div>

            {/* Teacher Assessment Summary Card */}
            <div className="rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 p-6 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                  <CheckCheck className="w-4 h-4 text-emerald-600" />
                  <span>Nhận Xét Của Giáo Viên Chủ Nhiệm</span>
                </h4>
              </div>
              <p className="text-emerald-800 dark:text-emerald-300 leading-relaxed font-semibold">
                &quot;Bé {stu.name} có sự tiến bộ rất nhanh trong tháng 10. Bé ngoan, hòa đồng và luôn hào hứng với các hoạt động trải nghiệm kỹ năng sống của lớp.&quot;
              </p>
              <div className="pt-2 border-t border-emerald-200/60 text-emerald-700 dark:text-emerald-400 text-[11px]">
                <strong>Đề xuất gia đình:</strong> Khuyến khích bé tự xâu cúc áo và uống nhiều nước lọc tại nhà.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab Content: HỌC PHÍ & KHOẢN THU CÁ NHÂN ── */}
      {activeTab === 'finance' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 flex items-center justify-center font-black">
                <CreditCard className="w-6 h-6 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Sổ Học Phí & Khoản Thu Cá Nhân — {stu.name}</span>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                    stu.enrollmentHistory[0]?.tuitionStatus === 'Đã thanh toán'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {stu.enrollmentHistory[0]?.tuitionStatus || 'Đã thanh toán'}
                  </span>
                </h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  Niên khóa: <strong>{stu.enrollmentHistory[0]?.year || '2026 - 2027'}</strong> • Người nộp: <strong>{stu.guardians[0]?.name} ({stu.guardians[0]?.role})</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setToastMessage(`Đã xuất phiếu thu học phí bé ${stu.name} ra file PDF!`)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>In phiếu thu</span>
              </button>
              <Link
                href="/dashboard/education/finance"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all w-fit"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                <span>Quản lý tài chính trường</span>
              </Link>
            </div>
          </div>

          {/* Finance Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1">
              <span className="text-slate-500 font-bold block">Tổng tiền học phí kỳ này</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white">8.500.000 đ</p>
              <span className="text-[11px] text-slate-400">Gồm học phí, bán trú & cơ sở vật chất</span>
            </div>
            <div className="p-4 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 space-y-1">
              <span className="text-emerald-700 dark:text-emerald-300 font-bold block">Số tiền đã nộp</span>
              <p className="text-2xl font-black text-emerald-800 dark:text-emerald-200">
                {stu.enrollmentHistory[0]?.tuitionStatus === 'Còn công nợ' ? '4.000.000 đ' : '8.500.000 đ'}
              </p>
              <span className="text-[11px] text-emerald-600">Đã xuất biên nhận kế toán</span>
            </div>
            <div className="p-4 rounded-3xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 space-y-1">
              <span className="text-rose-700 dark:text-rose-300 font-bold block">Dư nợ còn lại</span>
              <p className="text-2xl font-black text-rose-800 dark:text-rose-200">
                {stu.enrollmentHistory[0]?.tuitionStatus === 'Còn công nợ' ? '4.500.000 đ' : '0 đ'}
              </p>
              <span className="text-[11px] text-rose-600">
                {stu.enrollmentHistory[0]?.tuitionStatus === 'Còn công nợ' ? 'Hạn chót: 30/10/2026' : 'Hoàn tất nghĩa vụ tài chính'}
              </span>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-4 text-xs">
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>Bảng Kê Chi Tiết Các Khoản Thu Kỳ Học Của Riêng Bé</span>
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold">
                    <th className="py-3 px-3">STT</th>
                    <th className="py-3 px-3">Khoản mục thu</th>
                    <th className="py-3 px-3">Đơn giá / Định mức</th>
                    <th className="py-3 px-3 text-right">Số tiền</th>
                    <th className="py-3 px-3 text-right">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {[
                    { no: 1, title: 'Học phí chương trình mầm non chất lượng cao', rate: '1 học kỳ (5 tháng)', amount: '5.500.000 đ', status: 'Đã thanh toán' },
                    { no: 2, title: 'Tiền ăn bán trú dinh dưỡng (Sáng + Trưa + Xế)', rate: '22 ngày x 75.000 đ', amount: '1.650.000 đ', status: 'Đã thanh toán' },
                    { no: 3, title: 'Phí dịch vụ bán trú & chăm sóc ngủ trưa máy lạnh', rate: 'Định mức tháng', amount: '600.000 đ', status: 'Đã thanh toán' },
                    { no: 4, title: 'Phí hoạt động dã ngoại & trải nghiệm ngoại khóa', rate: 'Học kỳ 1', amount: '450.000 đ', status: stu.enrollmentHistory[0]?.tuitionStatus === 'Còn công nợ' ? 'Chưa đóng' : 'Đã thanh toán' },
                    { no: 5, title: 'Quỹ cơ sở vật chất & học cụ phẩm mỹ thuật đầu năm', rate: 'Thu 1 lần / năm', amount: '300.000 đ', status: stu.enrollmentHistory[0]?.tuitionStatus === 'Còn công nợ' ? 'Chưa đóng' : 'Đã thanh toán' },
                  ].map((item) => (
                    <tr key={item.no} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-3 font-bold text-slate-400">{item.no}</td>
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">{item.title}</td>
                      <td className="py-3 px-3 text-slate-500">{item.rate}</td>
                      <td className="py-3 px-3 font-black text-slate-900 dark:text-white text-right">{item.amount}</td>
                      <td className="py-3 px-3 text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          item.status === 'Đã thanh toán'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 font-black">
                    <td colSpan={3} className="py-3.5 px-3 text-slate-800 dark:text-slate-200 text-right">TỔNG CỘNG HỌC PHÍ KỲ:</td>
                    <td className="py-3.5 px-3 text-emerald-700 dark:text-emerald-400 text-right text-sm">8.500.000 đ</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Receipt Info Box */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-600 dark:text-slate-300">
              <div className="space-y-0.5">
                <span className="font-bold text-slate-900 dark:text-white block">
                  Biên nhận gần nhất: PT-2026-09-{stu.id} (Ngày 05/09/2026)
                </span>
                <p className="text-[11px] text-slate-500">
                  Hình thức: Chuyển khoản VietQR Techcombank • Người nộp: {stu.guardians[0]?.name} ({stu.guardians[0]?.role})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setToastMessage(`Đang tải biên lai học phí điện tử của bé ${stu.name}...`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200/70 hover:bg-slate-300 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer w-fit"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải biên nhận PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CHỈNH SỬA & BỔ SUNG HỒ SƠ 360° ── */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-100 dark:border-slate-700/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-black">
                  <Edit3 className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Chỉnh Sửa & Bổ Sung Hồ Sơ 360°
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    Bé: <strong className="text-emerald-700 dark:text-emerald-400">{editForm.name}</strong> • Mã: {editForm.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 rounded-2xl bg-slate-200/60 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300/80 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Sub-Tabs */}
            <div className="flex items-center gap-2 px-6 pt-4 border-b border-slate-100 dark:border-slate-700/60 overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => setEditModalTab('general')}
                className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                  editModalTab === 'general'
                    ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                📝 Thông tin cơ bản
              </button>
              <button
                type="button"
                onClick={() => setEditModalTab('guardians')}
                className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                  editModalTab === 'guardians'
                    ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                👨‍👩‍👧 Người giám hộ ({editForm.guardians.length})
              </button>
              <button
                type="button"
                onClick={() => setEditModalTab('health')}
                className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                  editModalTab === 'health'
                    ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                🩺 Sức khỏe & Dinh dưỡng
              </button>
              <button
                type="button"
                onClick={() => setEditModalTab('vaccines')}
                className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                  editModalTab === 'vaccines'
                    ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                💉 Lịch tiêm chủng ({editForm.healthRecord.vaccinations.length})
              </button>
            </div>

            {/* Modal Body Form */}
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4 text-xs">
              
              {/* TAB 1: THÔNG TIN CƠ BẢN */}
              {editModalTab === 'general' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                        Họ và tên bé *
                      </label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                        Biệt danh (tên ở nhà)
                      </label>
                      <input
                        type="text"
                        value={editForm.nickname}
                        onChange={(e) => setEditForm(prev => ({ ...prev, nickname: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                        Ngày sinh
                      </label>
                      <input
                        type="text"
                        value={editForm.dob}
                        onChange={(e) => setEditForm(prev => ({ ...prev, dob: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                        Tuổi
                      </label>
                      <input
                        type="text"
                        value={editForm.age}
                        onChange={(e) => setEditForm(prev => ({ ...prev, age: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                        Giới tính
                      </label>
                      <select
                        value={editForm.gender}
                        onChange={(e) => setEditForm(prev => ({ ...prev, gender: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
                      >
                        <option value="Bé trai">Bé trai</option>
                        <option value="Bé gái">Bé gái</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                        Lớp học
                      </label>
                      <input
                        type="text"
                        value={editForm.className}
                        onChange={(e) => setEditForm(prev => ({ ...prev, className: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                        Trạng thái học vụ
                      </label>
                      <select
                        value={editForm.status}
                        onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
                      >
                        <option value="Đang học">Đang học</option>
                        <option value="Lưu ý y tế">Lưu ý y tế</option>
                        <option value="Chờ nhập học">Chờ nhập học</option>
                        <option value="Chờ bổ sung hồ sơ">Chờ bổ sung hồ sơ</option>
                        <option value="Chờ xác nhận">Chờ xác nhận</option>
                        <option value="Đã nghỉ học">Đã nghỉ học</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                      Giấy tờ còn thiếu (Nếu có)
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Thiếu sổ tiêm chủng, Thiếu bản sao khai sinh, Chưa nộp ảnh thẻ..."
                      value={editForm.missingDoc || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, missingDoc: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: NGƯỜI GIÁM HỘ */}
              {editModalTab === 'guardians' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-slate-500 font-semibold">
                      Quản lý người đưa đón và liên hệ khẩn cấp của bé
                    </p>
                    <button
                      type="button"
                      onClick={() => setEditForm(prev => ({
                        ...prev,
                        guardians: [
                          ...prev.guardians,
                          {
                            role: 'Bố',
                            name: '',
                            phone: '',
                            email: '',
                            isPrimary: prev.guardians.length === 0,
                            address: '',
                          }
                        ]
                      }))}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-xs hover:bg-emerald-200 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm người giám hộ</span>
                    </button>
                  </div>

                  {editForm.guardians.map((g, idx) => (
                    <div key={idx} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 space-y-3 relative">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                        <span className="font-extrabold text-slate-800 dark:text-slate-200">
                          Người giám hộ #{idx + 1}
                        </span>
                        {editForm.guardians.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setEditForm(prev => ({
                              ...prev,
                              guardians: prev.guardians.filter((_, i) => i !== idx)
                            }))}
                            className="text-rose-500 hover:text-rose-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Xóa</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                            Vai trò
                          </label>
                          <input
                            type="text"
                            placeholder="Bố, Mẹ, Ông, Bà..."
                            value={g.role}
                            onChange={(e) => {
                              const newGuardians = [...editForm.guardians];
                              newGuardians[idx] = { ...newGuardians[idx], role: e.target.value };
                              setEditForm(prev => ({ ...prev, guardians: newGuardians }));
                            }}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-900 dark:text-white outline-none"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                            Họ và tên
                          </label>
                          <input
                            type="text"
                            value={g.name}
                            onChange={(e) => {
                              const newGuardians = [...editForm.guardians];
                              newGuardians[idx] = { ...newGuardians[idx], name: e.target.value };
                              setEditForm(prev => ({ ...prev, guardians: newGuardians }));
                            }}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-900 dark:text-white outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                            Số điện thoại
                          </label>
                          <input
                            type="text"
                            value={g.phone}
                            onChange={(e) => {
                              const newGuardians = [...editForm.guardians];
                              newGuardians[idx] = { ...newGuardians[idx], phone: e.target.value };
                              setEditForm(prev => ({ ...prev, guardians: newGuardians }));
                            }}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-900 dark:text-white outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                            Email
                          </label>
                          <input
                            type="email"
                            value={g.email}
                            onChange={(e) => {
                              const newGuardians = [...editForm.guardians];
                              newGuardians[idx] = { ...newGuardians[idx], email: e.target.value };
                              setEditForm(prev => ({ ...prev, guardians: newGuardians }));
                            }}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-900 dark:text-white outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                          Địa chỉ thường trú
                        </label>
                        <input
                          type="text"
                          value={g.address || ''}
                          onChange={(e) => {
                            const newGuardians = [...editForm.guardians];
                            newGuardians[idx] = { ...newGuardians[idx], address: e.target.value };
                            setEditForm(prev => ({ ...prev, guardians: newGuardians }));
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-900 dark:text-white outline-none"
                        />
                      </div>

                      <div className="pt-1">
                        <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={g.isPrimary}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              const newGuardians = editForm.guardians.map((item, i) => ({
                                ...item,
                                isPrimary: i === idx ? isChecked : (isChecked ? false : item.isPrimary)
                              }));
                              setEditForm(prev => ({ ...prev, guardians: newGuardians }));
                            }}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>Đặt làm người liên hệ chính</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 3: SỨC KHỎE & DINH DƯỠNG */}
              {editModalTab === 'health' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                        Chiều cao
                      </label>
                      <input
                        type="text"
                        placeholder="Ví dụ: 102 cm"
                        value={editForm.healthRecord.height}
                        onChange={(e) => setEditForm(prev => ({
                          ...prev,
                          healthRecord: { ...prev.healthRecord, height: e.target.value }
                        }))}
                        className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                        Cân nặng
                      </label>
                      <input
                        type="text"
                        placeholder="Ví dụ: 15.8 kg"
                        value={editForm.healthRecord.weight}
                        onChange={(e) => setEditForm(prev => ({
                          ...prev,
                          healthRecord: { ...prev.healthRecord, weight: e.target.value }
                        }))}
                        className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                        Nhóm máu
                      </label>
                      <input
                        type="text"
                        placeholder="Ví dụ: O+, A+, B+, AB+"
                        value={editForm.healthRecord.bloodType}
                        onChange={(e) => setEditForm(prev => ({
                          ...prev,
                          healthRecord: { ...prev.healthRecord, bloodType: e.target.value }
                        }))}
                        className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                      Đánh giá thể trạng (WHO BMI)
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Chuẩn phát triển WHO (BMI 15.1)"
                      value={editForm.healthRecord.bmiStatus}
                      onChange={(e) => setEditForm(prev => ({
                        ...prev,
                        healthRecord: { ...prev.healthRecord, bmiStatus: e.target.value }
                      }))}
                      className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                      Dặn dò dị ứng & Thức ăn cần kiêng *
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Ghi chú chi tiết về dị ứng hải sản, dị ứng sữa bò, hen suyễn, thức ăn cần tránh..."
                      value={editForm.healthRecord.allergies}
                      onChange={(e) => setEditForm(prev => ({
                        ...prev,
                        healthRecord: { ...prev.healthRecord, allergies: e.target.value }
                      }))}
                      className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                      Ghi chú chăm sóc & Y tế đặc biệt
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ví dụ: Mang bình xịt cắt cơn, lau mát khi sốt cao > 38.5°C, cần uống nước ấm..."
                      value={editForm.healthRecord.medicalNotes}
                      onChange={(e) => setEditForm(prev => ({
                        ...prev,
                        healthRecord: { ...prev.healthRecord, medicalNotes: e.target.value }
                      }))}
                      className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* TAB 4: LỊCH TIÊM CHỦNG */}
              {editModalTab === 'vaccines' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-slate-500 font-semibold">
                      Theo dõi tiến độ tiêm vắc-xin mầm non của trẻ
                    </p>
                    <button
                      type="button"
                      onClick={() => setEditForm(prev => ({
                        ...prev,
                        healthRecord: {
                          ...prev.healthRecord,
                          vaccinations: [
                            ...prev.healthRecord.vaccinations,
                            {
                              vaccine: 'Cúm mùa 2026',
                              dose: 'Liều hàng năm',
                              status: 'completed',
                              date: '10/2026',
                            }
                          ]
                        }
                      }))}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-xs hover:bg-emerald-200 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm mũi vắc-xin</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {editForm.healthRecord.vaccinations.map((vac, idx) => (
                      <div key={idx} className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                        <div className="sm:col-span-5">
                          <label className="block text-slate-500 text-[10px] font-bold mb-1">Tên vắc-xin</label>
                          <input
                            type="text"
                            value={vac.vaccine}
                            onChange={(e) => {
                              const newVacs = [...editForm.healthRecord.vaccinations];
                              newVacs[idx] = { ...newVacs[idx], vaccine: e.target.value };
                              setEditForm(prev => ({
                                ...prev,
                                healthRecord: { ...prev.healthRecord, vaccinations: newVacs }
                              }));
                            }}
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-900 dark:text-white outline-none"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-slate-500 text-[10px] font-bold mb-1">Mũi / Liều</label>
                          <input
                            type="text"
                            value={vac.dose}
                            onChange={(e) => {
                              const newVacs = [...editForm.healthRecord.vaccinations];
                              newVacs[idx] = { ...newVacs[idx], dose: e.target.value };
                              setEditForm(prev => ({
                                ...prev,
                                healthRecord: { ...prev.healthRecord, vaccinations: newVacs }
                              }));
                            }}
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-900 dark:text-white outline-none"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-slate-500 text-[10px] font-bold mb-1">Ngày tiêm</label>
                          <input
                            type="text"
                            value={vac.date}
                            onChange={(e) => {
                              const newVacs = [...editForm.healthRecord.vaccinations];
                              newVacs[idx] = { ...newVacs[idx], date: e.target.value };
                              setEditForm(prev => ({
                                ...prev,
                                healthRecord: { ...prev.healthRecord, vaccinations: newVacs }
                              }));
                            }}
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-900 dark:text-white outline-none"
                          />
                        </div>
                        <div className="sm:col-span-2 flex items-center justify-between gap-1 pt-4 sm:pt-0">
                          <select
                            value={vac.status}
                            onChange={(e) => {
                              const newVacs = [...editForm.healthRecord.vaccinations];
                              newVacs[idx] = { ...newVacs[idx], status: e.target.value as 'completed' | 'upcoming' };
                              setEditForm(prev => ({
                                ...prev,
                                healthRecord: { ...prev.healthRecord, vaccinations: newVacs }
                              }));
                            }}
                            className="px-2 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-[11px] text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                          >
                            <option value="completed">Đã tiêm</option>
                            <option value="upcoming">Sắp tới</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              const newVacs = editForm.healthRecord.vaccinations.filter((_, i) => i !== idx);
                              setEditForm(prev => ({
                                ...prev,
                                healthRecord: { ...prev.healthRecord, vaccinations: newVacs }
                              }));
                            }}
                            className="p-1.5 text-rose-500 hover:text-rose-700 transition-colors cursor-pointer"
                            title="Xóa mũi tiêm"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 sm:p-6 bg-slate-50/80 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#064E3B] hover:bg-[#043d2e] text-white font-extrabold text-xs shadow-md shadow-emerald-950/20 transition-all active:scale-95 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Lưu Thay Đổi</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
