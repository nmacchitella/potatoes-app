"""
Recipe Import Service

Imports recipes from URLs by:
1. Fetching the page content
2. Attempting to extract JSON-LD schema.org/Recipe data
3. Falling back to LLM (Gemini) parsing if no structured data found

Also supports YouTube videos:
- First tries to extract transcript from YouTube captions
- Falls back to audio transcription with Gemini if captions unavailable
- Parses recipes from video content (can handle multiple recipes per video)
"""

import json
import re
import httpx
import subprocess
import tempfile
import os
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Tuple
from dataclasses import dataclass, asdict
from bs4 import BeautifulSoup
import google.generativeai as genai
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound

from config import settings, logger
from database import SessionLocal
from models import URLCheck


@dataclass
class ImportedIngredient:
    name: str
    quantity: Optional[float] = None
    quantity_max: Optional[float] = None
    unit: Optional[str] = None
    preparation: Optional[str] = None
    is_optional: bool = False
    notes: Optional[str] = None


@dataclass
class ImportedInstruction:
    step_number: int
    instruction_text: str
    duration_minutes: Optional[int] = None


@dataclass
class ImportedRecipe:
    title: str
    description: Optional[str] = None
    ingredients: List[ImportedIngredient] = None
    instructions: List[ImportedInstruction] = None
    yield_quantity: Optional[float] = None  # None means not specified
    yield_unit: Optional[str] = None
    prep_time_minutes: Optional[int] = None
    cook_time_minutes: Optional[int] = None
    difficulty: Optional[str] = None
    source_url: Optional[str] = None
    source_name: Optional[str] = None
    cover_image_url: Optional[str] = None
    tags: List[str] = None  # Suggested tags based on content
    video_start_seconds: Optional[int] = None  # For YouTube: when this recipe starts in the video

    def __post_init__(self):
        if self.ingredients is None:
            self.ingredients = []
        if self.instructions is None:
            self.instructions = []
        if self.tags is None:
            self.tags = []


