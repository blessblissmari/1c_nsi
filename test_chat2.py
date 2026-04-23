# -*- coding: utf-8 -*-
import requests
import sys
sys.stdout.reconfigure(encoding='utf-8')

# Test with a Russian message
payload = {"message": "Привет, кто ты?"}
try:
    r = requests.post('http://localhost:8000/api/v1/chat', json=payload, timeout=30)
    print('Status:', r.status_code)
    print('Response:', r.text)
except Exception as e:
    print('Error:', e)