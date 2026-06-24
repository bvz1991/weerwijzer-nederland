from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent
FEED = "https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-netherlands"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self.path.rstrip("/") == "/api/alerts":
            try:
                request = Request(FEED, headers={"User-Agent": "WeerWijzer-Nederland/2.0"})
                with urlopen(request, timeout=12) as response:
                    content = response.read()
                self.send_response(200)
                self.send_header("Content-Type", "application/atom+xml; charset=utf-8")
                self.send_header("Cache-Control", "public, max-age=300")
                self.end_headers()
                self.wfile.write(content)
            except Exception:
                self.send_error(503, "Waarschuwingen tijdelijk niet beschikbaar")
            return
        super().do_GET()


if __name__ == "__main__":
    print("WeerWijzer draait op http://127.0.0.1:4173")
    ThreadingHTTPServer(("127.0.0.1", 4173), Handler).serve_forever()
