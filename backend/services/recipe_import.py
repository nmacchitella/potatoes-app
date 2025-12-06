"""
Recipe Import Service

Imports recipes from URLs by:
1. Fetching the page content
2. Attempting to extract JSON-LD schema.org/Recipe data
3. Falling back to LLM (Gemini) parsing if no structured data found

Also supports YouTube videos:
- Extracts transcript from YouTube videos
- Parses recipes from video transcripts (can handle multiple recipes)
"""

import json
import re
import httpx
from typing import Optional, List, Tuple
from dataclasses import dataclass, asdict
from bs4 import BeautifulSoup
import google.generativeai as genai
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound

from config import settings


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
    yield_quantity: float = 4
    yield_unit: str = "servings"
    prep_time_minutes: Optional[int] = None
    cook_time_minutes: Optional[int] = None
    difficulty: Optional[str] = None
    source_url: Optional[str] = None
    source_name: Optional[str] = None
    cover_image_url: Optional[str] = None
    tags: List[str] = None  # Suggested tags based on content

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


def get_youtube_transcript(video_id: str) -> Tuple[str, str]:
    """
    Get transcript from a YouTube video.
    Returns (transcript_text, video_title).
    """
    try:
        # Create API instance (new API style)
        api = YouTubeTranscriptApi()

        # Try to get English transcript first
        transcript_data = None
        try:
            transcript_data = api.fetch(video_id, languages=['en', 'en-US', 'en-GB'])
        except Exception:
            # Try with just English
            try:
                transcript_data = api.fetch(video_id, languages=['en'])
            except Exception:
                # Try without language preference (uses default 'en')
                transcript_data = api.fetch(video_id)

        if not transcript_data:
            raise ValueError("No transcript available for this video")

        # Combine all text segments - FetchedTranscript is iterable
        full_text = ' '.join([entry.text for entry in transcript_data])

        return full_text, ""

    except TranscriptsDisabled:
        raise ValueError("Transcripts are disabled for this video")
    except NoTranscriptFound:
        raise ValueError("No transcript available for this video")
    except Exception as e:
        raise ValueError(f"Failed to get transcript: {str(e)}")


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
- tags should be relevant categories like meal type, cuisine, dietary info
- If information is not available, use null
- Parse ALL ingredients and ALL instructions for each recipe
- Even if there's only one recipe, still return it in the recipes array

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
- tags should be relevant categories like meal type, cuisine, dietary info
- If information is not available, use null
- Parse ALL ingredients and ALL instructions from the recipe

Webpage content:
{text[:15000]}

Return ONLY the JSON, no other text."""

    response = model.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
        )
    )

    # Parse the response
    try:
        data = json.loads(response.text)
    except json.JSONDecodeError:
        # Try to extract JSON from response if it has extra text
        json_match = re.search(r'\{[\s\S]*\}', response.text)
        if json_match:
            data = json.loads(json_match.group())
        else:
            raise ValueError("Failed to parse Gemini response as JSON")

    # Handle both old format (single recipe) and new format (recipes array)
    recipes_data = data.get('recipes', [data] if 'title' in data else [])

    recipes = []
    for recipe_data in recipes_data:
        ingredients = [
            ImportedIngredient(
                name=ing.get('name', ''),
                quantity=ing.get('quantity'),
                quantity_max=ing.get('quantity_max'),
                unit=ing.get('unit'),
                preparation=ing.get('preparation'),
                is_optional=ing.get('is_optional', False),
                notes=ing.get('notes'),
            )
            for ing in recipe_data.get('ingredients', [])
        ]

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
            yield_quantity=recipe_data.get('yield_quantity') or 4,
            yield_unit=recipe_data.get('yield_unit') or 'servings',
            prep_time_minutes=safe_int(recipe_data.get('prep_time_minutes')),
            cook_time_minutes=safe_int(recipe_data.get('cook_time_minutes')),
            difficulty=recipe_data.get('difficulty'),
            source_url=url,
            tags=recipe_data.get('tags', []),
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


async def import_recipe_from_url(url: str) -> List[ImportedRecipe]:
    """
    Main entry point: import recipe(s) from a URL.

    For YouTube videos:
    - Extracts the transcript
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

        transcript, _ = get_youtube_transcript(video_id)
        if len(transcript) < 100:
            raise ValueError("Transcript is too short to extract recipe information")

        # Parse with Gemini, allowing multiple recipes
        return await parse_with_gemini(transcript, url, allow_multiple=True)

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
    }
