/**
 * Netlify Function: bgg-image
 * ─────────────────────────────────────────────
 * BGG XML API2 へサーバーサイドでリクエストし、
 * ゲームのサムネイル画像URLを返すプロキシ関数。
 *
 * ★ アクセストークンの設定方法 ★
 * Netlify ダッシュボード →「Site configuration」→「Environment variables」で
 *   Key  : BGG_TOKEN
 *   Value: （BGGから取得したトークン文字列）
 * を追加してください。コード内にトークンを直接書く必要はありません。
 *
 * 呼び出し例:
 *   GET /.netlify/functions/bgg-image?id=120677
 *   → { "url": "https://cf.geekdo-images.com/..." }
 *
 * レート制限対策:
 *   - Netlify CDNキャッシュ: Cache-Control max-age=86400 (24時間)
 *   - BGGへのリクエストは1件ずつ。同時呼び出しはクライアント側キューで制御済み。
 */

exports.handler = async (event) => {
  // CORS: このサイト専用に限定
  const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

  const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // プリフライトリクエスト対応
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  const id = event.queryStringParameters?.id;
  if (!id || !/^\d+$/.test(id)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Invalid or missing BGG ID' }),
    };
  }

  const token = process.env.BGG_TOKEN;
  if (!token) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'BGG_TOKEN is not configured' }),
    };
  }

  // BGG公式ドキュメント: www.なしのドメインを使用
  const bggUrl = `https://boardgamegeek.com/xmlapi2/thing?id=${id}`;

  try {
    const response = await fetch(bggUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'NankoBoardGameList/1.0',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: corsHeaders,
        body: JSON.stringify({ error: `BGG returned ${response.status}` }),
      };
    }

    const xml = await response.text();

    // <thumbnail> タグからURLを抽出
    const match = xml.match(/<thumbnail>\s*(.*?)\s*<\/thumbnail>/);
    if (!match) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ url: '' }),
      };
    }

    let imageUrl = match[1].trim();
    // プロトコルが省略されている場合は補完
    if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        // Netlify CDNに24時間キャッシュさせる → BGGへの再リクエストを防ぐ
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
      body: JSON.stringify({ url: imageUrl }),
    };

  } catch (err) {
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    return {
      statusCode: isTimeout ? 504 : 502,
      headers: corsHeaders,
      body: JSON.stringify({ error: isTimeout ? 'BGG request timed out' : 'Failed to fetch from BGG' }),
    };
  }
};
