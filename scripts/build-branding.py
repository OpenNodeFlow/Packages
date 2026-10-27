"""Rebuild original package artwork with Pillow; never downloads provider logos."""
import hashlib
import json
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DEFAULT = {'onf.core', 'onf.runtime', 'onf.types', 'onf.utilities', 'onf.logic'}
FONT = Path('C:/Windows/Fonts/segoeuib.ttf')
def font(size):
    return ImageFont.truetype(str(FONT) if FONT.exists() else 'DejaVuSans-Bold.ttf', size)

families = {}
for entry in json.loads((ROOT / 'onf-packages.json').read_text())['packages']:
    families[entry['id']] = entry
for package_id, entry in families.items():
    if not re.fullmatch(r'packages/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+\.json', entry['path']):
        raise ValueError('Unsafe package artwork path')
    folder = ROOT / Path(entry['path']).parent
    if folder.is_symlink() or folder.parent.is_symlink() or not folder.resolve().is_relative_to((ROOT / 'packages').resolve()):
        raise ValueError('Package artwork path contains a link or escapes the repository')
    folder.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256(package_id.encode()).digest()
    accent = (180 + digest[0] % 60, 135 + digest[1] % 80, 100 + digest[2] % 90)
    name = entry['name'].replace('OpenNodeFlow ', '')
    initials = ''.join(part[0] for part in name.replace('-', ' ').split())[:2].upper()
    image = Image.new('RGB', (192, 192), '#222225')
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((16, 16, 176, 176), radius=36, outline=accent, width=4)
    draw.line((36, 142, 62, 142, 62, 156, 144, 156), fill=accent, width=3)
    draw.ellipse((29, 135, 43, 149), fill=accent)
    draw.text((96, 88), initials, fill=accent, font=font(64), anchor='mm')
    image.save(folder / 'logo.png', optimize=True)
    banner = Image.new('RGB', (1120, 360), '#19191c')
    draw = ImageDraw.Draw(banner)
    for x in range(0, 1120, 32):
        for y in range(0, 360, 32):
            draw.ellipse((x, y, x + 2, y + 2), fill='#303035')
    for index, y in enumerate((65, 165, 265)):
        x = 760 + (index % 2) * 90
        draw.line((660, y, x, y, x, y + 40, 1120, y + 40), fill=accent, width=3)
        draw.rounded_rectangle((x - 24, y - 24, x + 24, y + 24), radius=10, fill='#252529', outline=accent, width=3)
    label_font = font(52)
    if draw.textlength(name, font=label_font) > 640:
        label_font = font(40)
    draw.text((54, 115), name, font=label_font, fill='#f1f1f3')
    draw.text((56, 196), 'OPENNODEFLOW  /  ' + ('FOUNDATION' if package_id in DEFAULT else 'INTEGRATION'), font=font(19), fill=accent)
    banner.save(folder / 'banner.png', optimize=True)
    description = entry['description']
    config = {'schemaVersion': 1, 'summary': description[:180], 'description': description,
              'website': 'https://github.com/OpenNodeFlow/Packages',
              'category': 'Foundations' if package_id in DEFAULT else 'Integrations',
              'tags': ['default', name.lower().replace(' ', '-')[:24]] if package_id in DEFAULT else ['integration', name.lower().replace(' ', '-')[:24]],
              'defaultPackage': package_id in DEFAULT, 'logo': 'logo.png', 'banner': 'banner.png'}
    (folder / 'onf-package.json').write_text(json.dumps(config, indent=2) + '\n', encoding='utf8', newline='\n')
print(f'Created original artwork and metadata for {len(families)} package families.')
