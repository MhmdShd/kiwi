import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Chat } from "@/models/Chat";
import OpenAI from "openai";

function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.KIMI_API_KEY || "",
    baseURL: "https://api.moonshot.ai/v1",
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message, image, fileId, fileName, model: requestedModel } = await req.json();
  if (!message && !image && !fileId) return NextResponse.json({ error: "Message required" }, { status: 400 });

  const ALLOWED_MODELS = new Set([
    "kimi-k3",
    "kimi-k3.1-pro",
    "kimi-k2.6",
  ]);
  const selectedModel = ALLOWED_MODELS.has(requestedModel) ? requestedModel : null;

  await connectDB();
  const chat = await Chat.findOne({ _id: id, userId: (session.user as any).id });
  if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userContent = message || "";
  chat.messages.push({
    role: "user",
    content: userContent,
    imageUrl: image || undefined,
    fileId: fileId || undefined,
    fileName: fileName || undefined,
    createdAt: new Date(),
  });
  if (chat.title === "New Chat" && chat.messages.length <= 2) {
    chat.title = (message || fileName || "Image").slice(0, 40) || "New Chat";
  }
  try {
    await chat.save();
  } catch (err: any) {
    console.error("[messages] save error", err?.message, err?.errors);
    return NextResponse.json({ error: err?.message || "Save failed" }, { status: 500 });
  }
  console.log("[messages] saved, hasImage=", !!image, "fileId=", !!fileId);

  // Resolve fileId → extracted text for any messages that need it
  const openai = getOpenAI();
  const fileContentCache: Record<string, string> = {};
  for (const m of chat.messages) {
    if (m.fileId && !fileContentCache[m.fileId]) {
      try {
        const response = await openai.files.content(m.fileId);
        fileContentCache[m.fileId] = await response.text();
      } catch {
        fileContentCache[m.fileId] = `[File: ${m.fileName || m.fileId}]`;
      }
    }
  }

  const messagesForAPI = chat.messages.map((m: any) => {
    if (m.imageUrl) {
      return {
        role: m.role as "user" | "assistant",
        content: [
          { type: "image_url", image_url: { url: m.imageUrl } },
          ...(m.content ? [{ type: "text", text: m.content }] : []),
        ],
      };
    }
    if (m.fileId) {
      const fileText = fileContentCache[m.fileId] || `[File: ${m.fileName || m.fileId}]`;
      const combined = m.content
        ? `${fileText}\n\n${m.content}`
        : fileText;
      return { role: m.role as "user" | "assistant", content: combined };
    }
    return { role: m.role as "user" | "assistant", content: m.content };
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const hasImage = chat.messages.some((m: any) => m.imageUrl);
        const modelToUse = selectedModel || "kimi-k3";
        const completion = await openai.chat.completions.create({
          model: modelToUse,
          messages: messagesForAPI,
          stream: true,
        });

        let fullContent = "";
        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            fullContent += content;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
          }
        }

        chat.messages.push({ role: "assistant", content: fullContent, createdAt: new Date() });
        chat.updatedAt = new Date();
        await chat.save();

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
      } catch (err: any) {
        console.error("[messages] completion error", err?.status, err?.message, err?.response?.data || err);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
