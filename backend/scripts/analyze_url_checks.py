#!/usr/bin/env python3
"""
Analyze URL Checks Log

Analyzes the url_checks.jsonl file to identify domains that should be blocked.
Shows domains that frequently don't have recipes.

Usage:
    python scripts/analyze_url_checks.py
"""

import json
from pathlib import Path
from collections import defaultdict


def main():
    log_path = Path(__file__).parent.parent / 'seed_data' / 'url_checks.jsonl'

    if not log_path.exists():
        print("No url_checks.jsonl found yet. Run some recipe extractions first.")
        return

    # Aggregate by domain
    domain_stats = defaultdict(lambda: {'has_recipe': 0, 'no_recipe': 0, 'urls': []})

    with open(log_path, 'r') as f:
        for line in f:
            if not line.strip():
                continue
            try:
                entry = json.loads(line)
                domain = entry.get('domain', 'unknown')
                has_recipe = entry.get('has_recipe', False)

                if has_recipe:
                    domain_stats[domain]['has_recipe'] += 1
                else:
                    domain_stats[domain]['no_recipe'] += 1
                    # Only store a few example URLs
                    if len(domain_stats[domain]['urls']) < 3:
                        domain_stats[domain]['urls'].append(entry.get('url', ''))
            except json.JSONDecodeError:
                continue

    # Sort by no_recipe count (domains to consider blocking)
    sorted_domains = sorted(
        domain_stats.items(),
        key=lambda x: (x[1]['no_recipe'], -x[1]['has_recipe']),
        reverse=True
    )

    print("=" * 70)
    print("URL CHECK ANALYSIS")
    print("=" * 70)
    print()

    # Show domains with no recipes (candidates for blocking)
    print("DOMAINS WITHOUT RECIPES (consider blocking):")
    print("-" * 70)
    for domain, stats in sorted_domains:
        if stats['no_recipe'] > 0 and stats['has_recipe'] == 0:
            print(f"  {domain}")
            print(f"    Checked: {stats['no_recipe']} times, never had recipe")
            if stats['urls']:
                print(f"    Example: {stats['urls'][0][:60]}...")
            print()

    print()
    print("DOMAINS WITH RECIPES (keep allowed):")
    print("-" * 70)
    for domain, stats in sorted_domains:
        if stats['has_recipe'] > 0:
            total = stats['has_recipe'] + stats['no_recipe']
            pct = (stats['has_recipe'] / total) * 100
            print(f"  {domain}: {stats['has_recipe']}/{total} had recipes ({pct:.0f}%)")

    print()
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)
    total_checks = sum(s['has_recipe'] + s['no_recipe'] for s in domain_stats.values())
    total_with_recipe = sum(s['has_recipe'] for s in domain_stats.values())
    print(f"Total URL checks: {total_checks}")
    print(f"URLs with recipes: {total_with_recipe} ({total_with_recipe/total_checks*100:.1f}%)" if total_checks > 0 else "")
    print(f"Unique domains: {len(domain_stats)}")


if __name__ == '__main__':
    main()
