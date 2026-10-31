'use client';

/**
 * BELLA PRESCHOOL OS — LESSON PLAN EDITOR MODAL
 *
 * Comprehensive lesson planning modal for preschool administrators and teachers.
 * Enforces MOET GDMN standard pedagogical structures:
 *   1. Objectives (Knowledge, Skills, Attitude)
 *   2. Preparation & Materials
 *   3. 3-Phase Activity Execution (Engage, Core Activity, Reflection/Closure)
 *
 * Canonical Source of Truth: PostgreSQL tables `edu_curriculums` & `edu_lesson_plans`.
 *
 * @module src/app/dashboard/education/curriculum/LessonPlanEditorModal
 */

import React, { useState, useEffect, useCallback, type ChangeEvent } from 'react';
import {
  Sparkles,
  Check,
  X,
  AlertCircle,
  Loader2,
  Save,
  Plus,
  Trash2,
  BookOpen,
  Calendar,
  Layers,
  FileCheck2,
} from 'lucide-react';
import { PreschoolSelect } from '@/components/ui/PreschoolSelect';
import type {
  LessonPlanDTO,
  LessonPlanStatus,
  CurriculumAgeGroup,
  ActivityStepDTO,
  SaveLessonPlanInput,
  CurriculumDTO,
} from '@/products/bella-education/learning-development/curriculum/curriculum.contract';

interface CourseOption {
  readonly id: string;
  readonly name: string;
}

interface LessonPlanEditorModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSaved?: (plan: LessonPlanDTO) => void;
  readonly initialPlan?: LessonPlanDTO | null;
  readonly curriculums?: readonly CurriculumDTO[];
  readonly courses?: readonly CourseOption[];
  readonly defaultWeek?: number;
  readonly defaultYear?: number;
}

const AGE_GROUPS: ReadonlyArray<{ value: CurriculumAgeGroup; label: string }> = [
  { value: 'ALL', label: 'Tất cả các khối (0-6 tuổi)' },
  { value: 'NURSERY', label: 'Nhà trẻ (18 - 36 tháng)' },
  { value: 'TODDLER', label: 'Mẫu giáo Bé / Mầm (3 - 4 tuổi)' },
  { value: 'KINDY_1', label: 'Mẫu giáo Nhỡ / Chồi (4 - 5 tuổi)' },
  { value: 'KINDY_2', label: 'Mẫu giáo Lớn / Lá (5 - 6 tuổi)' },
];

const SUBJECT_DOMAINS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'NHAN_THUC', label: 'Phát triển Nhận thức (Khám phá KH & Toán)' },
  { value: 'THE_CHAT', label: 'Phát triển Thể chất (Vận động & Sức khỏe)' },
  { value: 'NGON_NGU', label: 'Phát triển Ngôn ngữ (Văn học & Chữ cái)' },
  { value: 'THAM_MY', label: 'Phát triển Thẩm mỹ (Âm nhạc & Tạo hình)' },
  { value: 'TINH_CAM_XH', label: 'Tình cảm & Kỹ năng xã hội' },
  { value: 'TIENG_ANH', label: 'Tiếng Anh mầm non (Phonics & Songs)' },
  { value: 'STEAM', label: 'STEAM & Thí nghiệm trải nghiệm' },
];

interface PedagogicalSample {
  readonly theme: string;
  readonly title: string;
  readonly knowledge: string;
  readonly skills: string;
  readonly attitude: string;
  readonly materials: string;
  readonly steps: ReadonlyArray<ActivityStepDTO>;
}

