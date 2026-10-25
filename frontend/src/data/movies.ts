import type { Movie } from '../types'

// Illustrative catalog copied from the repository's explicitly synthetic sample dataset.
export const demoMovies: Movie[] = [
  { movie_id: 'm001', title: 'Starlight Horizon', genres: 'Sci-Fi|Adventure', overview: 'A lone pilot charts a course through a mysterious nebula to save a stranded colony.', release_year: 2019, vote_average: 7.8 },
  { movie_id: 'm002', title: 'Galactic Outpost', genres: 'Sci-Fi|Thriller', overview: 'An isolated space station becomes ground zero for an unknown signal from beyond.', release_year: 2020, vote_average: 7.5 },
  { movie_id: 'm003', title: 'Orbit of Shadows', genres: 'Sci-Fi|Mystery', overview: 'Engineers discover time loops affecting the stationâ€™s orbit and their memories.', release_year: 2021, vote_average: 7.7 },
  { movie_id: 'm004', title: 'Crimson Trail', genres: 'Action|Western', overview: 'A former lawman rides across hostile territory to bring a fugitive to justice.', release_year: 2018, vote_average: 7.6 },
  { movie_id: 'm005', title: 'Desert Vengeance', genres: 'Action|Western|Drama', overview: 'Outnumbered and wounded, a ranger must survive a storm of bullets in the badlands.', release_year: 2017, vote_average: 7.9 },
  { movie_id: 'm006', title: 'Iron Border', genres: 'Action|Drama', overview: 'A border town patrol faces impossible choices when tensions escalate beyond control.', release_year: 2019, vote_average: 7.4 },
  { movie_id: 'm007', title: 'Midnight Serenade', genres: 'Romance|Drama', overview: 'Two strangers meet by chance at a coastal concert and rewrite their futures.', release_year: 2020, vote_average: 7.3 },
  { movie_id: 'm008', title: 'Seaside Letters', genres: 'Romance', overview: 'A bookshop owner and a visiting poet fall in love over exchanged letters.', release_year: 2016, vote_average: 7.8 },
  { movie_id: 'm009', title: 'Candlelight in Paris', genres: 'Romance|Comedy', overview: 'A series of mishaps leads to an unexpected romance in the streets of Paris.', release_year: 2018, vote_average: 7.6 },
  { movie_id: 'm010', title: 'Shattered Echoes', genres: 'Thriller|Mystery', overview: 'A journalist uncovers a cover-up while investigating cold case files.', release_year: 2019, vote_average: 7.9 },
  { movie_id: 'm011', title: 'The Locked Room', genres: 'Thriller', overview: 'Trapped during a storm, guests in a remote lodge realize someone is playing a deadly game.', release_year: 2021, vote_average: 7.7 },
  { movie_id: 'm012', title: 'Nocturne Files', genres: 'Thriller|Crime', overview: 'Detectives piece together clues from a string of cryptic notes left at crime scenes.', release_year: 2017, vote_average: 7.8 },
  { movie_id: 'm013', title: 'Jungle Reckoning', genres: 'Adventure|Action', overview: 'An expedition into uncharted jungle uncovers both treasure and a forgotten tribe.', release_year: 2016, vote_average: 7.5 },
  { movie_id: 'm014', title: 'Peak Peril', genres: 'Adventure|Thriller', overview: 'A rescue team races against weather to save climbers trapped near a stormy summit.', release_year: 2020, vote_average: 7.6 },
  { movie_id: 'm015', title: 'River of Secrets', genres: 'Adventure|Mystery', overview: 'Explorers follow old maps and discover secrets hidden beneath a remote river valley.', release_year: 2019, vote_average: 7.4 },
  { movie_id: 'm016', title: 'Laugh Riot', genres: 'Comedy', overview: 'A well-meaning but accident-prone crew causes chaos during a small-town festival.', release_year: 2018, vote_average: 7.2 },
  { movie_id: 'm017', title: 'Family Mixup', genres: 'Comedy|Family', overview: 'Two families accidentally switch houses for a weekend and learn what matters most.', release_year: 2017, vote_average: 7.3 },
  { movie_id: 'm018', title: 'The Great Bake-Off', genres: 'Comedy|Romance', overview: 'Rival bakers compete in a contest where flour, rivalry, and romance collide.', release_year: 2021, vote_average: 7.4 },
  { movie_id: 'm019', title: 'Haunted Harbor', genres: 'Thriller|Mystery', overview: 'A coastal townâ€™s lighthouse keeps secrets that resurface with the returning tide.', release_year: 2018, vote_average: 7.7 },
  { movie_id: 'm020', title: 'Starborn Legacy', genres: 'Sci-Fi|Drama', overview: 'The last generation of a space-faring people must choose between exile and hope.', release_year: 2022, vote_average: 8.0 },
]

export const genres = ['All films', 'Sci-Fi', 'Thriller', 'Adventure', 'Mystery', 'Drama', 'Romance', 'Action', 'Comedy']

export const posterThemes: Record<string, string> = {
  'Sci-Fi': 'cosmic', Adventure: 'wild', Thriller: 'noir', Mystery: 'noir',
  Romance: 'rose', Comedy: 'gold', Action: 'ember', Drama: 'blue',
  Western: 'sand', Crime: 'noir', Family: 'gold',
}
