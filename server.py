#!/usr/bin/env python3
# ══════════════════════════════════════════════════════════════
#  AAA-RNS — local web server.  Developed by Seung Ho Jung, v2.0
#
#  Console output is English-only ASCII on purpose: terminal fonts
#  and code pages cannot be relied on for CJK text. The application
#  UI itself is multilingual (Korean / English / Japanese).
#
#  Why a server is needed:
#  Browsers grant folder access (File System Access API) only over
#  https or localhost. Opening index.html directly as file:// cannot
#  connect a shared folder. This server binds to this machine only.
#
#  Why Cache-Control: no-store:
#  It prevents the browser from running a stale cached copy after the
#  program files are updated. (Reproduced during verification — ES
#  modules are cached particularly aggressively.)
# ══════════════════════════════════════════════════════════════
import http.server
import os
import socketserver
import sys
import webbrowser

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # keep the console quiet


class Server(socketserver.TCPServer):
    allow_reuse_address = True


if __name__ == '__main__':
    url = f'http://localhost:{PORT}'
    print()
    print('  +----------------------------------------------------+')
    print('  |  AAA-RNS  Research Notebook Automation System       |')
    print('  |  v2.0  -  Developed by Seung Ho Jung                |')
    print('  +----------------------------------------------------+')
    print(f'  Folder : {ROOT}')
    print(f'  Address: {url}')
    print()
    print('  * Keep this window open. Closing it shuts the system down.')
    print('  * Shared-folder connection works in Chrome / Edge only.')
    print('  * Language (Korean / English / Japanese) is selected in the app.')
    print()
    # The launcher script already opened a browser (and picks Chrome/Edge,
    # which the folder-access feature requires), so do not open a second one.
    if not os.environ.get('AAARNS_NO_OPEN'):
        try:
            webbrowser.open(url)
        except Exception:
            pass
    try:
        with Server(('127.0.0.1', PORT), Handler) as httpd:
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                print('\n  Shutting down.')
    except OSError as e:
        print(f'  [X] Cannot open port {PORT}: {e}')
        print('      Another instance may already be running.')
        sys.exit(1)
