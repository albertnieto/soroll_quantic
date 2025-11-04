#!/usr/bin/env python3
import http.server
import socketserver
import json
import subprocess
import os

PORT = 8000

class QuantumHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/api/circuit'):
            circuit_name = 'bell_state'
            if '?circuit=' in self.path:
                circuit_name = self.path.split('?circuit=')[1]
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            result = subprocess.run(['python3', f'circuits/{circuit_name}.py'], 
                                  capture_output=True, text=True)
            self.wfile.write(result.stdout.encode())
        elif self.path.startswith('/circuits/circuit_diagram.png'):
            if not os.path.exists('circuits/circuit_diagram.png'):
                subprocess.run(['python3', 'circuits/plot_circuit.py'])
            
            if os.path.exists('circuits/circuit_diagram.png'):
                self.send_response(200)
                self.send_header('Content-type', 'image/png')
                self.end_headers()
                with open('circuits/circuit_diagram.png', 'rb') as f:
                    self.wfile.write(f.read())
            else:
                self.send_error(404)
        else:
            super().do_GET()

with socketserver.TCPServer(("", PORT), QuantumHandler) as httpd:
    print(f"Server running at http://localhost:{PORT}/")
    print("Install dependencies: pip3 install pennylane matplotlib")
    httpd.serve_forever()
