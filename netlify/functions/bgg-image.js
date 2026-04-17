/**
 * Netlify Function: bgg-image
 * BGG XML API2 へサーバーサイドでリクエストし画像URLを返す。
 * Node.js 標準 https モジュールのみ使用。
 */

'use strict';

const https = require('https');

function httpsGet(url, headers, redirectCount) {
  redirectCount = redirectCount || 0;
  return new Promise(function(resolve, reject) {
    var req = https.get(url, { headers: headers, timeout: 20000 }, function(res) {
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

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  var params = event.queryStringParameters || {};
  var id = params.id;
  if (!id || !/^\d+$/.test(id)) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid BGG ID' }) };
  }

  var token = process.env.BGG_TOKEN;
  if (!token) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'BGG_TOKEN not set' }) };
  }

  var bggUrl = 'https://boardgamegeek.com/xmlapi2/thing?id=' + id;
  var reqHeaders = {
    'Authorization': 'Bearer ' + token,
    'User-Agent': 'NankoBoardGameList/1.0',
  };

  // 失敗時に1回リトライ
  var xml;
  try {
    xml = await httpsGet(bggUrl, reqHeaders);
  } catch (e) {
    try {
      await new Promise(function(r) { setTimeout(r, 2000); });
      xml = await httpsGet(bggUrl, reqHeaders);
    } catch (e2) {
      return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: 'BGG fetch failed' }) };
    }
  }

  var match = xml.match(/<thumbnail>\s*([\s\S]*?)\s*<\/thumbnail>/);
  var imageUrl = (match && match[1]) ? match[1].trim() : '';
  if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;

  return {
    statusCode: 200,
    headers: Object.assign({}, corsHeaders, {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    }),
    body: JSON.stringify({ url: imageUrl }),
  };
};
