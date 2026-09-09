import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Only JPEG, PNG, WebP or GIF images" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be under 8MB" }, { status: 400 });
  }

  // Filename is generated, never derived from user input.
  const blob = await put(`people/${randomUUID()}.${ext}`, file, {
    access: "public",
    contentType: file.type,
  });

  return NextResponse.json({ url: blob.url });
}
