#!/usr/bin/env python3
"""
Generate line_mapping.json and line_details.json from lines file

Usage:
    python scripts/update_line_data.py
"""

import json
import os
from collections import Counter

# Paths
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LINES_FILE = os.path.join(ROOT_DIR, 'lines')
MAPPING_OUTPUT = os.path.join(ROOT_DIR, 'src', 'client', 'line_mapping.json')
DETAILS_OUTPUT = os.path.join(ROOT_DIR, 'src', 'client', 'line_details.json')

# Cyrillic to Latin mapping for Serbian
CYRILLIC_TO_LATIN = {
    'А': 'A', 'а': 'a', 'В': 'B', 'в': 'b', 'Г': 'G', 'г': 'g',
    'Д': 'D', 'д': 'd', 'Е': 'E', 'е': 'e', 'З': 'Z', 'з': 'z',
    'И': 'I', 'и': 'i', 'Й': 'J', 'й': 'j', 'К': 'K', 'к': 'k',
    'Л': 'L', 'л': 'l', 'М': 'M', 'м': 'm', 'Н': 'H', 'н': 'h',
    'О': 'O', 'о': 'o', 'П': 'P', 'п': 'p', 'Р': 'P', 'р': 'r',
    'С': 'C', 'с': 'c', 'Т': 'T', 'т': 't', 'У': 'U', 'у': 'u',
    'Ф': 'F', 'ф': 'f', 'Х': 'H', 'х': 'h', 'Ц': 'C', 'ц': 'c',
    'Ч': 'C', 'ч': 'c', 'Ш': 'S', 'ш': 's', 'Ђ': 'Dj', 'ђ': 'dj',
    'Ж': 'Z', 'ж': 'z', 'Ћ': 'C', 'ћ': 'c',
}


def parse_streets(streets_str):
    """Parse street list and return all streets"""
    if not streets_str:
        return None
    streets = [s.strip() for s in streets_str.split(' - ')]
    return [s for s in streets if s]


def create_latin_variant(code):
    """Create Latin variant of line code"""
    latin_code = code
    for cyr, lat in CYRILLIC_TO_LATIN.items():
        latin_code = latin_code.replace(cyr, lat)
    return latin_code


def load_lines():
    """Load and parse lines file"""
    if not os.path.exists(LINES_FILE):
        print(f'Error: {LINES_FILE} not found!')
        print('Please place the lines file in the project root directory.')
        return None

    with open(LINES_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def generate_mapping(data):
    """Generate line number to kod_linije mapping"""
    mapping = {}

    for line in data['linije']:
        code = line.get('prikazan_kod_linije', '')
        kod = line.get('kod_linije')

        if not code or not kod:
            continue

        # Add original code (Cyrillic)
        mapping[code] = kod

        # Create and add Latin variant
        latin_code = create_latin_variant(code)
        if latin_code != code:
            mapping[latin_code] = kod

    return mapping


def generate_details(data):
    """Generate detailed line information"""
    details = {}

    for line in data['linije']:
        code = line.get('prikazan_kod_linije', '')
        kod = line.get('kod_linije')

        if not code or not kod:
            continue

        # Parse streets from first version
        streets_a = None
        streets_b = None

        if line.get('verzije') and len(line.get('verzije', [])) > 0:
            verzija = line['verzije'][0]
            streets_a = parse_streets(verzija.get('spisak_ulica_smer_a', ''))
            streets_b = parse_streets(verzija.get('spisak_ulica_smer_b', ''))

        line_info = {
            'kod': kod,
            'type': line.get('tip_linije', ''),
            'category': line.get('kategorija_linije', ''),
            'streetsA': streets_a,
            'streetsB': streets_b,
        }

        # Add original code (Cyrillic)
        details[code] = line_info

        # Create and add Latin variant
        latin_code = create_latin_variant(code)
        if latin_code != code:
            details[latin_code] = line_info

    return details


def save_json(data, filepath):
    """Save JSON to file"""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def print_statistics(mapping, details):
    """Print generation statistics"""
    print('\n=== Statistics ===')
    print(f'Total line codes in mapping: {len(mapping)}')
    print(f'Total lines with details: {len(details)}')

    # Count lines with streets
    with_streets = sum(1 for d in details.values() if d.get('streetsA'))
    total_streets = sum(len(d.get('streetsA') or []) for d in details.values())
    print(f'Lines with street lists: {with_streets}')
    print(f'Total streets across all lines: {total_streets}')

    if with_streets > 0:
        avg_streets = total_streets / with_streets
        print(f'Average streets per line: {avg_streets:.1f}')

    # Category distribution
    categories = Counter(d.get('category', '') for d in details.values() if d.get('category'))
    print(f'\nCategories: {len(categories)}')
    for cat, count in categories.most_common(5):
        print(f'  {cat!r:15} : {count:3} lines')


def main():
    print('Loading lines file...')
    data = load_lines()

    if not data:
        return 1

    print(f'Loaded {len(data["linije"])} lines')

    # Generate mapping
    print('\nGenerating line_mapping.json...')
    mapping = generate_mapping(data)
    save_json(mapping, MAPPING_OUTPUT)
    print(f'Saved {len(mapping)} entries to {MAPPING_OUTPUT}')

    # Generate details
    print('\nGenerating line_details.json...')
    details = generate_details(data)
    save_json(details, DETAILS_OUTPUT)
    print(f'Saved {len(details)} entries to {DETAILS_OUTPUT}')

    # Print statistics
    print_statistics(mapping, details)

    print('\n=== Done! ===')
    return 0


if __name__ == '__main__':
    exit(main())
