'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * 認証後にAPIから受け取るユーザー情報を表します。
 */
export type BootstrapUser = {
  /** アプリケーションユーザーの一意なID */
  id: string;
  /** メールアドレス（任意） */
  email?: string;
  /** 表示名（任意） */
  displayName?: string;
  /** ユーザー作成日時（ISO文字列） */
  createdAt: string;
};

/**
 * 認証状態を表します。
 */
type AuthState = {
  /** アクセストークン（存在しない場合はnull） */
  accessToken: string | null;
  /** 現在のユーザー（未ログイン時はnull） */
  user: BootstrapUser | null;
};

/**
 * 認証コンテキストで外部に公開する値と操作を表します。
 */
type AuthContextValue = AuthState & {
  /**
   * 認証状態を設定します。
   *
   * @param input トークンとユーザー情報
   */
  setAuthState: (input: { token: string; user: BootstrapUser }) => void;
  /**
   * 認証状態を初期化します。
   */
  clearAuthState: () => void;
};

/**
 * 認証状態の初期値です。
 */
const INITIAL_STATE: AuthState = {
  accessToken: null,
  user: null,
};

/**
 * 認証情報を提供するReactコンテキストです。
 */
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * 認証情報をアプリ全体に配布するProviderコンポーネントです。
 *
 * @param children 子要素
 * @return 認証コンテキスト付きのラッパー
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  // useStateで認証状態を管理
  const [state, setState] = useState<AuthState>(INITIAL_STATE);

  /**
   * アクセストークンとユーザー情報を一括で設定します。
   */
  const setAuthState = useCallback(({ token, user }: { token: string; user: BootstrapUser }) => {
    // 次の認証状態を反映
    setState({ accessToken: token, user });
  }, []);

  /**
   * 認証状態を初期値にリセットします。
   */
  const clearAuthState = useCallback(() => {
    // ログアウト等で状態をクリア
    setState(INITIAL_STATE);
  }, []);

  // メモ化して不要な再レンダリングを防止
  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      setAuthState,
      clearAuthState,
    }),
    [state, setAuthState, clearAuthState],
  );

  // Context Providerで下位ツリーに配布
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * 認証コンテキストを取得するカスタムフックです。
 *
 * @return 認証状態と操作群
 * @throws Provider配下以外で呼び出された場合にエラーを投げます
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
