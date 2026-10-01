import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getSelf } from "@/lib/auth-service";

/**
 * GET /api/users/lookup?username=X — tìm user theo username.
 *
 * Trả về { id, username, imageUrl } — chỉ fields public cần cho
 * moderator add workflow.
 *
 * Rate limit không cần — user gọi ít (chỉ khi type username).
 * Privacy: chỉ trả về user PUBLIC (không leak email/externalUserId).
 */
export async function GET(request: Request) {
  try {
    // Phải login mới lookup được.
    const self = await getSelf();

    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username")?.trim();

    if (!username) {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 }
      );
    }

    if (username.length < 2 || username.length > 32) {
      return NextResponse.json(
        { error: "Username không hợp lệ" },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        imageUrl: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Không tìm thấy user" },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
