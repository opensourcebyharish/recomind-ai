"""Demo script showing content-based recommendations using the synthetic dataset."""

from __future__ import annotations

from pathlib import Path

from ml.recommender.content_based import ContentBasedRecommender


def main() -> None:
    project_root = Path(__file__).resolve().parents[1]
    csv_path = project_root / "data" / "raw" / "sample_movies.csv"

    recommender = ContentBasedRecommender().fit_from_csv(str(csv_path))
    source_id = "m001"  # Starlight Horizon
    source = recommender.get_movie_by_id(source_id)

    print("RecoMind AI â€” Content-Based Recommendation Demo (Synthetic Dataset)")
    print("=" * 70)
    print(f"Source movie:")
    print(f"  ID: {source['movie_id']}")
    print(f"  Title: {source['title']}")
    print(f"  Genres: {source['genres']}")
    print(f"  Year: {source['release_year']}")
    print(f"  Vote Average: {source['vote_average']}")
    print(f"  Overview: {source['overview']}")
    print()
    print("Top 5 recommendations (ranked by cosine similarity on TF-IDF features):")
    print("-" * 70)

    recommendations = recommender.recommend_similar(source_id, top_n=5)
    for i, rec in enumerate(recommendations, start=1):
        print(f"{i}. [{rec.movie_id}] {rec.title} ({rec.release_year}) â€” "
              f"Genres: {rec.genres} â€” Vote: {rec.vote_average} â€” "
              f"Similarity: {rec.similarity_score:.4f}")
        print(f"   Why: {rec.explanation}")
        print()

    print("Notes:")
    print("- Similarity scores are from TF-IDF + cosine similarity (content features).")
    print("- They are NOT predicted user ratings/preferences from collaborative filtering.")
    print("- Rankings are deterministic for the same input.")


if __name__ == "__main__":
    main()
