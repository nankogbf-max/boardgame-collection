exports.handler = async (event) => {
  const id = event.queryStringParameters.id;
  const token = process.env.BGG_TOKEN;
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No ID' }) };

  try {
    // Node.js 18以降標準の fetch を使用
    const res = await fetch(`https://boardgamegeek.com/xmlapi2/thing?id=${id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const xml = await res.text();
    const match = xml.match(/<thumbnail>(.*?)<\/thumbnail>/);
    const url = match ? match[1].replace('//', 'https://') : '';

    return { statusCode: 200, headers, body: JSON.stringify({ url }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
