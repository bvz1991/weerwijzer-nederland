export default async function handler(request, response) {
  try {
    const feed = await fetch("https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-netherlands", {
      headers: {"User-Agent": "WeerWijzer-Nederland/2.0"}
    });
    if (!feed.ok) throw new Error(`Meteoalarm ${feed.status}`);
    const xml = await feed.text();
    response.setHeader("Content-Type", "application/atom+xml; charset=utf-8");
    response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    response.status(200).send(xml);
  } catch {
    response.status(503).json({error:"Waarschuwingen tijdelijk niet beschikbaar"});
  }
}
