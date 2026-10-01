/**
 * Typed errors dùng trong auth + các service có auth check.
 *
 * Lý do: thay vì throw `new Error("Unauthorized")` (string chung chung),
 * ta throw class cụ thể → catch ở UI / API layer biết chính xác lỗi gì
 * và trả status code + message phù hợp.
 *
 * Pattern:
 *   try {
 *     await getSelf();
 *   } catch (error) {
 *     if (error instanceof UnauthorizedError) return 401;
 *     if (error instanceof UserNotFoundError) return 404;
 *   }
 */

export class UnauthorizedError extends Error {
  readonly code = "UNAUTHORIZED";
  constructor(message = "Bạn cần đăng nhập để thực hiện hành động này") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class UserNotFoundError extends Error {
  readonly code = "USER_NOT_FOUND";
  constructor(message = "Không tìm thấy người dùng") {
    super(message);
    this.name = "UserNotFoundError";
  }
}

export class SelfActionError extends Error {
  readonly code = "SELF_ACTION";
  constructor(message = "Bạn không thể thực hiện hành động này với chính mình") {
    super(message);
    this.name = "SelfActionError";
  }
}

export class AlreadyFollowingError extends Error {
  readonly code = "ALREADY_FOLLOWING";
  constructor(message = "Bạn đã theo dõi người dùng này rồi") {
    super(message);
    this.name = "AlreadyFollowingError";
  }
}

export class NotFollowingError extends Error {
  readonly code = "NOT_FOLLOWING";
  constructor(message = "Bạn chưa theo dõi người dùng này") {
    super(message);
    this.name = "NotFollowingError";
  }
}

export class AlreadyBlockedError extends Error {
  readonly code = "ALREADY_BLOCKED";
  constructor(message = "Người dùng này đã bị chặn rồi") {
    super(message);
    this.name = "AlreadyBlockedError";
  }
}

export class NotBlockedError extends Error {
  readonly code = "NOT_BLOCKED";
  constructor(message = "Người dùng này không bị chặn") {
    super(message);
    this.name = "NotBlockedError";
  }
}

export class CannotInteractError extends Error {
  readonly code = "CANNOT_INTERACT";
  constructor(
    message = "Không thể tương tác (bị chặn hoặc bạn đã chặn người này)"
  ) {
    super(message);
    this.name = "CannotInteractError";
  }
}

/**
 * Type guard: kiểm tra error có phải AppError không.
 */
export const isAppError = (error: unknown): error is AppErrorLike => {
  return (
    error instanceof Error &&
    typeof (error as AppErrorLike).code === "string"
  );
}

export type AppErrorLike = Error & { code?: string };
