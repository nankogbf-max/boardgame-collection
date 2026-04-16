/**
 * Netlify Function: bgg-image
 *
 * BGG XML API2 へサーバーサイドでリクエストし、
 * ゲームのサムネイル画像URLを JSON で返すプロキシ関数。
 *
 * Node.js 標準の https モジュールのみ使用 → どのバージョンでも動作します。
 *
 * 呼び出し: GET /.netlify/functions/bgg-image?id=120677
 * 返却:     { "url": "https://cf.geekdo-images.com/..." }
 *
 * 環境変数 BGG_TOKEN に BGG アクセストークンを設定してください。
 */

'use strict';

const https = require('https');

// BGGへhttpsリクエストを送り、レスポンス本文を文字列で返すPromise
function httpsGet(url, headers, redirectCount) {
  redirectCount = redirectCount || 0;
  return new Promise(function(resolve, reject) {
    var req = https.get(url, { headers: headers, timeout: 10000 }, function(res) {
      // リダイレクト追従（最大2回）
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location && redirectCount < 2) {
        return httpsGet(res.headers.location, headers, redirectCount + 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        var err = new Error('HTTP ' + res.statusCode);
        err.statusCode = res.statusCode;
        return reject(err);
      }
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end',  function()  { resolve(Buffer.concat(chunks).toString('utf8')); });
      res.on('error', reject);
    });
    req.on('timeout', function() {
      req.destroy();
      var e = new Error('timeout'); e.isTimeout = true; reject(e);
    });
    req.on('error', reject);
  });
}

exports.handler = async function(event) {
  var corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // プリフライト
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  // BGG IDバリデーション
  var params = event.queryStringParameters || {};
  var id = params.id;
  if (!id || !/^\d+$/.test(id)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Invalid or missing BGG ID' }),
    };
  }

  // トークン確認
  var token = process.env.BGG_TOKEN;
  if (!token) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'BGG_TOKEN is not set in environment variables' }),
    };
  }

  // BGG公式: www.なしのドメインを使うこと
  var bggUrl = 'https://boardgamegeek.com/xmlapi2/thing?id=' + id;

  try {
    var xml = await httpsGet(bggUrl, {
      'Authorization': 'Bearer ' + token,
      'User-Agent': 'NankoBoardGameList/1.0',
    });

    // <thumbnail>タグを抽出
    var match = xml.match(/<thumbnail>\s*([\s\S]*?)\s*<\/thumbnail>/);
    var imageUrl = (match && match[1]) ? match[1].trim() : '';
    if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;

    return {
      statusCode: 200,
      headers: Object.assign({}, corsHeaders, {
        'Content-Type': 'application/json',
        // Netlify CDNに24時間キャッシュ → BGGへの再リクエストを大幅削減
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      }),
      body: JSON.stringify({ url: imageUrl }),
    };

  } catch (err) {
    var isTimeout = err.isTimeout || err.code === 'ECONNRESET';
    return {
      statusCode: isTimeout ? 504 : (err.statusCode || 502),
      headers: corsHeaders,
      body: JSON.stringify({ error: isTimeout ? 'BGG request timed out' : ('BGG error: ' + err.message) }),
    };
  }
};