const PEDAGOGICAL_SAMPLES: Readonly<Record<string, PedagogicalSample>> = {
  NHAN_THUC: {
    theme: 'Thế giới Động vật quanh bé',
    title: 'Khám phá đặc điểm một số con vật nuôi trong gia đình',
    knowledge: 'Trẻ nhận biết, gọi đúng tên các con vật thân quen (chó, mèo, gà). Biết được đặc điểm nổi bật (bộ lông, tiếng kêu, thức ăn yêu thích) và lợi ích của chúng đối với con người.',
    skills: 'Rèn kỹ năng quan sát, so sánh, phân biệt và phát triển ngôn ngữ mạch lạc. Trẻ biết mô phỏng tiếng kêu và vận động đặc trưng của từng con vật.',
    attitude: 'Giáo dục trẻ lòng yêu thương, biết quý trọng và chăm sóc thú cưng nuôi trong gia đình; nhắc nhở trẻ không trêu chọc động vật lạ để đảm bảo an toàn.',
    materials: 'Giáo viên: Mô hình trang trại mini, video âm thanh chân thực các con vật, loa phát nhạc, tranh ảnh sắc nét.\nTrẻ: Bộ thẻ tranh con vật cầm tay, mũ hóa trang con vật cho từng bé.',
    steps: [
      {
        stepNumber: 1,
        stepName: '1. Ổn định & Gây hứng thú (3 - 5 phút)',
        durationMinutes: 5,
        teacherAction: 'Tập trung trẻ, mở nhạc bài hát "Gà trống, mèo con và cún con". Cho cả lớp hát và nhún nhảy theo nhịp điệu. Đặt câu hỏi đố vui gợi mở về các bạn nhỏ trong bài hát.',
        childrenAction: 'Hào hứng hát múa cùng cô, lắng nghe câu hỏi và cùng suy nghĩ đoán tên các loài vật.',
      },
      {
        stepNumber: 2,
        stepName: '2. Hoạt động trọng tâm (18 - 22 phút)',
        durationMinutes: 20,
        teacherAction: 'Lần lượt xuất hiện từng mô hình/hình ảnh con vật (Mèo, Chó, Gà). Cho trẻ quan sát và đàm thoại: "Đây là bạn nào?", "Bạn có tiếng kêu thế nào?", "Bộ lông của bạn màu gì?". Tổ chức trò chơi: "Ai nhanh hơn" cho trẻ ghép thẻ hình tương ứng.',
        childrenAction: 'Chăm chú quan sát, trả lời to rõ ràng, giả tiếng kêu "meo meo", "gâu gâu", "cục tác" và hào hứng tham gia ghép hình thẻ.',
      },
      {
        stepNumber: 3,
        stepName: '3. Hồi tĩnh - Củng cố & Kết thúc (3 - 5 phút)',
        durationMinutes: 5,
        teacherAction: 'Tuyên dương tinh thần học tập tích cực của cả lớp. Giáo dục trẻ nhớ rửa tay bằng xà phòng sau khi chơi với thú cưng. Cho trẻ nhẹ nhàng vận động ra sân chơi thư giãn.',
        childrenAction: 'Lắng nghe lời cô dặn dò, cùng cô xếp dọn đồ dùng học cụ ngăn nắp và di chuyển ra sân.',
      },
    ],
  },
  THE_CHAT: {
    theme: 'Bé lớn lên khỏe mạnh',
    title: 'Vận động cơ bản: Bò chui qua cổng hẹp - Bật xa tại chỗ',
    knowledge: 'Trẻ biết tên bài vận động, hiểu cách phối hợp nhịp nhàng chân tay mắt khi bò chui qua cổng không chạm lưng và cách tạo đà bật xa tiếp đất bằng hai nửa bàn chân.',
    skills: 'Rèn sự dẻo dai của cơ bắp, khả năng định hướng không gian và giữ thăng bằng cơ thể khi thực hiện liên hoàn động tác.',
    attitude: 'Tạo tâm lý hào hứng tập luyện thể dục thể thao, biết xếp hàng chờ tới lượt và cổ vũ bạn bè nhiệt tình.',
    materials: 'Giáo viên: 4 cổng chui mầm non bọc nỉ an toàn, vạch xuất phát, thảm xốp chống trơn trượt, còi điều lệnh.\nTrẻ: Trang phục gọn gàng, giày thể thao sạch.',
    steps: [
      {
        stepNumber: 1,
        stepName: '1. Khởi động (3 - 5 phút)',
        durationMinutes: 5,
        teacherAction: 'Cho trẻ đi vòng tròn kết hợp các kiểu đi: đi bằng mũi chân, gót chân, chạy chậm, chạy nhanh, sau đó chuyển về đội hình 3 hàng ngang.',
        childrenAction: 'Đi theo hiệu lệnh còi của cô, thực hiện các kiểu đi đều đặn và chuyển đội hình đúng vị trí.',
      },
      {
        stepNumber: 2,
        stepName: '2. Trọng động (20 phút)',
        durationMinutes: 20,
        teacherAction: 'Bài tập phát triển chung (Tay, Bụng, Chân, Bật). Sau đó cô làm mẫu vận động "Bò chui qua cổng" lần 1 không giải thích, lần 2 giải thích chi tiết. Mời 2 trẻ làm thử rồi cho lần lượt cả lớp thực hành.',
        childrenAction: 'Tập bài tập phát triển chung theo cô. Quan sát cô làm mẫu. Tự tin bước lên thực hiện động tác bò chui khéo léo không chạm cổng.',
      },
      {
        stepNumber: 3,
        stepName: '3. Hồi tĩnh (3 - 5 phút)',
        durationMinutes: 5,
        teacherAction: 'Cho trẻ đi lại nhẹ nhàng hít thở sâu 2-3 vòng theo điệu nhạc êm dịu, thư giãn các khớp cơ.',
        childrenAction: 'Thả lỏng tay chân, hít thở sâu và kết thúc giờ học vui vẻ.',
      },
    ],
  },
  NGON_NGU: {
    theme: 'Gia đình yêu thương của bé',
    title: 'Kể chuyện diễn cảm: Thỏ con thông minh và Lòng hiếu thảo',
    knowledge: 'Trẻ hiểu nội dung câu chuyện, nhớ tên các nhân vật (Thỏ mẹ, Thỏ con, Bác gấu). Nhận biết hành động ngoan ngoãn biết vâng lời mẹ của bạn Thỏ.',
    skills: 'Rèn kỹ năng lắng nghe có chủ định, diễn đạt cảm xúc qua câu từ và trả lời câu hỏi trọn câu tròn vành rõ chữ.',
    attitude: 'Giáo dục lòng hiếu thảo, biết yêu thương chăm sóc ông bà cha mẹ và giúp đỡ mọi người xung quanh.',
    materials: 'Giáo viên: Rối tay các nhân vật Thỏ, Gấu; màn chiếu mô hình nhà gỗ trong rừng; tranh vẽ minh họa cốt truyện.\nTrẻ: Ghế ngồi chữ U thoải mái quan sát.',
    steps: [
      {
        stepNumber: 1,
        stepName: '1. Gây hứng thú (3 - 5 phút)',
        durationMinutes: 5,
        teacherAction: 'Đưa rối tay bạn Thỏ con ra chào các bé: "Xin chào các bạn nhỏ, hôm nay tớ có một câu chuyện rất cảm động muốn chia sẻ cùng các bạn!".',
        childrenAction: 'Vẫy tay chào bạn Thỏ, chăm chú lắng nghe phần mở đầu câu chuyện.',
      },
      {
        stepNumber: 2,
        stepName: '2. Kể chuyện và Đàm thoại (20 phút)',
        durationMinutes: 20,
        teacherAction: 'Cô kể diễn cảm lần 1 kết hợp cử chỉ điệu bộ. Kể lần 2 kết hợp xem hình ảnh minh họa trên máy chiếu. Đặt câu hỏi: "Ai đã giúp mẹ?", "Khi gặp bác Gấu, Thỏ đã làm gì?". Cho trẻ nhắc lại những lời thoại dễ thương.',
        childrenAction: 'Lắng nghe câu chuyện, hào hứng trả lời câu hỏi của cô và bắt chước giọng điệu lễ phép của chú thỏ.',
      },
      {
        stepNumber: 3,
        stepName: '3. Củng cố & Đánh giá (3 - 5 phút)',
        durationMinutes: 5,
        teacherAction: 'Khái quát bài học nhân văn: Con ngoan phải biết nghe lời cha mẹ. Khen ngợi sự tập trung của trẻ. Cho trẻ hát bài "Cả nhà thương nhau".',
        childrenAction: 'Đồng thanh hát vang bài hát và ôm bạn bên cạnh thể hiện sự gắn kết.',
      },
    ],
  },
  THAM_MY: {
    theme: 'Sắc màu quê hương',
    title: 'Tạo hình: Vẽ và tô màu vườn hoa mùa xuân rực rỡ',
    knowledge: 'Trẻ nhận biết các màu sắc cơ bản (đỏ, vàng, xanh). Biết cách phối màu và kết hợp các nét vẽ cơ bản (nét cong, nét thẳng) để tạo thành bông hoa.',
    skills: 'Rèn kỹ năng cầm bút đúng cách bằng 3 đầu ngón tay, tư thế ngồi ngay ngắn và điều khiển cổ tay khéo léo.',
    attitude: 'Bồi dưỡng tình yêu cái đẹp thiên nhiên, biết giữ gìn sản phẩm của mình và tôn trọng sản phẩm của bạn bè.',
    materials: 'Giáo viên: Tranh mẫu vườn hoa vẽ bằng sáp màu và màu nước, bảng trưng bày sản phẩm.\nTrẻ: Giấy vẽ A4 đóng bìa, sáp màu đa dạng, khăn lau tay.',
    steps: [
      {
        stepNumber: 1,
        stepName: '1. Quan sát & Đàm thoại tranh mẫu (5 phút)',
        durationMinutes: 5,
        teacherAction: 'Cho trẻ xem tranh mẫu vườn hoa rực rỡ. Đặt câu hỏi: "Bông hoa màu gì?", "Cánh hoa hình gì?", "Nhụy hoa ở đâu?".',
        childrenAction: 'Ngắm nhìn tranh, cùng chỉ ra các chi tiết màu sắc và cánh hoa yêu thích.',
      },
      {
        stepNumber: 2,
        stepName: '2. Cô hướng dẫn thao tác & Trẻ thực hành (18 - 20 phút)',
        durationMinutes: 20,
        teacherAction: 'Cô vẽ mẫu nét tròn làm nhụy hoa, nét cong nối dài làm cánh hoa, thân hoa thẳng đứng và lá xanh hai bên. Sau đó phát đồ dùng cho trẻ thực hành. Cô đi từng bàn động viên, hỗ trợ bé còn lúng túng.',
        childrenAction: 'Cầm bút sáp vẽ bông hoa theo sáng tạo cá nhân, tô màu cẩn thận không để chờm ra ngoài nét vẽ.',
      },
      {
        stepNumber: 3,
        stepName: '3. Trưng bày & Nhận xét sản phẩm (5 phút)',
        durationMinutes: 5,
        teacherAction: 'Treo các bức tranh lên giá trưng bày triển lãm nhỏ. Mời trẻ giới thiệu bức tranh của mình và nhận xét bài bạn thích nhất.',
        childrenAction: 'Chiêm ngưỡng tranh của lớp, chỉ vào tác phẩm của mình và vui mừng khi được cô khen.',
      },
    ],
  },
  TINH_CAM_XH: {
    theme: 'Bé ngoan lịch sự',
    title: 'Kỹ năng sống: Bé biết nói lời Cảm ơn và Xin lỗi đúng lúc',
    knowledge: 'Trẻ hiểu ý nghĩa của lời "Cảm ơn" khi được người khác giúp đỡ hoặc nhận quà, và lời "Xin lỗi" khi vô tình làm sai hoặc làm phiền người khác.',
    skills: 'Rèn thái độ giao tiếp lễ phép, khoanh tay cúi đầu chào khi nói lời cảm ơn hoặc nhận lỗi chân thành.',
    attitude: 'Hình thành nhân cách tốt, tôn trọng bạn bè, biết quan tâm và chia sẻ cùng cộng đồng.',
    materials: 'Giáo viên: Video tình huống giả định (được bạn chia đồ chơi, lỡ làm rơi bút màu của bạn).\nTrẻ: Huy hiệu "Bé lịch thiệp".',
    steps: [
      {
        stepNumber: 1,
        stepName: '1. Tạo tình huống thực tế (3 - 5 phút)',
        durationMinutes: 5,
        teacherAction: 'Cô giả định tình huống vô tình làm rơi đồ dùng và có một bạn nhặt giúp cô. Cô mỉm cười nói: "Cô cảm ơn con!". Sau đó hỏi trẻ: "Tại sao cô lại nói lời cảm ơn?".',
        childrenAction: 'Quan sát tình huống và hào hứng xung phong trả lời ý kiến của mình.',
      },
      {
        stepNumber: 2,
        stepName: '2. Trải nghiệm xử lý tình huống (18 - 20 phút)',
        durationMinutes: 20,
        teacherAction: 'Cho từng cặp trẻ đóng vai các tình huống: Bạn tặng kẹo -> nói cảm ơn; Bạn vô tình va vào tay mình -> bạn xin lỗi và mình mỉm cười bỏ qua. Cô uốn nắn từng cử chỉ khoanh tay lễ phép.',
        childrenAction: 'Đóng vai nhiệt tình, thực hành nói câu: "Tớ cảm ơn bạn!", "Tớ xin lỗi bạn, bạn có sao không?".',
      },
      {
        stepNumber: 3,
        stepName: '3. Tuyên dương & Tặng huy hiệu (5 phút)',
        durationMinutes: 5,
        teacherAction: 'Gắn tặng mỗi bé một huy hiệu Bé Lịch Thiệp. Nhắc nhở các bé luôn nhớ áp dụng mỗi ngày ở nhà và ở trường.',
        childrenAction: 'Vui mừng nhận huy hiệu và hứa với cô giáo sẽ luôn là bé ngoan lịch sự.',
      },
    ],
  },
};

