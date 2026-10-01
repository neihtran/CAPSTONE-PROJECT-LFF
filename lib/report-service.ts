import { db } from "@/lib/db";

/**
 * ReportService — quản lý reports (viewer báo cáo user/message vi phạm).
 *
 * Status: PENDING → RESOLVED | DISMISSED.
 *
 * Permissions:
 *   - Viewer: chỉ submit report (POST).
 *   - Moderator/Owner: xem queue, resolve, dismiss.
 */

export type ReportWithDetails = {
  id: string;
  status: string;
  reason: string;
  createdAt: Date;
  resolvedAt: Date | null;
  resolvedByUserId: string | null;
  stream: { id: string };
  message: {
    id: string;
    text: string;
    sentAt: Date;
  } | null;
  reportedUser: {
    id: string;
    username: string;
    imageUrl: string;
  };
  reporterUser: {
    id: string;
    username: string;
    imageUrl: string;
  };
};

/**
 * Lấy danh sách reports của 1 stream, filter theo status.
 */
export const getStreamReports = async (
  streamId: string,
  options: { status?: string; limit?: number } = {}
) => {
  const { status = "PENDING", limit = 50 } = options;

  return db.messageReport.findMany({
    where: {
      streamId,
      ...(status !== "ALL" ? { status } : {}),
    },
    include: {
      reportedUser: {
        select: { id: true, username: true, imageUrl: true },
      },
      reporterUser: {
        select: { id: true, username: true, imageUrl: true },
      },
      message: {
        select: { id: true, text: true, sentAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
};

/**
 * Đếm số PENDING reports (cho badge count).
 */
export const getPendingReportCount = async (streamId: string) => {
  return db.messageReport.count({
    where: { streamId, status: "PENDING" },
  });
};

/**
 * Resolve 1 report — mod đã xử lý (timeout/ban rồi).
 */
export const resolveReport = async (params: {
  reportId: string;
  modUserId: string;
  action: "RESOLVED" | "DISMISSED";
}) => {
  const { reportId, modUserId, action } = params;

  return db.messageReport.update({
    where: { id: reportId },
    data: {
      status: action,
      resolvedByUserId: modUserId,
      resolvedAt: new Date(),
    },
  });
};
