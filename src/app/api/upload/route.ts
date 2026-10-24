import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import OpenAI from "openai";
import { toFile } from "openai";

function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.KIMI_API_KEY || "",
    baseURL: "https://api.moonshot.ai/v1",
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 });
  }

  const openai = getOpenAI();
  const uploaded = await openai.files.create({
    file: await toFile(file, file.name, { type: file.type }),
    purpose: "file-extract" as any,
  });

  return NextResponse.json({ fileId: uploaded.id, fileName: file.name });
}
