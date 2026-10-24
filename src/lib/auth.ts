import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectDB } from "./db";
import { User } from "@/models/User";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
      },
      async authorize(credentials) {
        const username = credentials?.username?.trim().toLowerCase();
        if (!username) return null;
        await connectDB();
        const user = await User.findOneAndUpdate(
          { username },
          { $setOnInsert: { username } },
          { upsert: true, new: true }
        ).lean();
        return { id: user._id.toString(), name: user.username };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token?.id) (session.user as any).id = token.id;
      return session;
    },
  },
};
