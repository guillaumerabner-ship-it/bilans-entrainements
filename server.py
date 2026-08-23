#!/usr/bin/env python3
"""Serveur local de l'application et relais sécurisé vers Google Apps Script."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

HOST = "127.0.0.1"
PORT = 8000
APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxdazdZ5MnK2pbkBjAJkSMROPU3ZPVy0u4wU1WNk0eIuRtiJUNInEMgz5ke_TVxru_8/exec"


class TrainingHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/api/shared"):
            query = urlsplit(self.path).query
            self.proxy(Request(f"{APPS_SCRIPT_URL}?{query}", headers={"Cache-Control": "no-cache"}))
            return
        super().do_GET()

    def do_POST(self):
        if self.path != "/api/shared":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length)
        request = Request(APPS_SCRIPT_URL, data=body, method="POST", headers={"Content-Type": "text/plain;charset=utf-8"})
        self.proxy(request)

    def proxy(self, request):
        try:
            with urlopen(request, timeout=60) as response:
                payload = response.read()
                self.send_response(response.status)
                self.send_header("Content-Type", response.headers.get("Content-Type", "application/json"))
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
        except HTTPError as error:
            payload = error.read()
            self.send_response(error.code)
            self.send_header("Content-Type", error.headers.get("Content-Type", "application/json"))
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        except Exception as error:
            payload = ('{"ok":false,"error":"Relais Google indisponible."}').encode("utf-8")
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            print(f"Relais Google : {error}")


if __name__ == "__main__":
    print(f"Bilans d'entraînements : http://localhost:{PORT}")
    ThreadingHTTPServer((HOST, PORT), TrainingHandler).serve_forever()
