import type { TranslationKey } from "@/i18n/t";
import type { Role } from "@/lib/auth/roles";

/** Placeholder widgets on each role's home page. Real data arrives in later steps. */
export const ROLE_WIDGETS: Record<Role, readonly TranslationKey[]> = {
  super_admin: [
    "dashboard.widgets.users",
    "dashboard.widgets.schoolSettings",
    "dashboard.widgets.systemHealth",
  ],
  admin: [
    "dashboard.widgets.students",
    "dashboard.widgets.teachers",
    "dashboard.widgets.todayAttendance",
    "dashboard.widgets.feesDue",
  ],
  teacher: [
    "dashboard.widgets.myClasses",
    "dashboard.widgets.attendanceToTake",
    "dashboard.widgets.marksPending",
  ],
  accountant: [
    "dashboard.widgets.todaysCollection",
    "dashboard.widgets.monthCollection",
    "dashboard.widgets.topDues",
  ],
  student: [
    "dashboard.widgets.myAttendance",
    "dashboard.widgets.myResults",
    "dashboard.widgets.myFees",
  ],
  guardian: [
    "dashboard.widgets.myChildren",
    "dashboard.widgets.childrenAttendance",
    "dashboard.widgets.childrenResults",
    "dashboard.widgets.childrenFees",
  ],
};
