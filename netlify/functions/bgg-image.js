const fetch = require('node-fetch');

exports.handler = async (event) => {
  const id = event.queryStringParameters.id;
  const token = process.env.BGG_TOKEN;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (!id) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing ID' }) };
  }

  try {
    const response = await fetch(`https://boardgamegeek.com/xmlapi2/thing?id=${id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const xml = await response.text();
    const match = xml.match(/<thumbnail>(.*?)<\/thumbnail>/);
    const imageUrl = match ? match[1].replace('//', 'https://') : '';

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ url: imageUrl })
    };
  } catch (err) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
  }
};