async def fetch_url_content(url: str) -> tuple[str, str]:
    """
    Fetch URL content and return (html, final_url).
    Follows redirects and handles common issues.
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
    }

    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        return response.text, str(response.url)


def extract_json_ld_recipe(html: str) -> Optional[dict]:
    """
    Extract schema.org/Recipe from JSON-LD script tags.
    Returns the first Recipe found, or None.
    """
    soup = BeautifulSoup(html, 'lxml')

    # Find all JSON-LD scripts
    for script in soup.find_all('script', type='application/ld+json'):
        try:
            data = json.loads(script.string)

            # Handle array of schemas
            if isinstance(data, list):
                for item in data:
                    if item.get('@type') == 'Recipe':
                        return item
                    # Check @graph for Recipe
                    if '@graph' in item:
                        for graph_item in item['@graph']:
                            if graph_item.get('@type') == 'Recipe':
                                return graph_item

            # Single object
            elif isinstance(data, dict):
                if data.get('@type') == 'Recipe':
                    return data
                # Check @graph
                if '@graph' in data:
                    for item in data['@graph']:
                        if item.get('@type') == 'Recipe':
                            return item

        except (json.JSONDecodeError, TypeError):
            continue

    return None


def parse_iso_duration(duration: str) -> Optional[int]:
    """
    Parse ISO 8601 duration (PT30M, PT1H30M) to minutes.
    """
    if not duration:
        return None

    match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?', duration)
    if match:
        hours = int(match.group(1) or 0)
        minutes = int(match.group(2) or 0)
        return hours * 60 + minutes

    return None


def parse_yield(recipe_yield) -> tuple[float, str]:
    """
    Parse recipe yield to (quantity, unit).
    Handles formats like "4 servings", "4", ["4 servings"], etc.
    """
    if isinstance(recipe_yield, list):
        recipe_yield = recipe_yield[0] if recipe_yield else "4 servings"

    if isinstance(recipe_yield, (int, float)):
        return float(recipe_yield), "servings"

    if isinstance(recipe_yield, str):
        # Try to extract number and unit
        match = re.match(r'(\d+(?:\.\d+)?)\s*(.*)', recipe_yield.strip())
        if match:
            qty = float(match.group(1))
            unit = match.group(2).strip() or "servings"
            return qty, unit

    return 4.0, "servings"


def parse_schema_ingredient(ingredient) -> ImportedIngredient:
    """
    Parse a schema.org ingredient (usually just a string).
    Uses our ingredient parser for detailed extraction.
    """
    from services.ingredient_parser import parse_ingredient_line

    if isinstance(ingredient, str):
        parsed = parse_ingredient_line(ingredient)
        return ImportedIngredient(
            name=parsed.name,
            quantity=parsed.quantity,
            quantity_max=parsed.quantity_max,
            unit=parsed.unit,
            preparation=parsed.preparation,
            notes=parsed.notes,
        )

    # If it's already structured (rare)
    if isinstance(ingredient, dict):
        return ImportedIngredient(
            name=ingredient.get('name', str(ingredient)),
            quantity=ingredient.get('quantity'),
            unit=ingredient.get('unit'),
        )

    return ImportedIngredient(name=str(ingredient))


def parse_schema_instruction(instruction, index: int) -> ImportedInstruction:
    """
    Parse a schema.org HowToStep or string instruction.
    """
    if isinstance(instruction, str):
        return ImportedInstruction(
            step_number=index + 1,
            instruction_text=instruction.strip(),
        )

    if isinstance(instruction, dict):
        # HowToStep
        text = instruction.get('text', '')
        if not text:
            # Try itemListElement
            text = instruction.get('itemListElement', '')
            if isinstance(text, dict):
                text = text.get('text', '')

        return ImportedInstruction(
            step_number=index + 1,
            instruction_text=text.strip() if isinstance(text, str) else str(text),
        )

    return ImportedInstruction(
        step_number=index + 1,
        instruction_text=str(instruction),
    )


def convert_json_ld_to_recipe(data: dict, source_url: str) -> ImportedRecipe:
    """
    Convert schema.org/Recipe JSON-LD to our ImportedRecipe format.
    """
    # Parse yield
    yield_qty, yield_unit = parse_yield(data.get('recipeYield'))

    # Parse ingredients
    ingredients = []
    for ing in data.get('recipeIngredient', []):
        ingredients.append(parse_schema_ingredient(ing))

    # Parse instructions
    instructions = []
    instruction_data = data.get('recipeInstructions', [])

    # Handle HowToSection (grouped instructions)
    if instruction_data and isinstance(instruction_data[0], dict) and instruction_data[0].get('@type') == 'HowToSection':
        step_num = 0
        for section in instruction_data:
            for step in section.get('itemListElement', []):
                instructions.append(parse_schema_instruction(step, step_num))
                step_num += 1
    else:
        for idx, inst in enumerate(instruction_data):
            instructions.append(parse_schema_instruction(inst, idx))

    # Get image
    image = data.get('image')
    if isinstance(image, list):
        image = image[0] if image else None
    if isinstance(image, dict):
        image = image.get('url')

    # Extract source name from author
    author = data.get('author')
    source_name = None
    if isinstance(author, dict):
        source_name = author.get('name')
    elif isinstance(author, list) and author:
        source_name = author[0].get('name') if isinstance(author[0], dict) else str(author[0])
    elif isinstance(author, str):
        source_name = author

    return ImportedRecipe(
        title=data.get('name', 'Untitled Recipe'),
        description=data.get('description'),
        ingredients=ingredients,
        instructions=instructions,
        yield_quantity=yield_qty,
        yield_unit=yield_unit,
        prep_time_minutes=parse_iso_duration(data.get('prepTime')),
        cook_time_minutes=parse_iso_duration(data.get('cookTime')),
        source_url=source_url,
        source_name=source_name,
        cover_image_url=image,
        tags=data.get('recipeCategory', []) if isinstance(data.get('recipeCategory'), list) else [data.get('recipeCategory')] if data.get('recipeCategory') else [],
    )


def extract_page_text(html: str) -> str:
    """
    Extract readable text from HTML for LLM parsing.
    Focuses on main content areas and strips boilerplate.
    """
    soup = BeautifulSoup(html, 'lxml')

    # Remove script, style, nav, footer, aside elements
    for element in soup.find_all(['script', 'style', 'nav', 'footer', 'aside', 'header', 'iframe']):
        element.decompose()

    # Try to find main content areas
    main_content = None
    for selector in ['article', 'main', '[role="main"]', '.recipe', '.post-content', '.entry-content']:
        main_content = soup.select_one(selector)
        if main_content:
            break

    if main_content:
        text = main_content.get_text(separator='\n', strip=True)
    else:
        text = soup.get_text(separator='\n', strip=True)

    # Clean up excessive whitespace
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    return '\n'.join(lines)


# ============================================================================
# YOUTUBE SUPPORT
# ============================================================================

def is_youtube_url(url: str) -> bool:
    """Check if a URL is a YouTube video URL."""
    youtube_patterns = [
        r'(?:https?://)?(?:www\.)?youtube\.com/watch\?v=[\w-]+',
        r'(?:https?://)?(?:www\.)?youtube\.com/embed/[\w-]+',
        r'(?:https?://)?youtu\.be/[\w-]+',
        r'(?:https?://)?(?:www\.)?youtube\.com/shorts/[\w-]+',
    ]
    return any(re.match(pattern, url) for pattern in youtube_patterns)


def extract_youtube_video_id(url: str) -> Optional[str]:
    """Extract video ID from various YouTube URL formats."""
    patterns = [
        r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/|youtube\.com/shorts/)([\w-]+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def get_youtube_thumbnail_url(video_id: str) -> str:
    """Get the highest quality thumbnail URL for a YouTube video."""
    # maxresdefault is 1280x720, falls back gracefully if not available
    return f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"


def get_youtube_transcript(video_id: str) -> Tuple[str, str]:
    """
    Get transcript from a YouTube video.
    Returns (transcript_text, video_title).
    Tries English first, then falls back to any available language.
    """
    try:
        api = YouTubeTranscriptApi()
        transcript_data = None

        # Try English first
        try:
            transcript_data = api.fetch(video_id, languages=['en', 'en-US', 'en-GB'])
        except Exception:
            pass

        # If no English, try to get any available transcript
        if not transcript_data:
            try:
                available = api.list(video_id)
                # Prefer common languages that Gemini handles well
                preferred_langs = ['it', 'es', 'fr', 'de', 'pt', 'nl', 'pl', 'ru', 'ja', 'ko', 'zh']

                # Try preferred languages first
                for lang in preferred_langs:
                    for transcript in available:
                        if transcript.language_code.startswith(lang):
                            transcript_data = api.fetch(video_id, languages=[transcript.language_code])
                            break
                    if transcript_data:
                        break

                # If still nothing, just take the first available
                if not transcript_data:
                    for transcript in available:
                        transcript_data = api.fetch(video_id, languages=[transcript.language_code])
                        break
            except Exception:
                pass

        if not transcript_data:
            raise ValueError("No transcript available for this video")

        # Combine all text segments with timestamps - FetchedTranscript is iterable
        # Format: [MM:SS] text so Gemini can identify when each segment starts
        segments = []
        for entry in transcript_data:
            start_seconds = int(entry.start)
            minutes = start_seconds // 60
            seconds = start_seconds % 60
            segments.append(f"[{minutes:02d}:{seconds:02d}] {entry.text}")
        full_text = '\n'.join(segments)

        return full_text, ""

    except TranscriptsDisabled:
        raise ValueError("TRANSCRIPT_UNAVAILABLE: Captions disabled")
    except NoTranscriptFound:
        raise ValueError("TRANSCRIPT_UNAVAILABLE: No transcript found")
    except Exception as e:
        raise ValueError(f"TRANSCRIPT_UNAVAILABLE: {str(e)}")


def get_youtube_video_info(video_id: str) -> dict:
    """
    Get video metadata including title and description using yt-dlp.
    Returns dict with 'title', 'description', and 'uploader' fields.
    """
    try:
        cmd = [
            'yt-dlp',
            '--dump-json',
            '--no-download',
            '--no-playlist',
            f'https://www.youtube.com/watch?v={video_id}'
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

        if result.returncode != 0:
            logger.warning(f"yt-dlp failed to get video info: {result.stderr}")
            return {}

        data = json.loads(result.stdout)
        return {
            'title': data.get('title', ''),
            'description': data.get('description', ''),
            'uploader': data.get('uploader', ''),
            'channel': data.get('channel', ''),
        }
    except subprocess.TimeoutExpired:
        logger.warning("yt-dlp timed out getting video info")
        return {}
    except (json.JSONDecodeError, FileNotFoundError) as e:
        logger.warning(f"Failed to get video info: {e}")
        return {}


# Domains to ignore when looking for recipe URLs in video descriptions
BLOCKED_DOMAINS = {
    # Social media
    'youtube.com', 'youtu.be', 'instagram.com', 'facebook.com', 'twitter.com',
    'x.com', 'tiktok.com', 'pinterest.com', 'linkedin.com', 'threads.net',
    # Shopping/affiliate
    'amazon.com', 'amzn.to', 'amazon.it', 'amazon.co.uk', 'amazon.de',
    'ebay.com', 'etsy.com', 'shopify.com',
    # Link shorteners
    'bit.ly', 'goo.gl', 't.co', 'tinyurl.com', 'ow.ly',
    # Other non-recipe
    'patreon.com', 'ko-fi.com', 'buymeacoffee.com', 'paypal.com',
    'discord.gg', 'discord.com', 'twitch.tv', 'spotify.com',
    'apple.com', 'music.apple.com', 'podcasts.apple.com',
}


def extract_urls_from_text(text: str) -> List[str]:
    """Extract all URLs from a text string."""
    # Match http/https URLs
    url_pattern = r'https?://[^\s<>"\')\]]+[^\s<>"\')\].,;:!?]'
    urls = re.findall(url_pattern, text)
    # Clean up any trailing punctuation that might have slipped through
    cleaned = []
    for url in urls:
        # Remove trailing punctuation that's likely not part of the URL
        url = re.sub(r'[.,;:!?)]+$', '', url)
        if url:
            cleaned.append(url)
    return cleaned


def get_url_domain(url: str) -> str:
    """Extract the domain from a URL."""
    try:
        # Simple domain extraction without urllib
        match = re.match(r'https?://(?:www\.)?([^/]+)', url)
        if match:
            return match.group(1).lower()
    except Exception:
        pass
    return ''


def filter_and_prioritize_recipe_urls(urls: List[str]) -> List[str]:
    """
    Filter out blocked domains and prioritize URLs likely to contain recipes.
    Returns URLs sorted by likelihood of containing a recipe.
    """
    # Filter out blocked domains
    filtered = []
    for url in urls:
        domain = get_url_domain(url)
        # Check if domain matches any blocked domain
        is_blocked = any(
            domain == blocked or domain.endswith('.' + blocked)
            for blocked in BLOCKED_DOMAINS
        )
        if not is_blocked:
            filtered.append(url)

    # Prioritize URLs with recipe indicators in path
    def recipe_priority(url: str) -> int:
        url_lower = url.lower()
        # Highest priority: "recipe" or "recipes" in path
        if '/recipe' in url_lower or '/recipes' in url_lower:
            return 0
        # High priority: other recipe-related terms
        if any(term in url_lower for term in ['/ricetta', '/ricette', '/recette', '/rezept']):
            return 1
        # Medium priority: blog/article paths (often have recipes)
        if any(term in url_lower for term in ['/blog', '/article', '/post']):
            return 2
        # Lower priority: everything else
        return 3

    filtered.sort(key=recipe_priority)
    return filtered


async def fetch_recipe_json_ld_from_url(url: str) -> Optional[dict]:
    """
    Fetch a URL and extract JSON-LD Recipe schema if present.
    Returns the JSON-LD data dict or None if not found/failed.
    """
    try:
        html, _ = await fetch_url_content(url)
        json_ld = extract_json_ld_recipe(html)
        if json_ld:
            logger.info(f"Found JSON-LD Recipe at {url}")
            return json_ld
        else:
            logger.debug(f"No JSON-LD Recipe found at {url}")
            return None
    except Exception as e:
        logger.warning(f"Failed to fetch recipe from {url}: {e}")
        return None


# In-memory cache for URLs checked (populated from database)
_checked_urls_cache: Optional[set] = None


def get_checked_urls_without_recipes() -> set:
    """
    Load URLs that we've already checked and found to have no recipe.
    These can be skipped in future checks to save time.
    Uses database for persistent storage across sessions and production.
    """
    global _checked_urls_cache
    if _checked_urls_cache is not None:
        return _checked_urls_cache

    _checked_urls_cache = set()

    try:
        db = SessionLocal()
        try:
            # Query all URLs that don't have recipes
            results = db.query(URLCheck.url).filter(URLCheck.has_recipe == False).all()
            _checked_urls_cache = {row[0] for row in results}
            logger.info(f"Loaded {len(_checked_urls_cache)} previously checked URLs without recipes from database")
        finally:
            db.close()
    except Exception as e:
        logger.debug(f"Failed to load checked URLs from database: {e}")

    return _checked_urls_cache


def log_url_check(url: str, has_recipe: bool, error: Optional[str] = None):
    """
    Log URL check results to the database.
    This helps identify domains that should be added to the blocklist.
    """
    global _checked_urls_cache
    domain = get_url_domain(url)

    try:
        db = SessionLocal()
        try:
            # Upsert: insert or update if exists
            existing = db.query(URLCheck).filter(URLCheck.url == url).first()
            if existing:
                existing.has_recipe = has_recipe
                existing.error = error[:500] if error else None
                existing.checked_at = datetime.now()
            else:
                url_check = URLCheck(
                    url=url[:2048],
                    domain=domain[:255],
                    has_recipe=has_recipe,
                    error=error[:500] if error else None
                )
                db.add(url_check)
            db.commit()

            # Update in-memory cache
            if _checked_urls_cache is not None:
                if has_recipe:
                    _checked_urls_cache.discard(url)
                else:
                    _checked_urls_cache.add(url)
        finally:
            db.close()
    except Exception as e:
        logger.debug(f"Failed to log URL check to database: {e}")


async def find_linked_recipe_data(description: str) -> Tuple[Optional[dict], Optional[str]]:
    """
    Search for recipe URLs in a video description and fetch JSON-LD data.
    Returns (json_ld_data, source_url) or (None, None) if not found.

    Skips URLs that were previously checked and found to have no recipe.
    """
    urls = extract_urls_from_text(description)
    if not urls:
        return None, None

    prioritized = filter_and_prioritize_recipe_urls(urls)
    if not prioritized:
        logger.debug("No candidate recipe URLs found in description")
        return None, None

    # Filter out URLs we've already checked and found to have no recipe
    checked_urls = get_checked_urls_without_recipes()
    unchecked = [url for url in prioritized if url not in checked_urls]

    skipped_count = len(prioritized) - len(unchecked)
    if skipped_count > 0:
        logger.info(f"Skipping {skipped_count} previously checked URLs without recipes")

    if not unchecked:
        logger.debug("All candidate URLs were previously checked (no recipes)")
        return None, None

    logger.info(f"Found {len(unchecked)} candidate recipe URLs to check...")

    # Try top 3 unchecked URLs (in case first few fail)
    for url in unchecked[:3]:
        json_ld = await fetch_recipe_json_ld_from_url(url)
        if json_ld:
            log_url_check(url, has_recipe=True)
            return json_ld, url
        else:
            log_url_check(url, has_recipe=False)

    return None, None


def download_youtube_audio(video_id: str) -> str:
    """
    Download audio from a YouTube video using yt-dlp.
    Returns the path to the downloaded audio file.
    """
    # Create a temporary directory for the audio file
    temp_dir = tempfile.mkdtemp()
    output_path = os.path.join(temp_dir, f"{video_id}.m4a")

    try:
        # Use yt-dlp to download audio only in m4a format (good quality, small size)
        cmd = [
            'yt-dlp',
            '-f', 'bestaudio[ext=m4a]/bestaudio',
            '-o', output_path,
            '--no-playlist',
            '--quiet',
            f'https://www.youtube.com/watch?v={video_id}'
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

        if result.returncode != 0:
            raise ValueError(f"yt-dlp failed: {result.stderr}")

        # Check if file was created (might have different extension)
        if os.path.exists(output_path):
            return output_path

        # Check for other audio formats
        for ext in ['.webm', '.opus', '.mp3', '.wav']:
            alt_path = os.path.join(temp_dir, f"{video_id}{ext}")
            if os.path.exists(alt_path):
                return alt_path

        # List what was actually downloaded
        files = os.listdir(temp_dir)
        if files:
            return os.path.join(temp_dir, files[0])

        raise ValueError("No audio file was downloaded")

    except subprocess.TimeoutExpired:
        raise ValueError("Audio download timed out")
    except FileNotFoundError:
        raise ValueError("yt-dlp not installed. Install with: pip install yt-dlp")


async def transcribe_audio_with_gemini(
    audio_path: str,
    url: str,
    video_description: Optional[str] = None,
    video_title: Optional[str] = None,
    linked_recipe_json_ld: Optional[dict] = None,
    linked_recipe_url: Optional[str] = None
) -> List[ImportedRecipe]:
    """
    Transcribe audio and extract recipes using Gemini's audio understanding.
    This combines transcription and recipe extraction in one API call.

    Data sources (in order of reliability for quantities):
    1. linked_recipe_json_ld - Structured data from a linked recipe page (most precise)
    2. video_description - Often contains ingredient lists
    3. audio - The actual cooking video audio (best for techniques/instructions)

    Gemini will intelligently combine all available sources.
    """
    if not settings.gemini_api_key:
        raise ValueError("Gemini API key not configured")

    genai.configure(api_key=settings.gemini_api_key)

    # Define JSON schema for structured output
    recipe_schema = {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "description": {"type": "string"},
                "ingredients": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "quantity": {"type": "number"},
                            "unit": {"type": "string"},
                            "preparation": {"type": "string"},
                            "is_optional": {"type": "boolean"}
                        },
                        "required": ["name"]
                    }
                },
                "instructions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "step_number": {"type": "integer"},
                            "instruction_text": {"type": "string"},
                            "duration_minutes": {"type": "integer"}
                        },
                        "required": ["step_number", "instruction_text"]
                    }
                },
                "yield_quantity": {"type": "number"},
                "yield_unit": {"type": "string"},
                "prep_time_minutes": {"type": "integer"},
                "cook_time_minutes": {"type": "integer"},
                "difficulty": {"type": "string", "enum": ["easy", "medium", "hard"]},
                "tags": {"type": "array", "items": {"type": "string"}},
                "video_start_seconds": {"type": "integer"}
            },
            "required": ["title", "description", "ingredients", "instructions", "tags", "difficulty", "video_start_seconds"]
        }
    }

    # Upload the audio file to Gemini
    logger.info(f"Uploading audio file for transcription: {audio_path}")
    audio_file = genai.upload_file(audio_path)

    # Use Gemini to transcribe and extract recipe
    model = genai.GenerativeModel('gemini-2.0-flash-exp')

    # Build prompt with all available data sources
    sources_intro = "You have access to the following data sources:\n\n"

    # Source 1: Linked recipe page (highest priority for structured data)
    linked_recipe_context = ""
    if linked_recipe_json_ld:
        linked_text = json_ld_to_text(linked_recipe_json_ld)
        linked_recipe_context = f"""=== SOURCE 1: LINKED RECIPE PAGE (from {linked_recipe_url}) ===
