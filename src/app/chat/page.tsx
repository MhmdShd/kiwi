"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { MessageBubble } from "@/components/chat/MessageBubble";

interface ChatItem {
  _id: string;
  title: string;
  updatedAt: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  fileName?: string;
}

function bucketChats(chats: ChatItem[]) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const buckets: Record<string, ChatItem[]> = {
    Today: [],
    Yesterday: [],
    "Previous 7 days": [],
    Older: [],
  };
  for (const c of chats) {
    const age = now - new Date(c.updatedAt).getTime();
    if (age < day) buckets.Today.push(c);
    else if (age < 2 * day) buckets.Yesterday.push(c);
    else if (age < 7 * day) buckets["Previous 7 days"].push(c);
    else buckets.Older.push(c);
  }
  return buckets;
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (session) fetchChats();
  }, [session]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  async function fetchChats() {
    const res = await fetch("/api/chats");
    if (res.ok) {
      const data = await res.json();
      setChats(data);
    }
  }

  async function createChat() {
    const res = await fetch("/api/chats", { method: "POST" });
    if (res.ok) {
      const chat = await res.json();
      setChats((prev) => [chat, ...prev]);
      setActiveChat(chat._id);
      setMessages([]);
    }
  }

  async function loadChat(id: string) {
    const res = await fetch(`/api/chats/${id}`);
    if (res.ok) {
      const chat = await res.json();
      setActiveChat(id);
      setMessages(
        chat.messages.map((m: any) => ({
          role: m.role,
          content: m.content,
          imageUrl: m.imageUrl,
          fileName: m.fileName,
        }))
      );
    }
  }

  async function deleteChat(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/chats/${id}`, { method: "DELETE" });
    setChats((prev) => prev.filter((c) => c._id !== id));
    if (activeChat === id) {
      setActiveChat(null);
      setMessages([]);
    }
  }

  function clearFile() {
    setImageData(null);
    setFileId(null);
    setFileName(null);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    clearFile();

    if (file.type.startsWith("image/")) {
      if (file.size > 4 * 1024 * 1024) {
        alert("Image must be under 4MB");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => setImageData(reader.result as string);
      reader.readAsDataURL(file);
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      alert("File must be under 50MB");
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Upload failed");
        return;
      }
      const data = await res.json();
      setFileId(data.fileId);
      setFileName(data.fileName);
    } finally {
      setUploading(false);
    }
  }

  async function sendMessage(e?: React.FormEvent) {
    e?.preventDefault();
    if ((!input.trim() && !imageData && !fileId) || !activeChat || loading) return;

    const userMsg = input.trim();
    const currentImage = imageData;
    const currentFileId = fileId;
    const currentFileName = fileName;
    setInput("");
    clearFile();
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: userMsg,
        imageUrl: currentImage || undefined,
        ...(currentFileName && !currentImage ? { fileName: currentFileName } : {}),
      },
    ]);
    setLoading(true);

    const res = await fetch(`/api/chats/${activeChat}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: userMsg,
        image: currentImage,
        fileId: currentFileId,
        fileName: currentFileName,
        model: "kimi-k3",
      }),
    });

    if (!res.ok || !res.body) {
      setLoading(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let assistantContent = "";

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              assistantContent += parsed.content;
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { role: "assistant", content: assistantContent };
                return next;
              });
            }
            if (parsed.done) {
              setLoading(false);
              fetchChats();
              return;
            }
            if (parsed.error) {
              setLoading(false);
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = {
                  role: "assistant",
                  content: "Error: " + parsed.error,
                };
                return next;
              });
              return;
            }
          } catch {}
        }
      }
    }

    setLoading(false);
    fetchChats();
  }

  function onComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const filteredChats = useMemo(() => {
    if (!search.trim()) return chats;
    const q = search.toLowerCase();
    return chats.filter((c) => c.title.toLowerCase().includes(q));
  }, [chats, search]);

  const buckets = useMemo(() => bucketChats(filteredChats), [filteredChats]);
  const activeChatTitle = chats.find((c) => c._id === activeChat)?.title;

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <span className="typing-dot w-2 h-2 rounded-full bg-primary" />
          <span className="typing-dot w-2 h-2 rounded-full bg-primary" />
          <span className="typing-dot w-2 h-2 rounded-full bg-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen p-3 gap-3">
      {/* Sidebar */}
      {sidebarCollapsed ? (
        <aside className="glass ring-soft rounded-3xl w-16 flex flex-col items-center py-4 gap-2 shrink-0">
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition"
            title="Expand"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 3v18" />
              <path d="m14 9 3 3-3 3" />
            </svg>
          </button>
          <button
            onClick={createChat}
            className="grad-primary text-white w-10 h-10 rounded-2xl flex items-center justify-center shadow-md shadow-[oklch(0.15_0_0/0.3)] hover:opacity-95 transition"
            title="New chat"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button
            onClick={() => {
              setSidebarCollapsed(false);
              setTimeout(() => searchRef.current?.focus(), 0);
            }}
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition"
            title="Search chats"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </button>
        </aside>
      ) : (
      <aside className="glass ring-soft rounded-3xl w-72 flex flex-col overflow-hidden shrink-0">
        <div className="p-5 flex items-center gap-3">
          <div className="grad-primary w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold shadow-lg">
            K
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-semibold tracking-tight">Kiwi</div>
            <div className="text-xs text-muted-foreground truncate">
              {session?.user?.name}
            </div>
          </div>
          <button
            onClick={() => setSidebarCollapsed(true)}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition"
            title="Collapse"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 3v18" />
              <path d="m17 9-3 3 3 3" />
            </svg>
          </button>
        </div>

        <div className="px-4">
          <button
            onClick={createChat}
            className="grad-primary w-full text-white font-medium rounded-2xl py-2.5 shadow-md shadow-[oklch(0.15_0_0/0.3)] hover:opacity-95 flex items-center justify-center gap-2 transition"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New chat
          </button>
        </div>

        <div className="px-4 mt-4">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats"
              className="w-full pl-9 pr-12 py-2 rounded-xl border border-border bg-transparent text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
            />
            <span className="kbd absolute right-2 top-1/2 -translate-y-1/2">⌘K</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 mt-4 scroll-fade">
          {Object.entries(buckets).map(([label, items]) =>
            items.length === 0 ? null : (
              <div key={label} className="mb-3">
                <div className="px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                  {label}
                </div>
                <div className="space-y-0.5">
                  {items.map((chat) => {
                    const isActive = activeChat === chat._id;
                    return (
                      <div
                        key={chat._id}
                        onClick={() => loadChat(chat._id)}
                        className={`group flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer text-sm transition ${
                          isActive
                            ? "nav-active-bar bg-muted font-medium text-foreground"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        }`}
                      >
                        <span className="flex-1 truncate">{chat.title}</span>
                        <button
                          onClick={(e) => deleteChat(chat._id, e)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
                          title="Delete"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}
          {filteredChats.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              {search ? "No matches" : "No chats yet"}
            </div>
          )}
        </nav>

        <div className="p-3 border-t border-border/70">
          <div className="flex items-center gap-3 p-2 rounded-2xl hover:bg-muted/60 transition">
            <div className="grad-primary w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold">
              {(session?.user?.name || "U").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {session?.user?.name || "Account"}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                {session?.user?.name}
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition"
              title="Sign out"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
      )}

      {/* Main */}
      <main className="flex-1 flex flex-col glass ring-soft rounded-3xl overflow-hidden">
        {!activeChat ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-md">
              <div className="grad-primary w-16 h-16 rounded-3xl flex items-center justify-center text-white text-2xl font-bold shadow-lg mx-auto mb-4">
                K
              </div>
              <h1 className="text-3xl font-bold tracking-tight grad-text mb-2">
                Welcome to Kiwi
              </h1>
              <p className="text-muted-foreground text-sm mb-6">
                Pick a chat from the sidebar or start a fresh one.
              </p>
              <button
                onClick={createChat}
                className="grad-primary text-white font-medium rounded-2xl px-5 py-2.5 shadow-md shadow-[oklch(0.15_0_0/0.3)] hover:opacity-95 inline-flex items-center gap-2 transition"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Start new chat
              </button>
            </div>
          </div>
        ) : (
          <>
            <header className="px-6 py-4 flex items-center gap-3 border-b border-border/70">
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-semibold tracking-tight truncate">
                  {activeChatTitle || "Chat"}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {messages.length} {messages.length === 1 ? "message" : "messages"} · auto-saved
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-accent text-accent-foreground">
                Kiwi Auto
              </span>
            </header>

            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 py-8">
              <div className="max-w-3xl mx-auto space-y-6">
                {messages.map((msg, i) => (
                  <MessageBubble
                    key={i}
                    role={msg.role}
                    content={msg.content}
                    imageUrl={msg.imageUrl}
                    fileName={msg.fileName}
                  />
                ))}
                {loading && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex gap-3 items-end">
                    <div className="grad-primary w-9 h-9 rounded-2xl flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-md">
                      K
                    </div>
                    <div className="bg-card border border-border rounded-3xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                      <span className="typing-dot w-1.5 h-1.5 rounded-full bg-primary" />
                      <span className="typing-dot w-1.5 h-1.5 rounded-full bg-primary" />
                      <span className="typing-dot w-1.5 h-1.5 rounded-full bg-primary" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 pb-5 pt-2">
              <form onSubmit={sendMessage} className="max-w-3xl mx-auto">
                {(imageData || (fileName && !imageData)) && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {imageData && (
                      <div className="relative inline-block">
                        <img
                          src={imageData}
                          alt="preview"
                          className="h-20 rounded-xl border border-border object-contain"
                        />
                        <button
                          type="button"
                          onClick={clearFile}
                          className="absolute -top-2 -right-2 grad-primary text-white rounded-full w-5 h-5 flex items-center justify-center text-xs leading-none shadow"
                        >
                          ×
                        </button>
                      </div>
                    )}
                    {fileName && !imageData && (
                      <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-muted border border-border text-xs">
                        <span className="grad-primary w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-semibold">
                          FILE
                        </span>
                        <span className="truncate max-w-[180px]">{fileName}</span>
                        <button
                          type="button"
                          onClick={clearFile}
                          className="text-muted-foreground hover:text-foreground ml-1"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="glass ring-soft rounded-3xl border border-border p-2 flex items-end gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf,text/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.json,.md,.txt,.html,.htm,.xml,.yaml,.yml,.js,.jsx,.ts,.tsx,.mjs,.cjs,.py,.java,.c,.h,.cpp,.hpp,.cc,.cs,.go,.rs,.rb,.php,.swift,.kt,.kts,.scala,.sh,.bash,.zsh,.sql,.r,.lua,.dart,.vue,.svelte,.toml,.ini,.conf,.env,.log"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <button
                    type="button"
                    disabled={loading || uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 transition"
                    title="Attach"
                  >
                    {uploading ? (
                      <span className="typing-dot w-2 h-2 rounded-full bg-primary" />
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.93 8.83l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                    )}
                  </button>
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onComposerKeyDown}
                    placeholder="Message Kiwi…"
                    disabled={loading}
                    rows={1}
                    className="flex-1 resize-none py-2 px-1 text-sm leading-relaxed bg-transparent outline-none placeholder:text-muted-foreground max-h-40"
                  />
                  <button
                    type="submit"
                    disabled={loading || uploading || (!input.trim() && !imageData && !fileId)}
                    className="grad-primary text-white rounded-2xl h-10 w-10 flex items-center justify-center shadow-md shadow-[oklch(0.15_0_0/0.35)] hover:opacity-95 disabled:opacity-50 disabled:hover:opacity-50 transition"
                    title="Send"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </div>

                <div className="flex items-center justify-between mt-2 px-1">
                  <p className="text-[11px] text-muted-foreground">
                    Kiwi can make mistakes. Check important info.
                  </p>
                  <p className="text-[11px] text-muted-foreground hidden sm:block">
                    <span className="kbd">Enter</span> send · <span className="kbd">Shift</span>+
                    <span className="kbd">Enter</span> newline
                  </p>
                </div>
              </form>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
