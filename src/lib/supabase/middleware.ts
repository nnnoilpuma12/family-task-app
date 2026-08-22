import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // JWT 検証はローカルで完結させる。getUser() は毎リクエスト Auth サーバへ往復し、
  // その往復がそのまま HTML の TTFB に直列で乗る（PWA のコールドスタートでは
  // 白画面の時間そのもの）。getClaims() はプロジェクトの署名キーが非対称（ECC/RSA）
  // なら WebCrypto でローカル検証し、JWKS はキャッシュされるため往復が消える。
  // 対称鍵のままなら getUser() 相当の往復にフォールバックするので、
  // 署名キーを移行していない環境でも挙動は変わらない（安全側に倒れる）。
  // getSession() と違い JWT の署名を検証するため、認証判定に使ってよい。
  const { data: claimsData } = await supabase.auth.getClaims();
  const isAuthenticated = !!claimsData?.claims.sub;

  const publicPaths = ["/login", "/signup", "/auth/callback", "/forgot-password"];
  const isPublicPath = publicPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (!isAuthenticated && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isAuthenticated && isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