This is structured recipe data from a linked webpage. Use this as the PRIMARY source for:
- Precise ingredient quantities and measurements
- Cooking times
- Servings/yield

{linked_text[:4000]}
=== END SOURCE 1 ===

"""

    # Source 2: Video description
    description_context = ""
    if video_description:
        description_context = f"""=== SOURCE 2: VIDEO DESCRIPTION ===
May contain ingredient lists, recipe notes, or additional context.

{video_description[:3000]}
=== END SOURCE 2 ===

"""

    # Source 3: Audio (always present)
    audio_context = """=== SOURCE 3: VIDEO AUDIO ===
The attached audio file. Use this as the PRIMARY source for:
- Cooking techniques and tips
- Step-by-step instructions
- Chef's notes and variations
=== END AUDIO SOURCE ===

"""

    title_context = ""
    if video_title:
        title_context = f"Video title: {video_title}\n\n"

    prompt = f"""You are a recipe extraction assistant. Extract the recipe from this cooking video by combining multiple data sources.

{title_context}{sources_intro}{linked_recipe_context}{description_context}{audio_context}
For EACH recipe found, provide a JSON object with:
- title: Recipe name
- description: Brief description (1-2 sentences)
- ingredients: Array of {{name, quantity (number or null), unit (string or null), preparation (string or null), is_optional (boolean)}}
- instructions: Array of {{step_number, instruction_text, duration_minutes (number or null)}}
- yield_quantity: Number of servings (number or null if not mentioned)
- yield_unit: Usually "servings" or "portions" (or null if not mentioned)
- prep_time_minutes: Preparation time (number or null)
- cook_time_minutes: Cooking time (number or null)
- difficulty: "easy", "medium", or "hard"
- tags: Array of relevant tags like cuisine type, meal type, dietary info
- video_start_seconds: The timestamp in seconds when this recipe starts in the audio

