# -*- coding: utf-8 -*-
import requests
import sys
sys.stdout.reconfigure(encoding='utf-8')

# Test through Vite proxy (5173) which should forward to backend
payload = {"message": "Привет"}
try:
    r = requests.post('http://localhost:5173/api/v1/chat', json=payload, timeout=30)
    print('Status:', r.status_code)
    print('Response:', r.text)
except Exception as e:
    print('Error:', e)