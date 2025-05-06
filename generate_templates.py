# generate_templates.py
import os
import json

def get_image_files(folder):
    return sorted([
        f for f in os.listdir(folder)
        if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))
    ])

def save_json(data, path):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
    print(f"✅ Saved {len(data)} items to {path}")

def main():
    cover_dir = 'assets/templates/profile'
    poster_dir = 'assets/templates/poster'
    
    cover_json_path = 'assets/templates/cover.json'
    poster_json_path = 'assets/templates/poster.json'

    cover_files = get_image_files(cover_dir)
    poster_files = get_image_files(poster_dir)

    save_json(cover_files, cover_json_path)
    save_json(poster_files, poster_json_path)

if __name__ == "__main__":
    main()