IMPORTANT - How to combine sources:
- For QUANTITIES: Prefer the LINKED RECIPE PAGE if available, then video description, then audio
- For INSTRUCTIONS: Prefer the AUDIO (it has the actual cooking demonstration with tips)
- For TIMES: Prefer the LINKED RECIPE PAGE if available
- If sources conflict, use your judgment to pick the most sensible value
- Include ALL ingredients and steps from ALL sources
- If multiple recipes are shown, return an array with each recipe as a separate object
- If only one recipe, still return it as an array with one object
- video_start_seconds: Identify when each recipe section begins in the audio (in seconds from start)
- Return ONLY valid JSON, no markdown or explanations
- CRITICAL for ingredients: If a quantity or unit is unknown, unspecified, or "to taste", set quantity to null and unit to null. Do NOT use placeholder text like "amount needed", "as needed", "to taste", or similar phrases as the unit value.

Respond with a JSON array of recipe objects."""

    max_retries = 3
    last_error = None

    try:
        for attempt in range(max_retries):
            try:
                response = model.generate_content(
                    [audio_file, prompt],
                    generation_config=genai.GenerationConfig(
                        response_mime_type="application/json",
                        response_schema=recipe_schema,
                        temperature=0.1,
                    )
                )

                # Parse the response
                response_text = response.text.strip()

                # Debug: log raw response
                logger.debug(f"Raw Gemini audio response (attempt {attempt + 1}):\n{response_text[:2000]}")

                # Clean up response if needed
                if response_text.startswith('```'):
                    response_text = re.sub(r'^```(?:json)?\n?', '', response_text)
                    response_text = re.sub(r'\n?```$', '', response_text)

                recipes_data = json.loads(response_text)
                break  # Success, exit retry loop

            except json.JSONDecodeError as e:
                last_error = e
                logger.warning(f"JSON parse error on attempt {attempt + 1}/{max_retries}: {e}")
                logger.warning(f"Raw response that failed to parse:\n{response_text[:1000]}...")
                if attempt < max_retries - 1:
                    logger.info(f"Retrying audio transcription...")
                    continue
                else:
                    raise ValueError(f"Failed to parse Gemini response after {max_retries} attempts: {e}")

        # Debug: log parsed JSON
        logger.info(f"Parsed {len(recipes_data) if isinstance(recipes_data, list) else 1} recipe(s) from audio")

        # Ensure it's a list
        if isinstance(recipes_data, dict):
            recipes_data = [recipes_data]

        # Invalid unit values that should be converted to None
        invalid_units = {
            'amount not specified', 'not specified', 'to taste', 'as needed',
            'amount needed', 'some', 'optional', 'pinch', None
        }

        def clean_unit(unit):
            """Clean unit value - return None for invalid/placeholder units."""
            if not unit:
                return None
            unit_lower = unit.lower().strip()
            if unit_lower in invalid_units or 'not specified' in unit_lower or 'as needed' in unit_lower:
                return None
            if len(unit) > 50:
                return None
            return unit

        # Convert to ImportedRecipe objects
        recipes = []
        for data in recipes_data:
            # Debug: log each recipe's key fields
            logger.debug(f"Recipe data: title={data.get('title')}, yield_quantity={data.get('yield_quantity')}")
            ingredients = [
                ImportedIngredient(
                    name=ing.get('name', ''),
                    quantity=ing.get('quantity') or None,  # Convert 0 to None (schema requires gt=0)
                    unit=clean_unit(ing.get('unit')),
                    preparation=ing.get('preparation'),
                    is_optional=ing.get('is_optional', False)
                )
                for ing in data.get('ingredients', [])
            ]

            instructions = [
                ImportedInstruction(
                    step_number=inst.get('step_number', idx + 1),
                    instruction_text=inst.get('instruction_text', ''),
                    duration_minutes=inst.get('duration_minutes')
                )
                for idx, inst in enumerate(data.get('instructions', []))
            ]

            recipe = ImportedRecipe(
                title=data.get('title') or 'Untitled Recipe',
                description=data.get('description'),
                ingredients=ingredients,
                instructions=instructions,
                yield_quantity=data.get('yield_quantity'),  # None if not specified
                yield_unit=data.get('yield_unit'),
                prep_time_minutes=data.get('prep_time_minutes'),
                cook_time_minutes=data.get('cook_time_minutes'),
                difficulty=data.get('difficulty'),
                source_url=url,
                source_name=None,  # Will be set to video uploader by caller
                tags=data.get('tags') or [],
                video_start_seconds=data.get('video_start_seconds')
            )
            recipes.append(recipe)

        return recipes

    finally:
        # Clean up: delete the uploaded file from Gemini
        try:
            audio_file.delete()
        except Exception:
            pass

        # Clean up: delete the local audio file and temp directory
        try:
            if os.path.exists(audio_path):
                os.remove(audio_path)
            temp_dir = os.path.dirname(audio_path)
            if os.path.exists(temp_dir) and not os.listdir(temp_dir):
                os.rmdir(temp_dir)
        except Exception:
            pass


async def parse_with_gemini(text: str, url: str, allow_multiple: bool = False) -> List[ImportedRecipe]:
    """
    Use Gemini to parse recipe text into structured format.
    Returns a list of recipes (usually 1, but can be multiple for YouTube videos).
    """
    if not settings.gemini_api_key:
        raise ValueError("Gemini API key not configured")

    genai.configure(api_key=settings.gemini_api_key)

    # Use Gemini with structured output
    model = genai.GenerativeModel('gemini-2.0-flash-exp')

    # Define JSON schema for structured output
    recipe_schema = {
        "type": "object",
        "properties": {
            "recipes": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "ingredients": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "name": {"type": "string"},
                                    "quantity": {"type": "number"},
                                    "quantity_max": {"type": "number"},
                                    "unit": {"type": "string"},
                                    "preparation": {"type": "string"},
                                    "is_optional": {"type": "boolean"},
                                    "notes": {"type": "string"}
                                },
                                "required": ["name"]
                            }
                        },
                        "instructions": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "step_number": {"type": "integer"},
                                    "instruction_text": {"type": "string"},
                                    "duration_minutes": {"type": "integer"}
                                },
                                "required": ["step_number", "instruction_text"]
                            }
                        },
                        "yield_quantity": {"type": "number"},
                        "yield_unit": {"type": "string"},
                        "prep_time_minutes": {"type": "integer"},
                        "cook_time_minutes": {"type": "integer"},
                        "difficulty": {"type": "string", "enum": ["easy", "medium", "hard"]},
                        "tags": {"type": "array", "items": {"type": "string"}},
                        "video_start_seconds": {"type": "integer"}
                    },
                    "required": ["title", "description", "ingredients", "instructions", "tags", "difficulty", "video_start_seconds"]
                }
            }
        },
        "required": ["recipes"]
    }

    if allow_multiple:
        prompt = f"""Extract ALL recipe information from this content and return it as JSON.
