#!/usr/bin/env python3
"""
Script để tách POSTMAN_COLLECTION.json thành các file collection riêng theo module
"""
import json
import os

# Đọc file gốc
with open('../POSTMAN_COLLECTION.json', 'r', encoding='utf-8') as f:
    main_collection = json.load(f)

# Lấy variables chung
shared_variables = main_collection.get('variable', [])

# Map tên module với tên file
module_map = {
    'Health': 'health.collection.json',
    'Auth': 'auth.collection.json',
    'Friendship': 'friendship.collection.json',
    'Post': 'post.collection.json',
    'Feed': 'feed.collection.json',
    'Reaction': 'reaction.collection.json',
    'Comment': 'comment.collection.json',
    'Chat': 'chat.collection.json',
    'Admin': 'admin.collection.json',
}

# Tách từng module
for item in main_collection.get('item', []):
    module_name = item.get('name')
    if module_name in module_map:
        # Tạo collection mới
        new_collection = {
            'info': {
                'name': f'{module_name} API',
                'description': f'{module_name} endpoints',
                'schema': main_collection['info']['schema']
            },
            'variable': shared_variables,
            'item': item.get('item', [item])  # Nếu có item con thì lấy, không thì lấy chính nó
        }
        
        # Ghi file
        filename = module_map[module_name]
        filepath = os.path.join(os.path.dirname(__file__), filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(new_collection, f, indent=2, ensure_ascii=False)
        
        print(f'Created {filename}')

print('\nAll collections created successfully!')

