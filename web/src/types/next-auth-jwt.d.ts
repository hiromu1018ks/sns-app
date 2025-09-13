import 'next-auth/jwt';

declare module 'next-auth/jwt' {
  interface JWT {
    idToken?: string;
    provider?: 'google' | 'apple';
  }
}
