#!/usr/bin/env python3
"""
Fetch all video URLs from a YouTube channel.

Usage:
    python scripts/fetch_youtube_channel.py https://www.youtube.com/@italiasquisita/videos

This will print all video URLs, which you can redirect to a file:
    python scripts/fetch_youtube_channel.py https://www.youtube.com/@italiasquisita/videos >> seed_data/italiasquisita/links.txt
"""

import subprocess
import sys


def fetch_channel_videos(channel_url: str, limit: int = None) -> list[str]:
    """
    Fetch video URLs from a YouTube channel using yt-dlp.
    """
    cmd = [
        'yt-dlp',
        '--flat-playlist',
        '--get-url',
        channel_url
    ]

    if limit:
        cmd.extend(['--playlist-end', str(limit)])

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        print(f"Error: {result.stderr}", file=sys.stderr)
        sys.exit(1)

    urls = [url.strip() for url in result.stdout.strip().split('\n') if url.strip()]
    return urls


def main():
    if len(sys.argv) < 2:
        print("Usage: python fetch_youtube_channel.py <channel_url> [--limit N]")
        print("Example: python fetch_youtube_channel.py https://www.youtube.com/@italiasquisita/videos")
        sys.exit(1)

    channel_url = sys.argv[1]
    limit = None

    if '--limit' in sys.argv:
        limit_idx = sys.argv.index('--limit')
        if limit_idx + 1 < len(sys.argv):
            limit = int(sys.argv[limit_idx + 1])

    print(f"Fetching videos from {channel_url}...", file=sys.stderr)

    urls = fetch_channel_videos(channel_url, limit)

    print(f"Found {len(urls)} videos", file=sys.stderr)

    # Print URLs to stdout (so they can be redirected)
    for url in urls:
        print(url)


if __name__ == '__main__':
    main()
