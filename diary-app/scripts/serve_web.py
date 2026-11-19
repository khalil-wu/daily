import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


class AppHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        route = unquote(urlsplit(self.path).path)
        if route == '/favicon.ico' and not (Path(self.directory) / 'favicon.ico').exists():
            self.send_response(204)
            self.end_headers()
            return
        target = Path(self.translate_path(route))
        if not target.exists() and not Path(route).suffix:
            self.path = '/index.html'
        super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        super().end_headers()

    def list_directory(self, path):
        self.send_error(404, 'No directory listing')
        return None

    def log_message(self, format, *args):
        pass


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory', type=Path, default=Path(__file__).resolve().parents[1] / 'dist')
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--open', action='store_true')
    args = parser.parse_args()
    directory = args.directory.resolve()
    if not (directory / 'index.html').is_file():
        raise SystemExit('Web export is missing. Run npm run export:web first.')
    server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(AppHandler, directory=str(directory)))
    print(f'Remember Diary: http://127.0.0.1:{args.port}', flush=True)
    if args.open:
        import webbrowser
        webbrowser.open(f'http://127.0.0.1:{args.port}')
    server.serve_forever()
