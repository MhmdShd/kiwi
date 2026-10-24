import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Chat } from "@/models/Chat";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const chats = await Chat.find({ userId: (session.user as any).id })
    .sort({ updatedAt: -1 })
    .select("_id title createdAt updatedAt");
  return NextResponse.json(chats);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const chat = await Chat.create({ userId: (session.user as any).id, title: "New Chat" });
  return NextResponse.json(chat);
}
