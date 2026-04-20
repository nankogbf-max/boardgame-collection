export async function onRequestGet(context) {
  const id = new URL(context.request.url).searchParams.get('id');
  if (!id || !/^\d+$/.test(id)) {
    return new Response(JSON.stringify({ error: 'Invalid BGG ID' }), { status: 400 });
  }

  const token = context.env.BGG_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ error: 'BGG_TOKEN not set' }), { status: 500 });
  }

  try {
    const res = await fetch(`https://boardgamegeek.com/xmlapi2/thing?id=${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'NankoBoardGameList/1.0',
      },
    });
    const xml = await res.text();
    const match = xml.match(/<thumbnail>\s*([\s\S]*?)\s*<\/thumbnail>/);
    let url = (match && match[1]) ? match[1].trim() : '';
    if (url.startsWith('//')) url = 'https:' + url;
    return new Response(JSON.stringify({ url }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'fetch failed' }), { status: 502 });
  }
}
