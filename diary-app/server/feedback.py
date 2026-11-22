"""Private feedback intake + human-verification gate for the diary.

The gate issues throwaway SVG captchas; solving one mints a single-use
ticket that nginx requires before forwarding CloudBase OTP sends
(/cb/auth/v1/verification). No inbox or diary data is exposed over HTTP.
"""
from contextlib import contextmanager
import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

MAX_BODY = 20000
MAX_TEXT = 4000

# CloudBase gateway whose OTP endpoint is relayed through the captcha gate.
OTP_UPSTREAM_HOST = 'possible-wildebeest-d1br6c84180b.api.tcloudbasegateway.com'
OTP_UPSTREAM = f'https://{OTP_UPSTREAM_HOST}/auth/v1/verification'

CAPTCHA_TTL = 300
CAPTCHA_MAX_ATTEMPTS = 5
TICKET_TTL = 180
CAPTCHA_PER_HOUR = 20
SEND_PER_IDENT_DAY = 5
SEND_PER_CLIENT_DAY = 20
SEND_GLOBAL_DAY = 500

# Characters without lookalikes so users never fight 0/O or 1/I ambiguity.
CAPTCHA_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'


class FeedbackStore:
    def __init__(self, path):
        self.path = str(path)
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript("""
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS feedback (
                    id TEXT PRIMARY KEY, created_at INTEGER NOT NULL,
                    message TEXT NOT NULL, version TEXT NOT NULL, platform TEXT NOT NULL,
                    request_hash TEXT NOT NULL, client_hash TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS feedback_client_time ON feedback(client_hash, created_at);
                CREATE TABLE IF NOT EXISTS captcha (
                    id TEXT PRIMARY KEY, answer_hash TEXT NOT NULL,
                    expires INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
                    client_hash TEXT NOT NULL, created_at INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS captcha_client_time ON captcha(client_hash, created_at);
                CREATE TABLE IF NOT EXISTS ticket (
                    nonce_hash TEXT PRIMARY KEY, expires INTEGER NOT NULL,
                    client_hash TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE IF NOT EXISTS send_log (
                    created_at INTEGER NOT NULL, client_hash TEXT NOT NULL,
                    ident_hash TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS send_log_time ON send_log(created_at);
            """)
            db.execute("INSERT OR IGNORE INTO metadata VALUES ('salt', ?)", (secrets.token_hex(32),))
            db.execute("INSERT OR IGNORE INTO metadata VALUES ('gate_secret', ?)", (secrets.token_hex(32),))
            row = db.execute("SELECT key, value FROM metadata WHERE key IN ('salt','gate_secret')").fetchall()
            values = dict(row)
            self.salt = values['salt']
            self.gate_secret = bytes.fromhex(values['gate_secret'])

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        try:
            with db:
                yield db
        finally:
            db.close()

    def submit(self, value, client, now=None):
        now = int(time.time()) if now is None else now
        if not isinstance(value, dict):
            return 400, {"error": "反馈格式无效"}
        identifier, message = value.get('id'), value.get('message')
        if not isinstance(identifier, str) or not isinstance(message, str):
            return 400, {"error": "请填写反馈内容"}
        try:
            if str(uuid.UUID(identifier)) != identifier.lower():
                raise ValueError()
            identifier = str(uuid.UUID(identifier))
        except (ValueError, AttributeError):
            return 400, {"error": "反馈编号无效，请重新打开页面"}
        message = message.strip()
        if not message or len(message) > MAX_TEXT:
            return 400, {"error": "反馈内容须为 1 至 4000 字"}
        version, platform = value.get('version', ''), value.get('platform', '')
        if not isinstance(version, str) or not isinstance(platform, str) or len(version) > 40 or len(platform) > 40:
            return 400, {"error": "反馈格式无效"}
        digest = hashlib.sha256(json.dumps([message, version, platform], ensure_ascii=False).encode()).hexdigest()
        client_hash = client_hash_of(self.salt, client)
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            old = db.execute('SELECT request_hash FROM feedback WHERE id=?', (identifier,)).fetchone()
            if old:
                return (200, {"id": identifier, "received": True}) if old[0] == digest else (409, {"error": "这条反馈已提交，请重新编辑后发送"})
            recent = db.execute('SELECT COUNT(*) FROM feedback WHERE client_hash=? AND created_at>?', (client_hash, now - 3600)).fetchone()[0]
            daily = db.execute('SELECT COUNT(*) FROM feedback WHERE created_at>?', (now - 86400,)).fetchone()[0]
            if recent >= 5 or daily >= 1000:
                return 429, {"error": "提交较频繁，请稍后重试，内容仍保留在本机"}
            db.execute('INSERT INTO feedback VALUES (?, ?, ?, ?, ?, ?, ?)', (identifier, now, message, version, platform, digest, client_hash))
            db.execute('DELETE FROM feedback WHERE created_at<?', (now - 180 * 86400,))
        return 201, {"id": identifier, "received": True}

    def hashed(self, *parts):
        return hashlib.sha256((self.salt + '|'.join(parts)).encode()).hexdigest()

    # ---------- human-verification gate ----------

    def issue_captcha(self, client, now=None):
        now = int(time.time()) if now is None else now
        client_hash = client_hash_of(self.salt, client)
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            db.execute('DELETE FROM captcha WHERE created_at<?', (now - 3600,))
            recent = db.execute('SELECT COUNT(*) FROM captcha WHERE client_hash=? AND created_at>?', (client_hash, now - 3600)).fetchone()[0]
            if recent >= CAPTCHA_PER_HOUR:
                return 429, {"error": "操作过于频繁，请稍后再试"}
            answer = ''.join(secrets.choice(CAPTCHA_ALPHABET) for _ in range(4))
            cid = uuid.uuid4().hex
            db.execute('INSERT INTO captcha VALUES (?, ?, ?, 0, ?, ?)',
                       (cid, self.hashed('captcha', cid, answer), now + CAPTCHA_TTL, client_hash, now))
        return 200, {"id": cid, "svg": render_captcha_svg(answer)}

    def verify_captcha(self, value, client, now=None):
        now = int(time.time()) if now is None else now
        client_hash = client_hash_of(self.salt, client)
        cid, answer = value.get('id'), value.get('answer')
        if not isinstance(cid, str) or not isinstance(answer, str) or len(cid) > 64 or len(answer) > 16:
            return 400, {"error": "验证请求无效"}
        answer = answer.strip().upper()
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT answer_hash, expires, attempts, client_hash FROM captcha WHERE id=?', (cid,)).fetchone()
            if not row or row[1] < now:
                return 400, {"error": "图形验证码已过期，请刷新后重试"}
            db.execute('UPDATE captcha SET attempts=attempts+1 WHERE id=?', (cid,))
            if row[2] + 1 > CAPTCHA_MAX_ATTEMPTS:
                db.execute('DELETE FROM captcha WHERE id=?', (cid,))
                return 400, {"error": "尝试次数过多，请刷新验证码"}
            if not hmac.compare_digest(row[0], self.hashed('captcha', cid, answer)):
                return 400, {"error": "图形验证码不正确"}
            db.execute('DELETE FROM captcha WHERE id=?', (cid,))
            nonce = secrets.token_hex(16)
            db.execute('INSERT INTO ticket VALUES (?, ?, ?, 0)',
                       (self.hashed('ticket', nonce), now + TICKET_TTL, client_hash))
            db.execute('DELETE FROM ticket WHERE expires<?', (now,))
        return 200, {"ticket": mint_ticket(nonce, now + TICKET_TTL, client_hash, self.gate_secret)}

    def consume_ticket(self, ticket, client, now=None):
        """One-shot check for the OTP proxy: valid, unexpired, unused, same client."""
        now = int(time.time()) if now is None else now
        parsed = parse_ticket(ticket, client_hash_of(self.salt, client), self.gate_secret)
        if parsed is None or parsed[1] < now:
            return False
        nonce = parsed[0]
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            cur = db.execute('UPDATE ticket SET used=1 WHERE nonce_hash=? AND used=0 AND expires>=?', (self.hashed('ticket', nonce), now))
            return cur.rowcount == 1

    def allow_send(self, client, ident, now=None):
        now = int(time.time()) if now is None else now
        client_hash = client_hash_of(self.salt, client)
        ident_hash = self.hashed('ident', ident or '')
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            db.execute('DELETE FROM send_log WHERE created_at<?', (now - 172800,))
            per_ident = db.execute('SELECT COUNT(*) FROM send_log WHERE ident_hash=? AND created_at>?', (ident_hash, now - 86400)).fetchone()[0]
            per_client = db.execute('SELECT COUNT(*) FROM send_log WHERE client_hash=? AND created_at>?', (client_hash, now - 86400)).fetchone()[0]
            global_day = db.execute('SELECT COUNT(*) FROM send_log WHERE created_at>?', (now - 86400,)).fetchone()[0]
            if global_day >= SEND_GLOBAL_DAY:
                return 429, {"error": "发送量已达今日上限，请明天再试"}
            if per_ident >= SEND_PER_IDENT_DAY:
                return 429, {"error": "该账号今日获取验证码次数过多，请明天再试"}
            if per_client >= SEND_PER_CLIENT_DAY:
                return 429, {"error": "获取验证码过于频繁，请稍后再试"}
            db.execute('INSERT INTO send_log VALUES (?, ?, ?)', (now, client_hash, ident_hash))
        return None