This content may contain MULTIPLE recipes - extract each one separately.

The JSON should be an object with a "recipes" array:
{{
  "recipes": [
    {{
      "title": "Recipe Title",
      "description": "Brief description of the dish",
      "yield_quantity": 4,
      "yield_unit": "servings",
      "prep_time_minutes": 15,
      "cook_time_minutes": 30,
      "difficulty": "easy",
      "video_start_seconds": 120,
      "ingredients": [
        {{
          "name": "ingredient name",
          "quantity": 1.5,
          "quantity_max": null,
          "unit": "cup",
          "preparation": "chopped",
          "is_optional": false,
          "notes": null
        }}
      ],
      "instructions": [
        {{
          "step_number": 1,
          "instruction_text": "Step description",
          "duration_minutes": null
        }}
      ],
      "tags": ["dinner", "quick"]
    }}
  ]
}}

Rules:
- If there are multiple distinct recipes, include each one in the array
- quantity should be a decimal number or null if not specified
- quantity_max is only used for ranges like "1-2 cups"
- unit should be lowercase and singular (cup, tablespoon, teaspoon, gram, etc.)
- preparation is things like "chopped", "diced", "melted" - extract from ingredient text
- difficulty should be "easy", "medium", or "hard" (guess based on complexity)
- tags should be relevant categories like meal type, cuisine, dietary info (maximum 5 tags)
- video_start_seconds: The timestamp (in seconds) when this recipe starts in the content.
  Look for [MM:SS] timestamps in the transcript and convert to seconds (e.g., [02:30] = 150 seconds).
  Use 0 if it's the first/only recipe or if no timestamps are available.
