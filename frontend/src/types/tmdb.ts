export type TMDBMovie = {
  id: number;
  tmdb_id: number;
  title: string;
  overview: string | null;
  poster_path: string | null;
  poster_url: string | null;
  backdrop_path: string | null;
  backdrop_url: string | null;
  genres: string | null;
  genre_ids: number[] | null;
  release_date: string | null;
  release_year: number | null;
  vote_average: number | null;
  vote_count: number | null;
  source: 'tmdb';
};

export type TMDBCatalogResponse = {
  page: number;
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
  source: 'tmdb';
  configured: boolean;
};

export type TMDBStatus = {
  configured: boolean;
  message: string;
};

export type TMDBVideo = {
  title: string;
  site: string;
  key: string;
  type: string;
  official: boolean;
};

export type TMDBVideosResponse = {
  tmdb_movie_id: number;
  results: TMDBVideo[];
};

export type TMDBWatchProvider = {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority: number | null;
};

export type TMDBWatchAvailability = {
  flatrate: TMDBWatchProvider[];
  free: TMDBWatchProvider[];
  ads: TMDBWatchProvider[];
  rent: TMDBWatchProvider[];
  buy: TMDBWatchProvider[];
};

export type TMDBWatchProvidersResponse = {
  tmdb_movie_id: number;
  region: string;
  link: string | null;
  availability: TMDBWatchAvailability | null;
  source: 'JustWatch';
};

export type TMDBCountry = {
  iso_3166_1: string;
  english_name: string;
  native_name: string;
};
