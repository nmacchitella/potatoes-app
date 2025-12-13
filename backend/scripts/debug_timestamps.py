#!/usr/bin/env python3
"""Debug script to check what timestamps Gemini returns for a YouTube video."""

import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.recipe_import import (
    extract_youtube_video_id,
    get_youtube_transcript,
    get_youtube_video_info,
    parse_with_gemini,
    download_youtube_audio,
    transcribe_audio_with_gemini,
    find_linked_recipe_data,
)


async def debug_video(url: str):
    video_id = extract_youtube_video_id(url)
    print(f"Video ID: {video_id}")

    # Get video info
    print("\n=== VIDEO INFO ===")
    info = get_youtube_video_info(video_id)
    print(f"Title: {info.get('title')}")
    description = info.get('description', '')
    print(f"Description preview: {description[:500]}...")

    # Check for linked recipes
    print("\n=== LINKED RECIPES ===")
    linked_json_ld, linked_url = await find_linked_recipe_data(description)
    if linked_json_ld:
        print(f"Found linked recipe at: {linked_url}")
    else:
        print("No linked recipes found")

    # Try transcript first
    transcript = None
    try:
        print("\n=== TRANSCRIPT (first 2000 chars) ===")
        transcript, _ = get_youtube_transcript(video_id)
        print(transcript[:2000])
        print(f"\n... (total {len(transcript)} chars)")
    except ValueError as e:
        print(f"No transcript: {e}")

    # If transcript available, use it
    if transcript:
        print("\n=== GEMINI EXTRACTION (from transcript) ===")
        recipes = await parse_with_gemini(transcript, url, allow_multiple=True)
    else:
        # Fall back to audio
        print("\n=== DOWNLOADING AUDIO ===")
        audio_path = download_youtube_audio(video_id)
        print(f"Audio downloaded to: {audio_path}")

        print("\n=== GEMINI EXTRACTION (from audio) ===")
        recipes = await transcribe_audio_with_gemini(
            audio_path,
            url,
            video_description=description,
            video_title=info.get('title', ''),
            linked_recipe_json_ld=linked_json_ld,
            linked_recipe_url=linked_url
        )

    for i, recipe in enumerate(recipes):
        print(f"\nRecipe {i+1}: {recipe.title}")
        print(f"  video_start_seconds: {recipe.video_start_seconds}")
        print(f"  ingredients: {len(recipe.ingredients)}")
        print(f"  instructions: {len(recipe.instructions)}")


if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "https://www.youtube.com/watch?v=QWeGe32UBo0"
    asyncio.run(debug_video(url))
