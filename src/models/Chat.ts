import mongoose, { Schema, model, models } from "mongoose";
import { encrypt, decrypt } from "@/lib/crypto";

const enc: any = { set: encrypt, get: decrypt };

export interface IMessage {
  _id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  fileId?: string;
  fileName?: string;
  createdAt: Date;
}

export interface IChat {
  _id: string;
  title: string;
  userId: string;
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>({
  role: { type: String, enum: ["user", "assistant"], required: true },
  content: { type: String, default: "", ...enc },
  imageUrl: { type: String, ...enc },
  fileId: { type: String },
  fileName: { type: String, ...enc },
  createdAt: { type: Date, default: Date.now },
}, { toJSON: { getters: true }, toObject: { getters: true } });

const ChatSchema = new Schema<IChat>({
  title: { type: String, default: "New Chat", ...enc },
  userId: { type: String, required: true, index: true },
  messages: { type: [MessageSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { toJSON: { getters: true }, toObject: { getters: true } });

export const Chat = models.Chat || model<IChat>("Chat", ChatSchema);
