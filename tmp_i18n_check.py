import re
import glob
html_files = glob.glob('frontend/*.html') + glob.glob('frontend/**/*.html', recursive=True)
text = open('frontend/js/lang/tr.js', 'r', encoding='utf-8').read()
keys = set(re.findall(r"\s*([a-z0-9_']+):\s*['\"]", text))
missing = {}
for f in html_files:
    data = open(f, 'r', encoding='utf-8').read()
    for key in re.findall(r'data-i18n=["\']([^"\']+)["\']', data):
        if key not in keys:
            missing.setdefault(key, []).append(f)
    for key in re.findall(r'data-i18n-placeholder=["\']([^"\']+)["\']', data):
        if key not in keys:
            missing.setdefault(key, []).append(f)
    for key in re.findall(r'data-i18n-title=["\']([^"\']+)["\']', data):
        if key not in keys:
            missing.setdefault(key, []).append(f)
    for key in re.findall(r'data-i18n-alt=["\']([^"\']+)["\']', data):
        if key not in keys:
            missing.setdefault(key, []).append(f)
print('missing_keys:', len(missing))
for k,v in list(missing.items())[:100]:
    print(k, v[:5])
raw = []
for f in html_files:
    data = open(f, 'r', encoding='utf-8').read()
    for m in re.finditer(r'>([^<>]+)<', data):
        txt = m.group(1).strip()
        if txt and re.search(r'[A-Za-z]{4,}', txt) and 'data-i18n' not in data[max(0, m.start()-100):m.end()+100]:
            if not re.search(r'^[\s\d\W]+$', txt) and not re.search(r'[ğüşöçıİĞÜŞÖÇ]', txt):
                raw.append((f, txt))
print('raw count:', len(raw))
for item in raw[:80]:
    print(item)