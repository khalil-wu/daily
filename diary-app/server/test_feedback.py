import json
import re
import tempfile
import threading
import unittest
import uuid
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
from feedback import FeedbackStore, make_handler


class FeedbackTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.store = FeedbackStore(Path(self.directory.name) / 'feedback.db')

    def tearDown(self):
        self.directory.cleanup()

    def payload(self, message='反馈测试，不含私人日记'):
        return {'id': str(uuid.uuid4()), 'message': message, 'version': 'test', 'platform': 'web'}

    def test_durable_receipt_and_retry(self):
        payload = self.payload()
        self.assertEqual(self.store.submit(payload, 'client')[0], 201)
        reopened = FeedbackStore(self.store.path)
        self.assertEqual(reopened.submit(payload, 'client'), (200, {'id': payload['id'], 'received': True}))
        self.assertEqual(reopened.submit({**payload, 'message': 'different'}, 'client')[0], 409)
        with reopened.connect() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM feedback').fetchone()[0], 1)

    def test_limits_reject_without_storing(self):
        for value in [[], {}, self.payload(''), self.payload('长' * 4001), {**self.payload(), 'version': []}]:
            self.assertEqual(self.store.submit(value, 'client')[0], 400)
        for i in range(5):
            self.assertEqual(self.store.submit(self.payload(), 'client', now=10000 + i)[0], 201)
        self.assertEqual(self.store.submit(self.payload(), 'client', now=10100)[0], 429)
        self.assertEqual(self.store.submit(self.payload(), 'other', now=10100)[0], 201)

    def test_http_origin_validation_and_no_public_inbox(self):
        server = ThreadingHTTPServer(('127.0.0.1', 0), make_handler(self.store, {'http://localhost'}))
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        try:
            for method, path, body, headers, expected in [
                ('GET', '/api/feedback', None, {}, 404),
                ('GET', '/api/feedback/health', None, {}, 200),
                ('POST', '/api/feedback', json.dumps(self.payload()), {'Content-Type': 'application/json', 'Origin': 'https://other.invalid'}, 403),
                ('POST', '/api/feedback', json.dumps(self.payload()), {'Content-Type': 'text/plain'}, 415),
                ('POST', '/api/feedback', '{bad', {'Content-Type': 'application/json'}, 400),
                ('POST', '/api/feedback', json.dumps(self.payload()), {'Content-Type': 'application/json', 'Origin': 'http://localhost'}, 201),
            ]:
                connection = HTTPConnection('127.0.0.1', server.server_port)
                connection.request(method, path, body=body, headers=headers)
                response = connection.getresponse()
                self.assertEqual(response.status, expected)
                self.assertEqual(response.getheader('Cache-Control'), 'no-store')
                response.read()
                connection.close()
        finally:
            server.shutdown()
            server.server_close()
            worker.join()


class GateTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.store = FeedbackStore(Path(self.directory.name) / 'feedback.db')
        self.answers = {}

    def tearDown(self):
        self.directory.cleanup()

    def render_spy(self, answer):
        self.answers['last'] = answer
        return '<svg></svg>'

    def solve(self, client='client', now=10000):
        import feedback
        with patch.object(feedback, 'render_captcha_svg', side_effect=self.render_spy):
            status, issued = self.store.issue_captcha(client, now)
        self.assertEqual(status, 200)
        status, minted = self.store.verify_captcha({'id': issued['id'], 'answer': self.answers['last']}, client, now)
        self.assertEqual(status, 200)
        return issued, minted['ticket']

    def test_captcha_issue_verify_and_single_use_ticket(self):
        _, ticket = self.solve()
        self.assertTrue(self.store.consume_ticket(ticket, 'client', 10100))
        self.assertFalse(self.store.consume_ticket(ticket, 'client', 10101))
        # Ticket from another client must not verify.
        _, foreign = self.solve(client='other')
        self.assertFalse(self.store.consume_ticket(foreign, 'client', 10102))
        # Expired tickets are rejected.
        _, stale = self.solve(now=20000)
        self.assertFalse(self.store.consume_ticket(stale, 'client', 20000 + 200))

    def test_wrong_answer_and_attempt_cap(self):
        status, issued = self.store.issue_captcha('client', 10000)
        for _ in range(5):
            self.assertEqual(self.store.verify_captcha({'id': issued['id'], 'answer': 'ZZZZ'}, 'client', 10000)[0], 400)
        # CAPTCHA_MAX_ATTEMPTS exhausted: id is gone.
        self.assertEqual(self.store.verify_captcha({'id': issued['id'], 'answer': 'ZZZZ'}, 'client', 10000)[0], 400)
        with self.store.connect() as db:
            self.assertIsNone(db.execute('SELECT id FROM captcha WHERE id=?', (issued['id'],)).fetchone())

    def test_captcha_issue_rate_limit(self):
        for i in range(20):
            self.assertEqual(self.store.issue_captcha('client', 10000 + i)[0], 200)
        self.assertEqual(self.store.issue_captcha('client', 11000)[0], 429)

    def test_send_limits(self):
        for i in range(5):
            self.assertIsNone(self.store.allow_send('client', 'a@x.com', now=10000 + i))
        self.assertEqual(self.store.allow_send('client', 'a@x.com', now=10010)[0], 429)
        self.assertIsNone(self.store.allow_send('client', 'b@x.com', now=10010))
        # 6 sends so far for this client; the per-client daily cap is 20.
        for i in range(14):
            self.assertIsNone(self.store.allow_send('client', f'c{i}@x.com', now=10020 + i))
        self.assertEqual(self.store.allow_send('client', 'new@x.com', now=10050)[0], 429)

    def test_http_gate_flow(self):
        server = ThreadingHTTPServer(('127.0.0.1', 0), make_handler(self.store, {'http://localhost'}))
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        try:
            # Ungated send is rejected before touching the network.
            connection = HTTPConnection('127.0.0.1', server.server_port)
            connection.request('POST', '/cb/auth/v1/verification?client_id=x', body='{"email":"a@x.com"}', headers={'Content-Type': 'application/json'})
            response = connection.getresponse()
            self.assertEqual(response.status, 401)
            response.read()
            connection.close()

            # Solve captcha over HTTP, then relay succeeds with the ticket.
            connection = HTTPConnection('127.0.0.1', server.server_port)
            connection.request('GET', '/api/captcha')
            issued = json.loads(connection.getresponse().read())
            connection.close()
            self.assertIn('<svg', issued['svg'])
            glyphs = re.findall(r'<text x="(\d+)"[^>]*font-size="2\d"[^>]*>([A-Z0-9])</text>', issued['svg'])
            self.assertEqual(len(glyphs), 4)
            answer = ''.join(ch for _, ch in sorted(glyphs, key=lambda g: int(g[0])))
            connection = HTTPConnection('127.0.0.1', server.server_port)
            connection.request('POST', '/api/captcha/verify', body=json.dumps({'id': issued['id'], 'answer': answer}), headers={'Content-Type': 'application/json'})
            ticket = json.loads(connection.getresponse().read())['ticket']
            connection.close()

            import feedback
            with patch.object(feedback, 'forward_verification', return_value=(200, 'application/json', b'{"ok":true}')):
                connection = HTTPConnection('127.0.0.1', server.server_port)
                connection.request('POST', f'/cb/auth/v1/verification?client_id=x&jt={ticket}', body='{"email":"a@x.com"}', headers={'Content-Type': 'application/json'})
                response = connection.getresponse()
                self.assertEqual(response.status, 200)
                self.assertEqual(json.loads(response.read()), {'ok': True})
                connection.close()
                # The same ticket cannot be reused.
                connection = HTTPConnection('127.0.0.1', server.server_port)
                connection.request('POST', f'/cb/auth/v1/verification?client_id=x&jt={ticket}', body='{"email":"a@x.com"}', headers={'Content-Type': 'application/json'})
                self.assertEqual(connection.getresponse().status, 401)
                connection.close()
        finally:
            server.shutdown()
            server.server_close()
            worker.join()


if __name__ == '__main__':
    unittest.main()