def client_hash_of(salt, client):
    return hashlib.sha256((salt + client).encode()).hexdigest()


def mint_ticket(nonce, expires, client_hash, secret):
    sig = hmac.new(secret, f'{nonce}.{expires}.{client_hash}'.encode(), hashlib.sha256).digest()
    return f'{nonce}.{expires}.{base64.urlsafe_b64encode(sig).decode().rstrip("=")}'


def parse_ticket(ticket, client_hash, secret):
    if not isinstance(ticket, str):
        return None
    try:
        nonce, expires, sig = ticket.split('.')
        expected = hmac.new(secret, f'{nonce}.{expires}.{client_hash}'.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(base64.urlsafe_b64decode(sig + '=' * (-len(sig) % 4)), expected):
            return None
        return nonce, int(expires)
    except (ValueError, TypeError):
        return None


def render_captcha_svg(text):
    rnd = secrets.SystemRandom()
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="120" height="44" viewBox="0 0 120 44">']
    parts.append('<rect width="120" height="44" rx="8" fill="#f7f3ea"/>')
    for _ in range(4):
        x1, y1 = rnd.uniform(-10, 120), rnd.uniform(0, 44)
        x2, y2 = rnd.uniform(0, 130), rnd.uniform(0, 44)
        cx, cy = rnd.uniform(0, 120), rnd.uniform(-15, 60)
        color = rnd.choice(['#8a9b7e', '#b8a88a', '#7e8f9b', '#9b8a7e'])
        parts.append(f'<path d="M{x1:.0f} {y1:.0f} Q{cx:.0f} {cy:.0f} {x2:.0f} {y2:.0f}" stroke="{color}" stroke-width="1" fill="none" opacity="0.55"/>')
    for _ in range(14):
        parts.append(f'<circle cx="{rnd.uniform(4,116):.0f}" cy="{rnd.uniform(4,40):.0f}" r="{rnd.uniform(0.6,1.4):.1f}" fill="#8a9b7e" opacity="0.5"/>')
    glyphs = []
    for i, ch in enumerate(text):
        x = 16 + i * 24 + rnd.uniform(-3, 3)
        y = 29 + rnd.uniform(-3, 3)
        rot = rnd.uniform(-22, 22)
        size = rnd.uniform(21, 26)
        color = rnd.choice(['#4a5843', '#5d6e52', '#3f4d55', '#6e5d4a'])
        glyphs.append((rnd.random(), f'<text x="{x:.0f}" y="{y:.0f}" font-size="{size:.0f}" font-family="Georgia,serif" font-weight="700" fill="{color}" transform="rotate({rot:.0f} {x:.0f} {y:.0f})">{ch}</text>'))
        # Invisible decoy characters trip up scripts that scrape the markup.
        if rnd.random() < 0.8:
            dx, dy = rnd.uniform(0, 110), rnd.uniform(0, 40)
            glyphs.append((rnd.random(), f'<text x="{dx:.0f}" y="{dy:.0f}" font-size="1" fill="none" opacity="0">{secrets.choice(CAPTCHA_ALPHABET)}</text>'))
    parts.extend(g for _, g in sorted(glyphs))
    parts.append('</svg>')
    return ''.join(parts)


# Hop-by-hop and spoofable headers are dropped; the rest reach CloudBase untouched.
DROPPED_HEADERS = {'host', 'origin', 'referer', 'cookie', 'content-length', 'connection', 'keep-alive', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'expect', 'x-real-ip', 'x-forwarded-for', 'x-forwarded-proto', 'x-jide-ticket'}


def forward_verification(query, headers, body):
    """Relay a gated OTP send to CloudBase; returns (status, content_type, bytes)."""
    upstream = OTP_UPSTREAM + ('?' + query if query else '')
    req = urllib.request.Request(upstream, data=body, method='POST')
    for name, value in headers.items():
        if name.lower() not in DROPPED_HEADERS:
            req.add_header(name, value)
    req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            return res.status, res.headers.get('Content-Type', 'application/json'), res.read(1 << 16)
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get('Content-Type', 'application/json'), e.read(1 << 16)
    except (urllib.error.URLError, OSError):
        return 502, 'application/json', json.dumps({"error": {"message": "发信服务暂不可用，请稍后重试"}}).encode()


def make_handler(store, origins):
    class Handler(BaseHTTPRequestHandler):
        server_version = 'JideFeedback'

        def setup(self):
            super().setup()
            self.connection.settimeout(10)

        def log_message(self, fmt, *args):
            # Never write feedback text, request headers, or client addresses into access logs.
            pass

        def respond(self, status, value):
            data = json.dumps(value, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Content-Length', str(len(data)))
            if status == 429:
                self.send_header('Retry-After', '3600')
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            path = urllib.parse.urlsplit(self.path).path
            if path == '/api/feedback/health':
                try:
                    with store.connect() as db:
                        db.execute('SELECT 1 FROM metadata LIMIT 1').fetchone()
                    return self.respond(200, {"status": "ok", "service": "jide-feedback"})
                except sqlite3.Error:
                    return self.respond(503, {"error": "反馈暂时不可用"})
            if path == '/api/captcha':
                try:
                    client = self.headers.get('X-Real-IP', self.client_address[0])
                    status, result = store.issue_captcha(client)
                    return self.respond(status, result)
                except sqlite3.Error:
                    return self.respond(503, {"error": "验证服务暂不可用"})
            return self.respond(404, {"error": "未找到接口"})

        def do_POST(self):
            path = urllib.parse.urlsplit(self.path).path
            if path not in ('/api/feedback', '/api/captcha/verify', '/api/cb/verification', '/cb/auth/v1/verification'):
                return self.respond(404, {"error": "未找到接口"})
            origin = self.headers.get('Origin')
            if origin is not None and origin not in origins:
                return self.respond(403, {"error": "来源无效"})
            try:
                length = int(self.headers.get('Content-Length', '0'))
            except ValueError:
                return self.respond(400, {"error": "请求长度无效"})
            if length <= 0 or length > MAX_BODY:
                return self.respond(413, {"error": "内容过长"})
            raw = self.rfile.read(length)
            try:
                value = json.loads(raw)
            except (ValueError, UnicodeError):
                value = None
            client = self.headers.get('X-Real-IP', self.client_address[0])
            if path == '/api/feedback':
                if self.headers.get_content_type() != 'application/json':
                    return self.respond(415, {"error": "请使用 JSON 格式"})
                if value is None:
                    return self.respond(400, {"error": "反馈格式无效"})
                try:
                    status, result = store.submit(value, client)
                    self.respond(status, result)
                except (sqlite3.Error, OSError):
                    self.respond(503, {"error": "暂时无法保存反馈，请稍后重试"})
                return
            if path == '/api/captcha/verify':
                if not isinstance(value, dict):
                    return self.respond(400, {"error": "验证请求无效"})
                try:
                    status, result = store.verify_captcha(value, client)
                    self.respond(status, result)
                except sqlite3.Error:
                    self.respond(503, {"error": "验证服务暂不可用"})
                return
            self.gate_verification(raw, value, client)

        def gate_verification(self, raw, value, client):
            query = urllib.parse.urlsplit(self.path).query
            params = urllib.parse.parse_qs(query)
            ticket = (params.pop('jt', [None])[0]) or self.headers.get('X-Jide-Ticket')
            upstream_query = urllib.parse.urlencode(params, doseq=True)
            try:
                # CloudBase 滑块风控的放行证明等价于通过人机验证。
                if 'captcha_token' in params:
                    pass
                elif not ticket or not store.consume_ticket(ticket, client):
                    return self.respond(401, {"error": {"message": "请先完成人机验证"}})
                ident = ''
                if isinstance(value, dict):
                    ident = str(value.get('email') or value.get('phone_number') or '')[:120].strip().lower()
                denied = store.allow_send(client, ident)
                if denied:
                    return self.respond(*denied)
            except sqlite3.Error:
                return self.respond(503, {"error": "验证服务暂不可用"})
            status, ctype, body = forward_verification(upstream_query, self.headers, raw)
            self.send_response(status)
            self.send_header('Content-Type', ctype)
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
    return Handler


if __name__ == '__main__':
    database = os.environ.get('JIDE_FEEDBACK_DB', '/var/lib/jide-feedback/feedback.sqlite3')
    origins = set(os.environ.get('JIDE_FEEDBACK_ORIGINS', 'http://39.105.19.77').split(','))
    server = ThreadingHTTPServer(('127.0.0.1', int(os.environ.get('JIDE_FEEDBACK_PORT', '18971'))), make_handler(FeedbackStore(database), origins))
    server.daemon_threads = True
    server.serve_forever()
