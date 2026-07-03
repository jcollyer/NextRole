import {
  ApplicationStatus,
  CompanyPriority,
  CompanyStatus,
  HiringSignalType,
  JobStatus,
} from '@saas/db';

export const companyPriorities = [
  CompanyPriority.LOW,
  CompanyPriority.MEDIUM,
  CompanyPriority.HIGH,
  CompanyPriority.DREAM,
] as const;

export const companyStatuses = [
  CompanyStatus.TRACKING,
  CompanyStatus.WATCHING,
  CompanyStatus.APPLIED,
  CompanyStatus.INTERVIEWING,
  CompanyStatus.PAUSED,
  CompanyStatus.ARCHIVED,
] as const;

export const jobStatuses = [
  JobStatus.NEW,
  JobStatus.SAVED,
  JobStatus.ANALYZED,
  JobStatus.APPLIED,
  JobStatus.DISMISSED,
  JobStatus.ARCHIVED,
] as const;

export const applicationStatuses = [
  ApplicationStatus.SAVED,
  ApplicationStatus.APPLIED,
  ApplicationStatus.RECRUITER_SCREEN,
  ApplicationStatus.HIRING_MANAGER,
  ApplicationStatus.TECHNICAL_INTERVIEW,
  ApplicationStatus.FINAL_INTERVIEW,
  ApplicationStatus.OFFER,
  ApplicationStatus.REJECTED,
  ApplicationStatus.ARCHIVED,
] as const;

export const signalTypes = [
  HiringSignalType.FUNDING,
  HiringSignalType.HIRING_ANNOUNCEMENT,
  HiringSignalType.PRODUCT_LAUNCH,
  HiringSignalType.FOUNDER_POST,
  HiringSignalType.NEW_OFFICE,
  HiringSignalType.LAYOFF_RISK,
  HiringSignalType.OTHER,
] as const;
