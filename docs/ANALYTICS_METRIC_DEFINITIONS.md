# Analytics Metric Definitions

Authoritative definitions for all analytics metrics in PromptCommit.

## Metric Reference

| Metric | Definition | Database Source | User Scope | Empty Behavior | Filtering |
|--------|-----------|----------------|------------|----------------|-----------|
| `totalPrompts` | Count of all prompts owned by user | `COUNT(prompts.id) WHERE user_id = ?` | `Prompt.user_id = current_user.id` | `0` | None — includes all categories |
| `totalVersions` | Count of all versions across user's prompts | `COUNT(prompt_versions.id) JOIN prompts WHERE user_id = ?` | Via `Prompt.user_id` join | `0` | None |
| `totalFavorites` | Count of user's favorited prompts | `COUNT(favorites.id) WHERE user_id = ?` | `Favorite.user_id = current_user.id` | `0` | None |
| `totalTested` | Count of all test executions by user | `COUNT(prompt_tests.id) WHERE user_id = ?` | `PromptTest.user_id = current_user.id` | `0` | None |
| `totalCollections` | Count of canonical Collection records owned by user | `COUNT(collections.id) WHERE user_id = ?` | `Collection.user_id = current_user.id` | `0` | Does NOT count collection names |
| `avgPromptRating` | Average rating across rated prompts (excludes unrated) | `AVG(prompts.rating) WHERE user_id = ? AND rating IS NOT NULL` | `Prompt.user_id = current_user.id` | `null` (NOT 0, NOT 5.0) | Only prompts with `rating IS NOT NULL` |
| `avgLatencyMs` | Average response latency from test executions | `AVG(prompt_tests.response_time_ms) WHERE user_id = ? AND response_time_ms > 0` | `PromptTest.user_id` | Falls back to `AVG(prompts.avg_latency_ms)` then `0` | Excludes zero-latency records |
| `avgVersionsPerPrompt` | Total versions / total prompts | Computed: `totalVersions / totalPrompts` | Derived | `0.0` when `totalPrompts = 0` | None |
| `categories` | Prompt count grouped by category | `GROUP BY prompts.category WHERE user_id = ?` | `Prompt.user_id = current_user.id` | Empty list `[]` | Uses `Prompt.category`, NOT `collection_name` |
| `modelStats` | Test count and latency grouped by model + provider | `GROUP BY prompt_tests.model, provider WHERE user_id = ?` | `PromptTest.user_id = current_user.id` | Empty list `[]` | Provider normalized to canonical ID at analytics boundary |
| `recentActivities` | 8 most recent prompt creations and test executions | `ORDER BY created_at DESC LIMIT 8` from prompts + tests | Both `Prompt.user_id` and `PromptTest.user_id` | Empty list `[]` | Combined and sorted by real `datetime` objects |

## Key Rules

### Rating Behavior
- **No ratings exist**: `avgPromptRating = null`
- **Some prompts rated**: `avgPromptRating = AVG(rated prompts only)`
- **Frontend display**: `null` → "Not rated" or "N/A"
- **Never returns**: `0`, `5.0`, or any fake fallback

### Model/Provider Normalization
- **Database stores**: Raw provider strings from test execution (e.g., "Google Gemini")
- **Analytics returns**: Canonical provider ID (e.g., "gemini") + display name
- **Canonical providers**: `gemini`, `groq`, `openrouter`, `mistral`
- **Unknown providers**: Returned as `"unknown"` — never silently remapped

### Collection Analytics
- **Source of truth**: `collection_prompts` junction table (M2M)
- **Never uses**: `Prompt.collection_name` for counting
- **Scope**: `Collection.user_id = current_user.id`
- **Uncollected prompts**: Not counted in any collection

### User Isolation
- **ALL metrics** are scoped to `current_user.id`
- User A's analytics NEVER include User B's data
- Enforced at the database query level (WHERE clause)

### Activity Sorting
- Activities sorted by real `datetime` objects (not formatted strings)
- Formatting to display strings happens AFTER sorting and limiting
- Limit: 8 most recent activities
