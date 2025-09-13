import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

/**
 * NextAuthの設定とエクスポート。
 * Google認証プロバイダを利用し、JWTセッション戦略を採用します。
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: { strategy: 'jwt' },
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  callbacks: {
    /**
     * JWTコールバック。
     * アカウント情報にIDトークンが含まれていればJWTトークンに格納します。
     */
    async jwt({ token, account }) {
      if (account?.id_token) {
        token.idToken = account.id_token;
        token.provider = account.provider as 'google' | 'apple';
      }
      return token;
    },
    /**
     * セッションコールバック。
     * JWTトークンからIDトークンとプロバイダ情報をセッションに追加します。
     */
    async session({ session, token }) {
      if (token.idToken) session.idToken = token.idToken;
      if (token.provider) session.provider = token.provider;
      return session;
    },
  },
});

// HTTPメソッドハンドラのエクスポート
export const { GET, POST } = handlers;