- If information is not available, use null
- Parse ALL ingredients and ALL instructions for each recipe
- Even if there's only one recipe, still return it in the recipes array
- CRITICAL: If a quantity or unit is unknown, unspecified, or "to taste", set quantity to null and unit to null. Do NOT use placeholder text like "amount needed", "as needed", "to taste", or similar phrases as unit values.

Content:
{text[:20000]}

Return ONLY the JSON, no other text."""
    else:
        prompt = f"""Extract the recipe information from this webpage content and return it as JSON.

The JSON should be an object with a "recipes" array containing one recipe:
{{
  "recipes": [
    {{
      "title": "Recipe Title",
      "description": "Brief description of the dish",
      "yield_quantity": 4,
      "yield_unit": "servings",
      "prep_time_minutes": 15,
      "cook_time_minutes": 30,
      "difficulty": "easy",
      "ingredients": [
        {{
          "name": "ingredient name",
          "quantity": 1.5,
          "quantity_max": null,
          "unit": "cup",
          "preparation": "chopped",
          "is_optional": false,
          "notes": null
        }}
      ],
      "instructions": [
        {{
          "step_number": 1,
          "instruction_text": "Step description",
          "duration_minutes": null
        }}
      ],
      "tags": ["dinner", "quick"]
    }}
  ]
}}

Rules:
- quantity should be a decimal number or null if not specified
- quantity_max is only used for ranges like "1-2 cups"
- unit should be lowercase and singular (cup, tablespoon, teaspoon, gram, etc.)
- preparation is things like "chopped", "diced", "melted" - extract from ingredient text
- difficulty should be "easy", "medium", or "hard" (guess based on complexity)
- tags should be relevant categories like meal type, cuisine, dietary info (maximum 5 tags)
- If information is not available, use null
- Parse ALL ingredients and ALL instructions from the recipe
- CRITICAL: If a quantity or unit is unknown, unspecified, or "to taste", set quantity to null and unit to null. Do NOT use placeholder text like "amount needed", "as needed", "to taste", or similar phrases as unit values.

Webpage content:
{text[:15000]}

