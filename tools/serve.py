#!/usr/bin/env python3
"""Dev server for the arcade.

Identical to `python3 -m http.server` except it sends `Cache-Control: no-store`.
Without that header the browser guesses a freshness lifetime for every file and
happily runs a half-hour-old module graph, which looks exactly like a bug in
your code. Production is GitHub Pages plus the service worker, so this only
affects local development.

    python3 tools/serve.py [port]
"""
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "application/javascript",
        ".mjs": "application/javascript",
        ".webmanifest": "application/manifest+json",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Pragma", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        if "GET" in (args[0] if args else ""):
            return                                  # quiet; errors still print
        super().log_message(fmt, *args)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    handler = partial(NoCacheHandler, directory=ROOT)
    print(f"arcade dev server → http://localhost:{port}  (no-store)")
    ThreadingHTTPServer(("", port), handler).serve_forever()