export default function LessonPlanEditorModal({
  isOpen,
  onClose,
  onSaved,
  initialPlan,
  curriculums = [],
  courses = [],
  defaultWeek = 44,
  defaultYear = 2026,
}: LessonPlanEditorModalProps) {
  // Form State
  const [weekNumber, setWeekNumber] = useState<number>(defaultWeek);
  const [year, setYear] = useState<number>(defaultYear);
  const [plannedDate, setPlannedDate] = useState<string>('');
  const [courseId, setCourseId] = useState<string>('');
  const [curriculumId, setCurriculumId] = useState<string>('');
  const [ageGroup, setAgeGroup] = useState<CurriculumAgeGroup>('ALL');
  const [subjectDomain, setSubjectDomain] = useState<string>('NHAN_THUC');
  const [theme, setTheme] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [status, setStatus] = useState<LessonPlanStatus>('APPROVED');

  // Objectives
  const [knowledge, setKnowledge] = useState<string>('');
  const [skills, setSkills] = useState<string>('');
  const [attitude, setAttitude] = useState<string>('');

  // Materials & Notes
  const [materials, setMaterials] = useState<string>('');
  const [teacherNotes, setTeacherNotes] = useState<string>('');

  // Activity Steps
  const [steps, setSteps] = useState<ActivityStepDTO[]>([]);

  // Feedback states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [templateAppliedToast, setTemplateAppliedToast] = useState<string | null>(null);

  // Initialize or reset form when modal opens or initialPlan changes
  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
      setTemplateAppliedToast(null);
      return;
    }

    if (initialPlan) {
      setWeekNumber(initialPlan.weekNumber);
      setYear(initialPlan.year);
      setPlannedDate(initialPlan.plannedDate);
      setCourseId(initialPlan.courseId || '');
      setCurriculumId(initialPlan.curriculumId || '');
      setAgeGroup(initialPlan.ageGroup);
      setSubjectDomain(initialPlan.subjectDomain);
      setTheme(initialPlan.theme);
      setTitle(initialPlan.title);
      setStatus(initialPlan.status);
      setKnowledge(initialPlan.objectives.knowledge);
      setSkills(initialPlan.objectives.skills);
      setAttitude(initialPlan.objectives.attitude);
      setMaterials(initialPlan.materials || '');
      setTeacherNotes(initialPlan.teacherNotes || '');
      setSteps([...initialPlan.activitySteps]);
    } else {
      // Default new plan
      const today = new Date().toISOString().split('T')[0] ?? '2026-10-30';
      setWeekNumber(defaultWeek);
      setYear(defaultYear);
      setPlannedDate(today);
      setCourseId('');
      setCurriculumId(curriculums[0]?.id || '');
      setAgeGroup('ALL');
      setSubjectDomain('NHAN_THUC');
      setTheme('');
      setTitle('');
      setStatus('APPROVED');
      setKnowledge('');
      setSkills('');
      setAttitude('');
      setMaterials('');
      setTeacherNotes('');
      setSteps([]);
    }
  }, [isOpen, initialPlan, defaultWeek, defaultYear, curriculums]);

  // Fast Sample Template Loader (1-Click)
  const handleLoadSampleTemplate = useCallback(() => {
    const sample = PEDAGOGICAL_SAMPLES[subjectDomain] || PEDAGOGICAL_SAMPLES.NHAN_THUC;
    if (!sample) return;

    setTheme(sample.theme);
    setTitle(sample.title);
    setKnowledge(sample.knowledge);
    setSkills(sample.skills);
    setAttitude(sample.attitude);
    setMaterials(sample.materials);
    setSteps([...sample.steps]);

    setTemplateAppliedToast(`Đã nạp giáo án mẫu chuẩn Bộ GD&ĐT cho môn: ${subjectDomain}`);
    setTimeout(() => {
      setTemplateAppliedToast(null);
    }, 3500);
  }, [subjectDomain]);

  // Step management
  const handleAddStep = useCallback(() => {
    setSteps((prev) => [
      ...prev,
      {
        stepNumber: prev.length + 1,
        stepName: `${prev.length + 1}. Hoạt động bổ trợ`,
        durationMinutes: 10,
        teacherAction: '',
        childrenAction: '',
      },
    ]);
  }, []);

  const handleRemoveStep = useCallback((index: number) => {
    setSteps((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((step, idx) => ({
          ...step,
          stepNumber: idx + 1,
        }))
    );
  }, []);

  const handleUpdateStep = useCallback(
    (index: number, field: keyof ActivityStepDTO, value: string | number) => {
      setSteps((prev) =>
        prev.map((step, i) => {
          if (i !== index) return step;
          return {
            ...step,
            [field]: value,
          };
        })
      );
    },
    []
  );

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage('Vui lòng nhập Tên bài dạy / hoạt động.');
      return;
    }
    if (!theme.trim()) {
      setErrorMessage('Vui lòng nhập Chủ đề bài học.');
      return;
    }
    if (!plannedDate) {
      setErrorMessage('Vui lòng chọn Ngày thực hiện bài dạy.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const payload: SaveLessonPlanInput = {
      id: initialPlan?.id,
      curriculumId: curriculumId || undefined,
      courseId: courseId || undefined,
      academicYear: `${year}-${year + 1}`,
      weekNumber,
      year,
      ageGroup,
      theme: theme.trim(),
      subjectDomain,
      title: title.trim(),
      plannedDate,
      status,
      objectives: {
        knowledge: knowledge.trim(),
        skills: skills.trim(),
        attitude: attitude.trim(),
      },
      materials: materials.trim() || undefined,
      activitySteps: steps,
      teacherNotes: teacherNotes.trim() || undefined,
    };

    try {
      const response = await fetch('/api/education/curriculum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'SAVE_LESSON_PLAN_FAILED');
      }

      if (onSaved && data.lessonPlan) {
        onSaved(data.lessonPlan);
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi không xác định khi lưu giáo án';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lesson-plan-modal-title"
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-emerald-100 overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
              <BookOpen className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h2 id="lesson-plan-modal-title" className="text-xl font-bold tracking-tight">
                {initialPlan ? 'Cập Nhật Giáo Án Giảng Dạy' : 'Soạn Kế Hoạch Giáo Án Mầm Non'}
              </h2>
              <p className="text-xs text-emerald-200/90">
                Tuân thủ khung sư phạm chuẩn Bộ GD{'&'}ĐT (Kiến thức - Kỹ năng - Thái độ)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10 transition-colors"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Action / Fast Template Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 rounded-xl gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                <span className="font-semibold text-emerald-900 text-sm">
                  Soạn giáo án nhanh với mẫu sư phạm mẫu
                </span>
              </div>
              <p className="text-xs text-emerald-700 mt-0.5">
                Tự động điền mục tiêu 3 phần và tiến trình dạy mẫu dựa trên lĩnh vực đã chọn
              </p>
            </div>

            <button
              type="button"
              onClick={handleLoadSampleTemplate}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all shrink-0 active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              Nạp giáo án mẫu chuẩn Bộ GD&ĐT
            </button>
          </div>

          {/* Feedback Toasts / Errors */}
          {templateAppliedToast && (
            <div className="flex items-center gap-2 p-3 bg-emerald-100 text-emerald-800 text-xs font-medium rounded-lg border border-emerald-300">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{templateAppliedToast}</span>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 text-rose-800 text-xs font-medium rounded-lg border border-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section 1: Thông tin cơ bản */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              1. Thông Tin Kế Hoạch & Lớp Học
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tuần Học *
                </label>
                <input
                  type="number"
                  min={1}
                  max={52}
                  value={weekNumber}
                  onChange={(e) => setWeekNumber(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Năm Học *
                </label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value, 10) || 2026)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ngày Thực Hiện *
                </label>
                <input
                  type="date"
                  value={plannedDate}
                  onChange={(e) => setPlannedDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Khối Tuổi Trẻ
                </label>
                <PreschoolSelect
                  value={ageGroup}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    setAgeGroup(e.target.value as CurriculumAgeGroup)
                  }
                >
                  {AGE_GROUPS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </PreschoolSelect>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lĩnh Vực Phát Triển *
                </label>
                <PreschoolSelect
                  value={subjectDomain}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setSubjectDomain(e.target.value)}
                >
                  {SUBJECT_DOMAINS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </PreschoolSelect>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lớp Áp Dụng (Tùy chọn)
                </label>
                <PreschoolSelect
                  value={courseId}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setCourseId(e.target.value)}
                >
                  <option value="">Tất cả các lớp trong khối</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </PreschoolSelect>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chủ Đề Tuần / Tháng *
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Thế giới Động vật, Ngày hội đến trường..."
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên Bài Dạy / Tên Hoạt Động *
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Khám phá đặc điểm các con vật nuôi, Bật xa tại chỗ..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 2: Mục tiêu bài học (3 Phần sư phạm) */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
              <FileCheck2 className="w-4 h-4 text-emerald-600" />
              2. Mục Tiêu Bài Học (Chuẩn Sư Phạm)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
                  a. Kiến Thức (Knowledge)
                </span>
                <textarea
                  rows={4}
                  placeholder="Trẻ nhận biết, gọi tên đúng, hiểu đặc điểm cơ bản..."
                  value={knowledge}
                  onChange={(e) => setKnowledge(e.target.value)}
                  className="w-full p-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="text-xs font-bold text-blue-800 uppercase tracking-wide">
                  b. Kỹ Năng (Skills)
                </span>
                <textarea
                  rows={4}
                  placeholder="Rèn kỹ năng quan sát, so sánh, nói đủ câu, vận động khéo léo..."
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  className="w-full p-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">
                  c. Thái Độ (Attitude)
                </span>
                <textarea
                  rows={4}
                  placeholder="Trẻ hào hứng tham gia, yêu quý bạn bè, giữ gìn học cụ..."
                  value={attitude}
                  onChange={(e) => setAttitude(e.target.value)}
                  className="w-full p-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Chuẩn bị đồ dùng */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              3. Chuẩn Bị Đồ Dùng & Học Cụ
            </h3>
            <textarea
              rows={3}
              placeholder="Đồ dùng của cô: Tranh ảnh, loa phát nhạc, video minh họa... Đồ dùng của trẻ: Thẻ bài, sáp màu, chiếu..."
              value={materials}
              onChange={(e) => setMaterials(e.target.value)}
              className="w-full p-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            />
          </div>

          {/* Section 4: Tiến trình hoạt động */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-600" />
                4. Tiến Trình Hoạt Động (Tiến Trình 3 Bước)
              </h3>
              <button
                type="button"
                onClick={handleAddStep}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm Bước
              </button>
            </div>

            {steps.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <p className="text-xs text-slate-500">Chưa có bước tiến trình nào.</p>
                <p className="text-xs text-emerald-600 font-medium mt-1">
                  Bấm &quot;Nạp giáo án mẫu&quot; ở trên hoặc bấm &quot;Thêm Bước&quot; để thiết kế.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3 relative group"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="w-6 h-6 flex items-center justify-center bg-emerald-600 text-white font-bold text-xs rounded-full shrink-0">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={step.stepName}
                          onChange={(e) => handleUpdateStep(idx, 'stepName', e.target.value)}
                          placeholder="Tên bước hoạt động"
                          className="flex-1 px-2.5 py-1 text-xs font-semibold border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-auto">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <span>Thời lượng:</span>
                          <input
                            type="number"
                            min={1}
                            max={60}
                            value={step.durationMinutes}
                            onChange={(e) =>
                              handleUpdateStep(idx, 'durationMinutes', parseInt(e.target.value, 10) || 5)
                            }
                            className="w-14 px-1.5 py-1 text-xs text-center border border-slate-200 rounded-md bg-white"
                          />
                          <span>phút</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveStep(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title="Xóa bước"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Hoạt động của Cô giáo
                        </label>
                        <textarea
                          rows={2}
                          value={step.teacherAction}
                          onChange={(e) => handleUpdateStep(idx, 'teacherAction', e.target.value)}
                          placeholder="Cô gợi mở, dẫn dắt, làm mẫu, đặt câu hỏi..."
                          className="w-full p-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Hoạt động của Trẻ em
                        </label>
                        <textarea
                          rows={2}
                          value={step.childrenAction}
                          onChange={(e) => handleUpdateStep(idx, 'childrenAction', e.target.value)}
                          placeholder="Trẻ quan sát, thực hành, trả lời, vận động..."
                          className="w-full p-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 5: Lưu ý của giáo viên */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
              5. Lưu Ý Của Giáo Viên (Ghi Chú Triển Khai)
            </h3>
            <textarea
              rows={2}
              placeholder="Ví dụ: Lưu ý chuẩn bị đủ khăn ấm cho các bé dễ bị lạnh, chú ý hỗ trợ bé An chưa phát âm rõ..."
              value={teacherNotes}
              onChange={(e) => setTeacherNotes(e.target.value)}
              className="w-full p-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            />
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-700">Trạng thái:</span>
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-white">
              <button
                type="button"
                onClick={() => setStatus('DRAFT')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  status === 'DRAFT'
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Dự Thảo
              </button>
              <button
                type="button"
                onClick={() => setStatus('APPROVED')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  status === 'APPROVED'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Đã Phê Duyệt
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 bg-slate-100 rounded-lg transition-colors"
            >
              Hủy bỏ
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Lưu Giáo Án
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
