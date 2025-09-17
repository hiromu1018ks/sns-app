'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * APIのベースURL。
 * 環境変数が未設定の場合はローカルのデフォルトURLを使用します。
 */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

/**
 * 認証ブートストラップページ。
 * サインイン状態を監視し、バックエンドとトークン連携を行います。
 *
 * @return ページコンポーネント
 */
export default function Page() {
  // セッション情報とロード状態を取得
  const { data: session, status } = useSession();
  // ルーターを取得
  const router = useRouter();
  // 進行状況のメッセージ
  const [statusMessage, setStatusMessage] = useState('サインイン情報を確認しています...');
  // エラーメッセージ
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // セッション取得中は処理しない
    if (status === 'loading') return;

    // 未認証ならサインインを開始
    if (status === 'unauthenticated') {
      void signIn();
      return;
    }

    /**
     * バックエンドと連携してブートストラップを実行します。
     * セッションのIDトークンをAPIへ送信し、Cookie/アクセストークンを確立します。
     */
    const run = async () => {
      // 状態メッセージを更新
      setStatusMessage('APIとセッションを接続しています...');
      // セッションからIDトークンとプロバイダを取得
      const idToken = session?.idToken;
      const provider = session?.provider;

      // 必須情報が無い場合は再サインイン
      if (!idToken || !provider) {
        setError('サインイン情報が見つかりません。もう一度サインインしてください。');
        await signIn();
        return;
      }

      try {
        // ブートストラップAPIを呼び出し（Cookie送信のためcredentials: include）
        const res = await fetch(`${API_BASE}/v1/auth/bootstrap`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, idToken }),
        });

        // 認証失敗時は再サインイン
        if (!res.ok) {
          if (res.status === 401) {
            setError('IDトークンの検証に失敗しました。もう一度サインインしてください。');
            await signIn();
            return;
          }

          // それ以外の失敗は詳細を付与して例外化
          let detail = '';
          try {
            const body = (await res.json()) as { error?: string };
            detail = body.error ?? '';
          } catch {
            // JSONでない場合は詳細なし
          }
          throw new Error(detail || `Unexpected status ${res.status}`);
        }

        // 成功時：レスポンスを読み取り、トップページへ遷移
        const data = (await res.json()) as { user: unknown; token: string };
        console.log('bootstrap result', data);
        setStatusMessage('完了しました。トップページへ移動します…');
        router.replace('/');
      } catch (e) {
        // 予期せぬエラーはユーザーに通知
        console.log(e);
        setError(
          'ブートストラップ中にエラーが発生しました。しばらく待ってから再試行してください。',
        );
      }
    };

    // 非同期処理を起動
    void run();
  }, [status, session, router]);

  return (
    <main className="p-8 space-y-4">
      {/* 読み込み中・処理中のステータスメッセージ */}
      {status !== 'authenticated' && !error && <p>{statusMessage}</p>}
      {status === 'authenticated' && !error && <p>{statusMessage}</p>}
      {/* エラーメッセージ表示 */}
      {error && <p className="text-red-500">{error}</p>}
      {/* 任意に別アカウントでサインイン */}
      <button onClick={() => void signIn()} className="underline text-sm">
        別のGoogleアカウントでサインインする
      </button>
    </main>
  );
}
