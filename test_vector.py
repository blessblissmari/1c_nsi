# -*- coding: utf-8 -*-
import requests
import sys
sys.stdout.reconfigure(encoding='utf-8')

# Test vector search endpoint
try:
    # Test classify via web - should use vector store
    r = requests.post('http://localhost:8000/api/v1/hierarchy/classify-models-via-web', timeout=60)
    print('Status:', r.status_code)
    print('Response:', r.text[:500] if r.text else 'empty')
except Exception as e:
    print('Error:', e)