# -*- coding: utf-8 -*-
import requests
import sys
sys.stdout.reconfigure(encoding='utf-8')

try:
    r = requests.post('http://localhost:8000/api/v1/chat', json={'message': 'test'})
    print('Status:', r.status_code)
    print('Response:', r.text)
except Exception as e:
    print('Error:', e)