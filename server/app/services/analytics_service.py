from sqlalchemy import Tuple
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta, date
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.prompt import Prompt
from app.models.prompt_version import PromptVersion
from app.models.favorite import Favorite
from app.models.prompt_test import PromptTest
from app.models.collection import Collection, collection_prompts
from app.core.ai_config import normalize_provider_id, normalize_model_id, SUPPORTED_AI_PROVIDERS

class AnalyticsService:
    def get_user_analytics(self, user_id: str, db: Session, days: int = 7, time_range: Optional[str] = None) -> Dict[str, Any]:
        """Aggregate real database statistics for current user using DB-side operations"""
        # Determine number of days from time_range or days param
        if time_range:
            clean_tr = time_range.strip().lower()
            if clean_tr.endswith('d') and clean_tr[:-1].isdigit():
                days = int(clean_tr[:-1])
            elif clean_tr.isdigit():
                days = int(clean_tr)

        if days < 1:
            days = 7
        elif days > 90:
            days = 90
        # 1. Total prompts owned by user
        total_prompts = db.query(func.count(Prompt.id)).filter(Prompt.user_id == user_id).scalar() or 0

        # 2. Total versions across user's prompts
        total_versions = db.query(func.count(PromptVersion.id)).join(
            Prompt, PromptVersion.prompt_id == Prompt.id
        ).filter(Prompt.user_id == user_id).scalar() or 0

        # 3. Total favorites
        total_favorites = db.query(func.count(Favorite.id)).filter(
            Favorite.user_id == user_id
        ).scalar() or 0

        # 4. Total tests executed by user
        total_tested = db.query(func.count(PromptTest.id)).filter(
            PromptTest.user_id == user_id
        ).scalar() or 0

        # 5. Total collections owned by user
        total_collections = db.query(func.count(Collection.id)).filter(
            Collection.user_id == user_id
        ).scalar() or 0

        # 6. Average rating (strictly from prompts that have actual ratings)
        avg_rating_val = db.query(func.avg(Prompt.rating)).filter(
            Prompt.user_id == user_id,
            Prompt.rating.isnot(None)
        ).scalar()
        avg_rating = round(float(avg_rating_val), 1) if avg_rating_val is not None else None

        # 7. Average versions per prompt
        avg_versions = round(total_versions / total_prompts, 1) if total_prompts > 0 else 0.0

        # 8. Average latency
        avg_test_lat = db.query(func.avg(PromptTest.response_time_ms)).filter(
            PromptTest.user_id == user_id,
            PromptTest.response_time_ms > 0
        ).scalar()
        if avg_test_lat is not None:
            avg_latency = round(float(avg_test_lat))
        else:
            avg_prompt_lat = db.query(func.avg(Prompt.avg_latency_ms)).filter(
                Prompt.user_id == user_id,
                Prompt.avg_latency_ms > 0
            ).scalar()
            avg_latency = round(float(avg_prompt_lat)) if avg_prompt_lat is not None else 0

        # 9. Category breakdown via SQL GROUP BY with canonical casing, sorting, and rich color palette
        category_rows = db.query(
            Prompt.category,
            func.count(Prompt.id)
        ).filter(
            Prompt.user_id == user_id
        ).group_by(
            Prompt.category
        ).all()

        # Known category color map with rich contrasting themes and guaranteed hex codes
        category_colors = {
            "coding": {"color": "bg-blue-600", "text": "text-blue-600 dark:text-blue-400", "hex": "#2563eb"},
            "marketing": {"color": "bg-amber-500", "text": "text-amber-600 dark:text-amber-400", "hex": "#f59e0b"},
            "engineering": {"color": "bg-rose-500", "text": "text-rose-600 dark:text-rose-400", "hex": "#f43f5e"},
            "research": {"color": "bg-cyan-500", "text": "text-cyan-600 dark:text-cyan-400", "hex": "#06b6d4"},
            "education": {"color": "bg-indigo-500", "text": "text-indigo-600 dark:text-indigo-400", "hex": "#6366f1"},
            "email": {"color": "bg-purple-600", "text": "text-purple-600 dark:text-purple-400", "hex": "#9333ea"},
            "website": {"color": "bg-emerald-500", "text": "text-emerald-600 dark:text-emerald-400", "hex": "#10b981"},
            "ui/ux": {"color": "bg-pink-500", "text": "text-pink-600 dark:text-pink-400", "hex": "#ec4899"},
            "design": {"color": "bg-pink-500", "text": "text-pink-600 dark:text-pink-400", "hex": "#ec4899"},
            "database": {"color": "bg-teal-500", "text": "text-teal-600 dark:text-teal-400", "hex": "#14b8a6"},
            "frontend": {"color": "bg-sky-500", "text": "text-sky-600 dark:text-sky-400", "hex": "#0ea5e9"},
            "backend": {"color": "bg-violet-600", "text": "text-violet-600 dark:text-violet-400", "hex": "#7c3aed"},
            "general": {"color": "bg-blue-500", "text": "text-blue-600 dark:text-blue-400", "hex": "#3b82f6"},
        }

        fallback_palette = [
            {"color": "bg-purple-600", "text": "text-purple-600 dark:text-purple-400", "hex": "#9333ea"},
            {"color": "bg-emerald-500", "text": "text-emerald-600 dark:text-emerald-400", "hex": "#10b981"},
            {"color": "bg-teal-500", "text": "text-teal-600 dark:text-teal-400", "hex": "#14b8a6"},
            {"color": "bg-pink-500", "text": "text-pink-600 dark:text-pink-400", "hex": "#ec4899"},
            {"color": "bg-indigo-500", "text": "text-indigo-600 dark:text-indigo-400", "hex": "#6366f1"},
            {"color": "bg-cyan-500", "text": "text-cyan-600 dark:text-cyan-400", "hex": "#06b6d4"},
            {"color": "bg-violet-500", "text": "text-violet-600 dark:text-violet-400", "hex": "#8b5cf6"},
            {"color": "bg-amber-500", "text": "text-amber-600 dark:text-amber-400", "hex": "#f59e0b"},
        ]

        def _format_cat_name(s: str) -> str:
            clean = (s or "Coding").strip()
            if not clean:
                return "Coding"
            lower = clean.lower()
            special = {
                "ui/ux": "UI/UX",
                "ui": "UI",
                "ux": "UX",
                "api": "API",
                "ai": "AI",
                "ai/ml": "AI/ML",
                "ml": "ML",
                "devops": "DevOps",
                "seo": "SEO",
                "qa": "QA",
            }
            if lower in special:
                return special[lower]
            if clean.islower():
                return clean.capitalize()
            return clean

        # Group and normalize category names
        grouped_counts: Dict[str, int] = {}
        for cat_name, count in category_rows:
            name_str = _format_cat_name(cat_name)
            grouped_counts[name_str] = grouped_counts.get(name_str, 0) + count

        # Sort descending by prompt count (largest domain share first)
        sorted_grouped = sorted(grouped_counts.items(), key=lambda item: (-item[1], item[0]))

        categories_list = []
        for idx, (name_str, count) in enumerate(sorted_grouped):
            pct = round((count / total_prompts) * 100) if total_prompts > 0 else 0
            cfg = category_colors.get(name_str.lower(), fallback_palette[idx % len(fallback_palette)])
            categories_list.append({
                "name": name_str,
                "count": count,
                "percentage": pct,
                "color": cfg["color"],
                "text": cfg["text"],
                "hex": cfg.get("hex", "#2563eb")
            })

        # 10. Model statistics via canonical normalization boundary
        raw_tests = db.query(PromptTest).filter(PromptTest.user_id == user_id).all()
        aggregated_models: Dict[Tuple[str, str], Dict[str, Any]] = {}
        for t in raw_tests:
            c_pid = normalize_provider_id(t.provider)
            c_mid = normalize_model_id(t.model)
            key = (c_mid, c_pid or "unknown")
            if key not in aggregated_models:
                p_cfg = SUPPORTED_AI_PROVIDERS.get(c_pid, {}) if c_pid else {}
                display_p = p_cfg.get("name", t.provider or "Unknown")
                aggregated_models[key] = {
                    "model": c_mid,
                    "provider": c_pid or "unknown",
                    "providerDisplay": display_p,
                    "testsCount": 0,
                    "totalLatency": 0,
                    "validLatencyCount": 0
                }
            entry = aggregated_models[key]
            entry["testsCount"] += 1
            if t.response_time_ms and t.response_time_ms > 0:
                entry["totalLatency"] += t.response_time_ms
                entry["validLatencyCount"] += 1

        model_stats_list = []
        for (c_mid, c_pid), data in aggregated_models.items():
            avg_lat = round(data["totalLatency"] / data["validLatencyCount"]) if data["validLatencyCount"] > 0 else 0
            model_stats_list.append({
                "model": data["model"],
                "provider": data["provider"],
                "providerDisplay": data["providerDisplay"],
                "testsCount": data["testsCount"],
                "avgLatencyMs": avg_lat
            })

        # 11. Recent activities sorted strictly by real database datetime
        recent_prompts = db.query(Prompt).filter(
            Prompt.user_id == user_id
        ).order_by(
            Prompt.created_at.desc()
        ).limit(8).all()

        recent_tests = db.query(PromptTest).filter(
            PromptTest.user_id == user_id
        ).order_by(
            PromptTest.created_at.desc()
        ).limit(8).all()

        combined_activities = []
        for p in recent_prompts:
            dt = p.created_at or datetime.fromtimestamp(0, tz=timezone.utc)
            combined_activities.append((dt, {
                "id": f"act_{p.id}",
                "userId": user_id,
                "type": "create_prompt",
                "title": f'Created "{p.title}"',
                "meta": f"Category: {p.category or 'Coding'}",
                "time": p.created_at.strftime("%b %d, %Y %I:%M %p") if p.created_at else "Date unavailable",
                "icon": "PlusCircle",
                "color": "blue"
            }))

        for t in recent_tests:
            dt = t.created_at or datetime.fromtimestamp(0, tz=timezone.utc)
            combined_activities.append((dt, {
                "id": f"act_{t.id}",
                "userId": user_id,
                "type": "test_prompt",
                "title": f"Tested {t.model}",
                "meta": f"Provider: {t.provider} • Latency: {t.response_time_ms}ms",
                "time": t.created_at.strftime("%b %d, %Y %I:%M %p") if t.created_at else "Date unavailable",
                "icon": "PlayCircle",
                "color": "cyan"
            }))

        # Chronological sort on real datetime objects descending
        combined_activities.sort(key=lambda x: x[0], reverse=True)
        final_activities = [item[1] for item in combined_activities[:8]]

        # 12. Real Continuous Time-Series Daily Activity
        today_date = datetime.now(timezone.utc).date()
        start_date = today_date - timedelta(days=days - 1)

        # Real test counts grouped by DATE(created_at)
        raw_test_counts = db.query(
            func.date(PromptTest.created_at),
            func.count(PromptTest.id)
        ).filter(
            PromptTest.user_id == user_id,
            func.date(PromptTest.created_at) >= start_date,
            func.date(PromptTest.created_at) <= today_date
        ).group_by(
            func.date(PromptTest.created_at)
        ).all()

        tests_by_date: Dict[str, int] = {}
        for r_date, cnt in raw_test_counts:
            d_str = r_date.strftime("%Y-%m-%d") if hasattr(r_date, "strftime") else str(r_date)
            tests_by_date[d_str] = cnt

        # Real prompt version commits grouped by DATE(created_at)
        raw_commit_counts = db.query(
            func.date(PromptVersion.created_at),
            func.count(PromptVersion.id)
        ).join(
            Prompt, PromptVersion.prompt_id == Prompt.id
        ).filter(
            Prompt.user_id == user_id,
            func.date(PromptVersion.created_at) >= start_date,
            func.date(PromptVersion.created_at) <= today_date
        ).group_by(
            func.date(PromptVersion.created_at)
        ).all()

        commits_by_date: Dict[str, int] = {}
        for r_date, cnt in raw_commit_counts:
            d_str = r_date.strftime("%Y-%m-%d") if hasattr(r_date, "strftime") else str(r_date)
            commits_by_date[d_str] = cnt

        daily_activity_list = []
        for i in range(days):
            cur_d = start_date + timedelta(days=i)
            cur_str = cur_d.strftime("%Y-%m-%d")
            # Label format: short weekday for <= 7 days, "Mon DD" for > 7 days
            day_label = cur_d.strftime("%a") if days <= 7 else cur_d.strftime("%b %d")
            t_cnt = tests_by_date.get(cur_str, 0)
            c_cnt = commits_by_date.get(cur_str, 0)
            is_today = (cur_d == today_date)

            daily_activity_list.append({
                "date": cur_str,
                "day": day_label,
                "tests": t_cnt,
                "test_count": t_cnt,
                "commits": c_cnt,
                "isToday": is_today
            })

        return {
            "totalPrompts": total_prompts,
            "totalVersions": total_versions,
            "totalFavorites": total_favorites,
            "totalTested": total_tested,
            "totalCollections": total_collections,
            "avgLatencyMs": avg_latency,
            "avgPromptRating": avg_rating,
            "avgVersionsPerPrompt": avg_versions,
            "categories": categories_list,
            "modelStats": model_stats_list,
            "recentActivities": final_activities,
            "dailyActivity": daily_activity_list
        }

analytics_service = AnalyticsService()
