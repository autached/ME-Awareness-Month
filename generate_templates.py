#!/usr/bin/env python3
"""
generate_templates.py

Scans two folders (cover and poster template images) and creates
JSON files listing all image filenames.

This is useful for static sites like GitHub Pages, where you can't
load folder contents dynamically in the browser. The JSON files are
used by your JavaScript to generate image thumbnail selections.

Folders scanned:
- assets/templates/profile  →  outputs cover.json
- assets/templates/poster   →  outputs poster.json
- assets/templates/poster-aug -> outputs poster-aug.json
"""

import os
import json

def get_image_files(folder):
    """
    Returns a case-insensitively sorted list of image files
    (png, jpg, jpeg, webp) in the given folder.
    """
    image_filenames = [
        f for f in os.listdir(folder)
        if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))
    ]
    # Sort by the lowercase version of the filename
    return sorted(image_filenames, key=str.lower)

def save_json(data, path):
    """
    Saves a Python list as pretty-printed JSON to the given path.
    """
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
    print(f"✅ Saved {len(data)} items to {path}")

def main():
    # Define where the images are
    cover_dir = 'assets/templates/profile'
    poster_dir = 'assets/templates/poster'
    poster_aug_dir ='assets/templates/poster-aug' #new

    # Define where the output JSON files should go
    cover_json_path = 'assets/templates/cover.json'
    poster_json_path = 'assets/templates/poster.json'
    poster_aug_json_path = 'assets/templates/poster-aug.json' #new

    # Get image filenames
    cover_files = get_image_files(cover_dir)
    poster_files = get_image_files(poster_dir)
    poster_aug_files = get_image_files(poster_aug_dir) #new

    # Save them to JSON
    save_json(cover_files, cover_json_path)
    save_json(poster_files, poster_json_path)
    save_json(poster-aug_files, poster_aug_json_path) #new

# This runs when you execute the file: python generate_templates.py
if __name__ == "__main__":
    main()
