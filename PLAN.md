# Recipe Extraction Script Plan

## Goal
Create a script that extracts recipes from a list of URLs and saves them as JSON files in `backend/seed_data/` for later database population.

## Approach

### File Structure
```
backend/
  seed_data/
    recipes/
      {slug}-{hash}.json    # Individual recipe files
    links.txt               # Input file with URLs (one per line)
    metadata.json           # Tracks account name, extraction stats
```

### Script: `backend/scripts/extract_recipes.py`

**Input:**
- `backend/seed_data/links.txt` - One URL per line
- `--account` flag - Account name to associate (stored in metadata)

**Process:**
1. Read URLs from `links.txt`
2. For each URL:
   - Call the existing `recipe_import` service directly (reuses `fetch_url_content`, `extract_json_ld_recipe`, `parse_with_gemini`)
   - Skip URLs that have already been extracted (check existing JSON files by source_url)
   - Save as JSON with filename: `{slugified-title}-{short-hash}.json`
   - Add 1-2 second delay between requests to be respectful
3. Update `metadata.json` with:
   - Account name for population
   - Extraction stats (success/failed counts)
   - List of failed URLs for retry

**Recipe JSON Format:**
```json
{
  "title": "Spaghetti Carbonara",
  "description": "Classic Italian pasta...",
  "ingredients": [
    {"name": "spaghetti", "quantity": 400, "unit": "g", ...}
  ],
  "instructions": [
    {"step_number": 1, "instruction_text": "...", ...}
  ],
  "yield_quantity": 4,
  "yield_unit": "servings",
  "prep_time_minutes": 10,
  "cook_time_minutes": 20,
  "difficulty": "medium",
  "source_url": "https://example.com/recipe",
  "source_name": "Example Blog",
  "cover_image_url": "https://...",
  "tags": ["pasta", "italian"]
}
```

### Implementation Details

1. **Reuse existing service** - Import directly from `services.recipe_import`:
   - `fetch_url_content()` - Handles HTTP fetching with proper headers
   - `extract_json_ld_recipe()` - Tries schema.org JSON-LD first
   - `parse_with_gemini()` - Falls back to AI parsing
   - Supports YouTube URLs automatically

2. **Error handling**:
   - Network errors → log and continue
   - Parsing failures → log and continue
   - Track all failures in metadata for retry

3. **Idempotency**:
   - Check if URL already extracted before processing
   - Safe to re-run (won't duplicate)

4. **Progress output**:
   - Show progress bar or counter
   - Print success/failure for each URL
   - Summary at end

### Usage
```bash
cd backend
python scripts/extract_recipes.py --account "mycookbook"
```

### Dependencies
- Existing: `httpx`, `google.generativeai` (already in project)
- May need: `python-slugify` for filename generation

## Out of Scope (for later)
- Database population script (Phase 2)
- Handling duplicate recipes with same title
- Manual recipe review/editing interface
