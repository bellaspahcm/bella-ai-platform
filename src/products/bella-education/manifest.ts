/**
 * BELLA EDUCATION — PRODUCT MANIFEST
 *
 * Single Source of Truth declaring capabilities, workflows, permissions,
 * and UI routes for the Bella Education product vertical.
 *
 * @module src/products/bella-education/manifest
 */

import type { VerticalManifest } from '@/platform/registry/vertical-registry';

export const bellaEducationManifest: VerticalManifest & { 
  id: string; 
  capabilities: string[];
  workflows?: string[];
} = {
  id: 'bella-education',
  key: 'bella_education',
  name: 'Bella Education OS V1',
  version: '1.0.0',
  themeKey: 'classic-academic-blue',
  defaultRoute: '/dashboard/education',
  capabilities: [
    'course_catalog_query',
    'preschool_classroom_create',
    'preschool_teacher_management',
    'student_enrollment_command',
    'attendance_checkpoint_command',
    'grade_reporting_command',
    'preschool_ai_copilot',
    'preschool_nutrition_management',
    'preschool_curriculum_management'
  ],
  enabledCapabilities: [
    'course_catalog_query',
    'preschool_classroom_create',
    'preschool_teacher_management',
    'student_enrollment_command',
    'attendance_checkpoint_command',
    'grade_reporting_command',
    'preschool_ai_copilot'
  ],
  workflows: [
    'student_academic_lifecycle'
  ],
  menus: [
    { id: 'dashboard', label: 'Tổng quan', href: '/dashboard/education', icon: 'LayoutDashboard' },
    { id: 'children', label: 'Quản lý trẻ', href: '/dashboard/education/enrollments', icon: 'Baby' },
    { id: 'classes', label: 'Quản lý lớp học', href: '/dashboard/education/courses', icon: 'BookOpen' },
    { id: 'teachers', label: 'Quản lý giáo viên', href: '/dashboard/education/teachers', icon: 'UserCheck' },
    { id: 'care', label: 'Chăm sóc & Nuôi dưỡng', href: '/dashboard/education/care', icon: 'Heart' },
    { id: 'nutrition', label: 'Thực đơn & Dinh dưỡng', href: '/dashboard/education/nutrition', icon: 'Utensils' },
    { id: 'curriculum', label: 'Giáo trình & Giáo án', href: '/dashboard/education/curriculum', icon: 'BookOpenCheck' },
    { id: 'learning', label: 'Học tập & Hoạt động', href: '/dashboard/education/grades', icon: 'GraduationCap' },
    { id: 'communication', label: 'Truyền thông', href: '/dashboard/education/communication', icon: 'MessageSquare' },
    { id: 'finance', label: 'Tài chính', href: '/dashboard/education/finance', icon: 'CircleDollarSign' },
    { id: 'facilities', label: 'Cơ sở vật chất', href: '/dashboard/education/facilities', icon: 'Building2' },
    { id: 'reports', label: 'Báo cáo thống kê', href: '/dashboard/education/reports', icon: 'BarChart3' },
    { id: 'settings', label: 'Cài đặt', href: '/dashboard/settings', icon: 'Settings' }
  ]
};