Return ONLY the JSON, no other text."""

    # Retry logic for handling occasional malformed JSON from Gemini
    max_retries = 3
    response_text = ""

    for attempt in range(max_retries):
        try:
            response = model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    response_schema=recipe_schema,
                    temperature=0.1,
                )
            )
            response_text = response.text.strip()
            data = json.loads(response_text)
            break  # Success, exit retry loop

        except json.JSONDecodeError as e:
            logger.warning(f"JSON parse error on attempt {attempt + 1}/{max_retries}: {e}")
            logger.warning(f"Raw response that failed to parse:\n{response_text[:1000]}...")
            if attempt < max_retries - 1:
                logger.info(f"Retrying text extraction...")
                continue
            else:
                raise ValueError(f"Failed to parse Gemini response after {max_retries} attempts: {e}")

    # Handle both old format (single recipe) and new format (recipes array)
    recipes_data = data.get('recipes', [data] if 'title' in data else [])

    # Invalid unit values that should be converted to None
    invalid_units = {
        'amount not specified', 'not specified', 'to taste', 'as needed',
        'amount needed', 'some', 'optional', 'pinch', None
    }

    def clean_unit(unit):
        """Clean unit value - return None for invalid/placeholder units."""
        if not unit:
            return None
        unit_lower = unit.lower().strip()
        # Check for invalid patterns
        if unit_lower in invalid_units or 'not specified' in unit_lower or 'as needed' in unit_lower:
            return None
        # If unit is too long (probably a description), truncate or nullify
        if len(unit) > 50:
            return None
        return unit

    def clean_quantity_max(quantity, quantity_max):
        """Set quantity_max to None if it equals quantity (not a real range)."""
        if quantity_max is None or quantity is None:
            return quantity_max
        if quantity_max <= quantity:
            return None
        return quantity_max

    recipes = []
    for recipe_data in recipes_data:
        ingredients = []
        for ing in recipe_data.get('ingredients', []):
            qty = ing.get('quantity') or None
            qty_max = ing.get('quantity_max') or None
            ingredients.append(ImportedIngredient(
                name=ing.get('name', ''),
                quantity=qty,
                quantity_max=clean_quantity_max(qty, qty_max),
                unit=clean_unit(ing.get('unit')),
                preparation=ing.get('preparation'),
                is_optional=ing.get('is_optional', False),
                notes=ing.get('notes'),
            ))

        def safe_int(val):
            """Convert to int, rounding floats if necessary."""
            if val is None:
                return None
            return round(val) if isinstance(val, (int, float)) else None

        instructions = [
            ImportedInstruction(
                step_number=safe_int(inst.get('step_number')) or (idx + 1),
                instruction_text=inst.get('instruction_text', ''),
                duration_minutes=safe_int(inst.get('duration_minutes')),
            )
            for idx, inst in enumerate(recipe_data.get('instructions', []))
        ]

        recipes.append(ImportedRecipe(
            title=recipe_data.get('title') or 'Untitled Recipe',
            description=recipe_data.get('description'),
            ingredients=ingredients,
            instructions=instructions,
            yield_quantity=recipe_data.get('yield_quantity'),  # None if not specified
            yield_unit=recipe_data.get('yield_unit'),
            prep_time_minutes=safe_int(recipe_data.get('prep_time_minutes')),
            cook_time_minutes=safe_int(recipe_data.get('cook_time_minutes')),
            difficulty=recipe_data.get('difficulty'),
            source_url=url,
            tags=recipe_data.get('tags', []),
            video_start_seconds=safe_int(recipe_data.get('video_start_seconds')),
        ))

    return recipes if recipes else [ImportedRecipe(title="Untitled Recipe", source_url=url)]


def extract_metadata_from_json_ld(data: dict) -> dict:
    """
    Extract useful metadata from JSON-LD that we want to preserve
    (image URL, author/source name) even when using LLM parsing.
    """
    # Get image
    image = data.get('image')
    if isinstance(image, list):
        image = image[0] if image else None
    if isinstance(image, dict):
        image = image.get('url')

    # Extract source name from author
    author = data.get('author')
    source_name = None
    if isinstance(author, dict):
        source_name = author.get('name')
    elif isinstance(author, list) and author:
        source_name = author[0].get('name') if isinstance(author[0], dict) else str(author[0])
    elif isinstance(author, str):
        source_name = author

    return {
        'cover_image_url': image,
        'source_name': source_name,
    }


def json_ld_to_text(data: dict) -> str:
    """
    Convert JSON-LD recipe data to readable text for LLM parsing.
    This ensures we get consistent, granular parsing even from structured data.
    """
    parts = []

    # Title
    if data.get('name'):
        parts.append(f"Recipe: {data.get('name')}")

    # Description
    if data.get('description'):
        parts.append(f"\nDescription: {data.get('description')}")

    # Yield
    if data.get('recipeYield'):
        yield_val = data.get('recipeYield')
        if isinstance(yield_val, list):
            yield_val = yield_val[0]
        parts.append(f"\nYield: {yield_val}")

    # Times
    if data.get('prepTime'):
        parts.append(f"Prep time: {data.get('prepTime')}")
    if data.get('cookTime'):
        parts.append(f"Cook time: {data.get('cookTime')}")
    if data.get('totalTime'):
        parts.append(f"Total time: {data.get('totalTime')}")

    # Ingredients
    if data.get('recipeIngredient'):
        parts.append("\nIngredients:")
        for ing in data.get('recipeIngredient', []):
            if isinstance(ing, str):
                parts.append(f"- {ing}")
            elif isinstance(ing, dict):
                parts.append(f"- {ing.get('name', str(ing))}")

    # Instructions
    if data.get('recipeInstructions'):
        parts.append("\nInstructions:")
        instructions = data.get('recipeInstructions', [])

        # Handle HowToSection (grouped instructions)
        if instructions and isinstance(instructions[0], dict) and instructions[0].get('@type') == 'HowToSection':
            step_num = 1
            for section in instructions:
                section_name = section.get('name', '')
                if section_name:
                    parts.append(f"\n{section_name}:")
                for step in section.get('itemListElement', []):
                    text = step.get('text', '') if isinstance(step, dict) else str(step)
                    parts.append(f"{step_num}. {text}")
                    step_num += 1
        else:
            for idx, inst in enumerate(instructions):
                if isinstance(inst, str):
                    parts.append(f"{idx + 1}. {inst}")
                elif isinstance(inst, dict):
                    text = inst.get('text', '')
                    if not text:
                        text = inst.get('itemListElement', '')
                        if isinstance(text, dict):
                            text = text.get('text', '')
                    parts.append(f"{idx + 1}. {text}")

    # Categories/tags
    if data.get('recipeCategory'):
        cats = data.get('recipeCategory')
        if isinstance(cats, list):
            parts.append(f"\nCategories: {', '.join(cats)}")
        else:
            parts.append(f"\nCategory: {cats}")

    if data.get('recipeCuisine'):
        cuisine = data.get('recipeCuisine')
        if isinstance(cuisine, list):
            parts.append(f"Cuisine: {', '.join(cuisine)}")
        else:
            parts.append(f"Cuisine: {cuisine}")

    return '\n'.join(parts)


async def import_recipe_from_url(url: str, use_audio_fallback: bool = True) -> List[ImportedRecipe]:
    """
    Main entry point: import recipe(s) from a URL.

    For YouTube videos:
    - First tries to extract transcript from captions
    - Falls back to audio transcription with Gemini if captions unavailable
    - Parses with Gemini (can return multiple recipes)

    For regular URLs:
    - Always uses Gemini LLM for parsing to ensure consistent granularity
    - Extracts metadata (image, source) from JSON-LD when available

    Returns a list of ImportedRecipe objects.
    """
    # Check if this is a YouTube URL
    if is_youtube_url(url):
        video_id = extract_youtube_video_id(url)
        if not video_id:
            raise ValueError("Could not extract video ID from YouTube URL")

        thumbnail_url = get_youtube_thumbnail_url(video_id)
        recipes = None

        # Fetch video metadata (title, description) for better extraction
        logger.info(f"Fetching video metadata for {video_id}...")
        video_info = get_youtube_video_info(video_id)
        video_description = video_info.get('description', '')
        video_title = video_info.get('title', '')
        video_uploader = video_info.get('uploader') or video_info.get('channel', '')

        if video_description:
            logger.info(f"Got video description ({len(video_description)} chars)")

        # Search for linked recipe URLs in the description
        linked_json_ld = None
        linked_recipe_url = None
        if video_description:
            logger.info("Searching for recipe URLs in description...")
            linked_json_ld, linked_recipe_url = await find_linked_recipe_data(video_description)
            if linked_json_ld:
                logger.info(f"Found linked recipe data from {linked_recipe_url}")

        # Try transcript first
        try:
            transcript, _ = get_youtube_transcript(video_id)
            if len(transcript) >= 100:
                # Combine all available sources for better context
                parts = []

                # Include linked recipe data if available (highest priority for quantities)
                if linked_json_ld:
                    linked_text = json_ld_to_text(linked_json_ld)
                    parts.append(f"LINKED RECIPE PAGE (from {linked_recipe_url}):\n{linked_text}")

                # Include video description
                if video_description:
                    parts.append(f"VIDEO DESCRIPTION:\n{video_description}")

                # Include transcript
                parts.append(f"TRANSCRIPT:\n{transcript}")

                combined_text = "\n\n".join(parts)

                # Parse with Gemini, allowing multiple recipes
                recipes = await parse_with_gemini(combined_text, url, allow_multiple=True)
                logger.info(f"Extracted {len(recipes)} recipes from transcript")
        except ValueError as e:
            error_msg = str(e)
            if "TRANSCRIPT_UNAVAILABLE" in error_msg and use_audio_fallback:
                logger.info(f"Transcript unavailable for {video_id}, trying audio transcription...")
            else:
                raise

        # Fall back to audio transcription if transcript failed
        if recipes is None and use_audio_fallback:
            logger.info(f"Downloading audio for {video_id}...")
            audio_path = download_youtube_audio(video_id)
            logger.info(f"Transcribing audio with Gemini...")
            recipes = await transcribe_audio_with_gemini(
                audio_path,
                url,
                video_description=video_description,
                video_title=video_title,
                linked_recipe_json_ld=linked_json_ld,
                linked_recipe_url=linked_recipe_url
            )
            logger.info(f"Extracted {len(recipes)} recipes from audio")

        if recipes is None:
            raise ValueError("Could not extract recipes from this video")

        # Add YouTube thumbnail and source info to all recipes
        for recipe in recipes:
            if not recipe.cover_image_url:
                recipe.cover_image_url = thumbnail_url
            # Use video uploader as source name if not already set
            if not recipe.source_name and video_uploader:
                recipe.source_name = video_uploader
            elif not recipe.source_name:
                recipe.source_name = "YouTube"

        return recipes

    # Regular URL handling
    html, final_url = await fetch_url_content(url)

    # Check for JSON-LD data - we'll use it as the source text for better parsing
    # and extract metadata (image, author) that we want to preserve
    json_ld = extract_json_ld_recipe(html)
    metadata = {}

    if json_ld:
        # Extract metadata we want to keep
        metadata = extract_metadata_from_json_ld(json_ld)
        # Convert JSON-LD to text for LLM parsing (more consistent results)
        text = json_ld_to_text(json_ld)
    else:
        # Fall back to extracting page text
        text = extract_page_text(html)

    if len(text) < 100:
        raise ValueError("Could not extract sufficient content from the page")

    # Always use Gemini for parsing to ensure consistent granularity
    recipes = await parse_with_gemini(text, final_url, allow_multiple=False)

    # Apply metadata from JSON-LD if available
    if metadata:
        for recipe in recipes:
            if metadata.get('cover_image_url') and not recipe.cover_image_url:
                recipe.cover_image_url = metadata['cover_image_url']
            if metadata.get('source_name') and not recipe.source_name:
                recipe.source_name = metadata['source_name']

    return recipes


def recipe_to_dict(recipe: ImportedRecipe) -> dict:
    """Convert ImportedRecipe to a dictionary for JSON response."""
    return {
        'title': recipe.title,
        'description': recipe.description,
        'ingredients': [asdict(ing) for ing in recipe.ingredients],
        'instructions': [asdict(inst) for inst in recipe.instructions],
        'yield_quantity': recipe.yield_quantity,
        'yield_unit': recipe.yield_unit,
        'prep_time_minutes': recipe.prep_time_minutes,
        'cook_time_minutes': recipe.cook_time_minutes,
        'difficulty': recipe.difficulty,
        'source_url': recipe.source_url,
        'source_name': recipe.source_name,
        'cover_image_url': recipe.cover_image_url,
        'tags': recipe.tags,
        'video_start_seconds': recipe.video_start_seconds,
    }
