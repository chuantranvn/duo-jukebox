import re
import json
import urllib.parse
import urllib.request
import logging

logger = logging.getLogger(__name__)

# Regular expressions for YouTube URLs
YOUTUBE_URL_PATTERNS = [
    r'(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})',
    r'(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})',
    r'(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})',
    r'(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})',
    r'(?:https?:\/\/)?(?:music\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})'
]

def extract_video_id(query: str):
    """Checks if query is a direct YouTube URL or raw 11-char ID, returns videoId or None."""
    query = query.strip()
    if len(query) == 11 and re.match(r'^[a-zA-Z0-9_-]{11}$', query):
        return query
    for pattern in YOUTUBE_URL_PATTERNS:
        match = re.search(pattern, query)
        if match:
            return match.group(1)
    return None

def search_youtube(query: str, limit: int = 15):
    """
    Search YouTube videos using lightweight web scraping of ytInitialData.
    Falls back to yt-dlp if needed.
    """
    query = query.strip()
    if not query:
        return []

    # Check if query is a direct video ID or URL
    direct_id = extract_video_id(query)
    if direct_id:
        video_info = get_video_details(direct_id)
        if video_info:
            return [video_info]

    results = []

    # Method 1: Fast direct scraping from YouTube search results
    try:
        results = _scrape_youtube_search(query, limit)
        if results:
            return results
    except Exception as e:
        logger.warning(f"Direct scraping failed: {e}")

    # Method 2: Fallback to yt-dlp if installed and scraping failed
    try:
        results = _ytdlp_search(query, limit)
        if results:
            return results
    except Exception as e:
        logger.warning(f"yt-dlp search failed: {e}")

    return results

def _scrape_youtube_search(query: str, limit: int = 15):
    encoded_query = urllib.parse.quote_plus(query)
    url = f"https://www.youtube.com/results?search_query={encoded_query}&hl=vi&gl=VN"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
    
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=7) as response:
        html = response.read().decode('utf-8', errors='ignore')

    # Look for ytInitialData JSON in HTML
    pattern = r'var ytInitialData\s*=\s*({.+?});\s*<\/script>'
    match = re.search(pattern, html)
    if not match:
        # Alternative pattern: window["ytInitialData"] = {...};
        pattern = r'window\["ytInitialData"\]\s*=\s*({.+?});'
        match = re.search(pattern, html)

    if not match:
        return []

    json_str = match.group(1)
    data = json.loads(json_str)

    items = []
    try:
        contents = data['contents']['twoColumnSearchResultsRenderer']['primaryContents']['sectionListRenderer']['contents']
        for section in contents:
            item_section = section.get('itemSectionRenderer', {})
            for item in item_section.get('contents', []):
                if 'videoRenderer' in item:
                    vr = item['videoRenderer']
                    video_id = vr.get('videoId')
                    if not video_id:
                        continue

                    # Title
                    title = ""
                    if 'title' in vr and 'runs' in vr['title'] and vr['title']['runs']:
                        title = vr['title']['runs'][0].get('text', '')
                    elif 'title' in vr and 'simpleText' in vr['title']:
                        title = vr['title']['simpleText']

                    # Channel / Artist
                    channel = ""
                    if 'ownerText' in vr and 'runs' in vr['ownerText'] and vr['ownerText']['runs']:
                        channel = vr['ownerText']['runs'][0].get('text', '')
                    elif 'longBylineText' in vr and 'runs' in vr['longBylineText'] and vr['longBylineText']['runs']:
                        channel = vr['longBylineText']['runs'][0].get('text', '')

                    # Duration
                    duration_text = "N/A"
                    duration_seconds = 0
                    if 'lengthText' in vr and 'simpleText' in vr['lengthText']:
                        duration_text = vr['lengthText']['simpleText']
                        duration_seconds = _parse_duration(duration_text)

                    # Thumbnail
                    thumbnail = f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg"
                    if 'thumbnail' in vr and 'thumbnails' in vr['thumbnail'] and vr['thumbnail']['thumbnails']:
                        thumbnail = vr['thumbnail']['thumbnails'][-1].get('url', thumbnail)

                    items.append({
                        "id": video_id,
                        "title": title,
                        "artist": channel,
                        "duration": duration_text,
                        "duration_seconds": duration_seconds,
                        "thumbnail": thumbnail,
                        "url": f"https://www.youtube.com/watch?v={video_id}",
                        "source": "youtube"
                    })

                    if len(items) >= limit:
                        return items
    except Exception as e:
        logger.error(f"Error parsing ytInitialData: {e}")

    return items

def _ytdlp_search(query: str, limit: int = 15):
    try:
        import yt_dlp
        ydl_opts = {
            'quiet': True,
            'extract_flat': 'in_playlist',
            'skip_download': True,
            'default_search': f'ytsearch{limit}',
            'no_warnings': True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"ytsearch{limit}:{query}", download=False)
            items = []
            if 'entries' in info:
                for entry in info['entries']:
                    if not entry:
                        continue
                    video_id = entry.get('id')
                    dur_secs = entry.get('duration') or 0
                    items.append({
                        "id": video_id,
                        "title": entry.get('title', 'Unknown Title'),
                        "artist": entry.get('uploader') or entry.get('channel', 'YouTube'),
                        "duration": _format_duration(dur_secs),
                        "duration_seconds": dur_secs,
                        "thumbnail": entry.get('thumbnail') or f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg",
                        "url": f"https://www.youtube.com/watch?v={video_id}",
                        "source": "youtube"
                    })
            return items
    except Exception as e:
        logger.error(f"yt-dlp exception: {e}")
        return []

def get_video_details(video_id: str):
    """Fetch quick details for a specific video ID using oEmbed."""
    try:
        oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        req = urllib.request.Request(oembed_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return {
                "id": video_id,
                "title": data.get("title", f"Video {video_id}"),
                "artist": data.get("author_name", "YouTube"),
                "duration": "YouTube",
                "duration_seconds": 0,
                "thumbnail": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
                "url": f"https://www.youtube.com/watch?v={video_id}",
                "source": "youtube"
            }
    except Exception as e:
        return {
            "id": video_id,
            "title": f"YouTube Video ({video_id})",
            "artist": "YouTube",
            "duration": "YouTube",
            "duration_seconds": 0,
            "thumbnail": f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg",
            "url": f"https://www.youtube.com/watch?v={video_id}",
            "source": "youtube"
        }

def _parse_duration(text: str) -> int:
    parts = text.split(':')
    try:
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        elif len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    except ValueError:
        pass
    return 0

def _format_duration(seconds: int) -> str:
    if not seconds:
        return "--:--"
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    if h > 0:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"
