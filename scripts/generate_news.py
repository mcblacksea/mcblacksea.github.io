import json
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from datetime import datetime, timezone
from pathlib import Path

FEEDS = [
    {"source": "OpenAI News", "url": "https://openai.com/news/rss.xml", "category": "AI"},
    {"source": "GitHub Blog", "url": "https://github.blog/feed/", "category": "Software"},
    {"source": "MIT Technology Review", "url": "https://www.technologyreview.com/feed/", "category": "AI"},
    {"source": "InfoQ", "url": "https://feed.infoq.com/", "category": "Software"}
]

OUTPUT = Path(__file__).resolve().parents[1] / 'data' / 'news.json'


def fetch_xml(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read()


def text(el, tag_name):
    found = el.find(tag_name)
    return found.text.strip() if found is not None and found.text else ""


def parse_date(value: str) -> str:
    if not value:
        return datetime.now(timezone.utc).isoformat()
    try:
        return parsedate_to_datetime(value).astimezone(timezone.utc).isoformat()
    except Exception:
        try:
            return datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(timezone.utc).isoformat()
        except Exception:
            return datetime.now(timezone.utc).isoformat()


def parse_rss(xml_bytes: bytes, source: str, category: str):
    root = ET.fromstring(xml_bytes)
    items = []
    channel = root.find('channel')
    if channel is not None:
        rss_items = channel.findall('item')
        for item in rss_items[:8]:
            items.append({
                'source': source,
                'title': text(item, 'title'),
                'link': text(item, 'link'),
                'published': parse_date(text(item, 'pubDate')),
                'category': category,
                'summary': (text(item, 'description') or '')[:280]
            })
        return items

    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    for entry in root.findall('atom:entry', ns)[:8]:
        link_el = entry.find('atom:link', ns)
        items.append({
            'source': source,
            'title': text(entry, '{http://www.w3.org/2005/Atom}title'),
            'link': link_el.attrib.get('href', '') if link_el is not None else '',
            'published': parse_date(text(entry, '{http://www.w3.org/2005/Atom}updated')),
            'category': category,
            'summary': (text(entry, '{http://www.w3.org/2005/Atom}summary') or '')[:280]
        })
    return items


def main():
    all_items = []
    for feed in FEEDS:
        try:
            xml = fetch_xml(feed['url'])
            all_items.extend(parse_rss(xml, feed['source'], feed['category']))
        except Exception as exc:
            print(f"Failed to fetch {feed['source']}: {exc}")

    all_items = [item for item in all_items if item['title'] and item['link']]
    all_items.sort(key=lambda x: x['published'], reverse=True)

    payload = {
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'items': all_items[:40]
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"Wrote {len(payload['items'])} items to {OUTPUT}")


if __name__ == '__main__':
    main()
