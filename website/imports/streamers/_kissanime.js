import Cheerio from 'cheerio';
import ScrapingHelpers from "./scrapingHelpers";
import {Shows} from '../api/shows/shows';

function cleanName(name) {
  return name.replace(/ \(Dub\)$/, '').replace(/ \(Sub\)$/, '');
}

function getTypeFromName(name) {
  return name.endsWith(' (Dub)') ? 'dub' : 'sub';
}

function determineAiringDateShowPage(partial, index) {
  return ScrapingHelpers.buildAiringDateFromStandardStrings(
    undefined,
    index,
    partial.find('div.bigBarContainer div.barContent div:nth-of-type(2) p:has(span:contains("Date aired:"))').text().replace('Date aired:', '').split(' to '),
    undefined,
    undefined,
    undefined
  );
}

function getEpisodeData(episodeString, showString) {
  // Object for return values
  let infoObject = {
    start: false,
    end: false
  };

  // Remove the show title and turn into a cleaned array
  let episodeArray = episodeString.replace(showString + ' - ', '').cleanWhitespace().split(' ');
  if (episodeArray[0] === 'Episode' || episodeArray[0] === '_Episode') {
    episodeArray.shift();
  }

  // Stop if it still starts with an underscore
  if (episodeArray[0] && episodeArray[0].startsWith('_')) {
    return false;
  }

  // Try to extract episode numbers
  if (isNumeric(episodeArray[0])) {
    infoObject.start = episodeArray.shift();
    if (episodeArray[0] === '-' && isNumeric(episodeArray[1])) {
      episodeArray.shift();
      infoObject.end = episodeArray.shift();
    } else {
      infoObject.end = infoObject.start;
    }
  }

  // Clean and set the notes
  if (episodeArray[0] !== '-') {
    if (validTypes.includes(episodeArray[0])) {
      episodeArray.shift();
    }
    infoObject.notes = episodeArray.join(' ').replaceFull('[Censored]', '').replaceFull('[Uncensored]', 'Uncensored');
  }

  // Done
  return infoObject;
}

const validTypes = ['OVA', 'Movie', 'Special', 'ONA'];
const validGenres = ['Action', 'Adventure', 'Cars', 'Comedy', 'Dementia', 'Demons', 'Mystery', 'Drama', 'Ecchi',
  'Fantasy', 'Game', 'Historical', 'Horror', 'Kids', 'Magic', 'Martial Arts', 'Mecha', 'Music', 'Parody', 'Samurai',
  'Romance', 'School', 'Sci-Fi', 'Shoujo', 'Shoujo Ai', 'Shounen', 'Shounen Ai', 'Space', 'Sports', 'Super Power',
  'Vampire', 'Yaoi', 'Yuri', 'Harem', 'Slice of Life', 'Supernatural', 'Military', 'Police', 'Psychological',
  'Thriller', 'Seinen', 'Josei', 'Isekai'];

export let kissanime = {
  // General data
  id: 'kissanime',
  name: 'KissAnime',
  homepage: 'https://kissanime.fr',
  recentPage: 'https://kissanime.fr/kissanime.html',
  minimalPageTypes: ['sub', 'dub'],

  // Search page data
  search: {
    createUrl: function(search) {
      let sortPage = '';
      if (search.sortDirection === -1 && search.sortBy === 'Latest Update') {
        sortPage = '/LatestUpdate';
      }

      if (search.query) {
        return kissanime.homepage + '/Search/?s=' + encodeURIComponentReplaceSpaces(search.completeQuery(2, search.query), '+');
      }

      else if (search.getSingleType(validTypes)) {
        return kissanime.homepage + '/Genre/' + search.getSingleType(validTypes) + sortPage;
      }

      else if (search.getSingleGenre(validGenres)) {
        return kissanime.homepage + '/Genre/' + search.getSingleGenre(validGenres).replace(/\s/g, '-') + sortPage;
      }

      else {
        return kissanime.homepage + '/AnimeList' + sortPage;
      }
    },
    rowSelector: 'div.title_in_cat_container',

    // Search page attribute data
    attributes: {
      streamerUrls: function(partial, full) {
        let element = Cheerio.load(partial.attr('title'));
        return [{
          type: getTypeFromName(element('div a').text()),
          url: element('div a').attr('href')
        }];
      },
      name: function(partial, full) {
        let element = Cheerio.load(partial.attr('title'));
        return cleanName(element('div a').text());
      },
      altNames: function(partial, full) {
        let element = Cheerio.load(partial.attr('title'));
        return [cleanName(element('div a').attr('data-jtitle'))];
      },
      description: function(partial, full) {
        let element = Cheerio.load(partial.attr('title'));
        return ScrapingHelpers.replaceDescriptionCutoff(element('div p:last-of-type').html(), '...');
      },
    },

    // Search page thumbnail data
    thumbnails: {
      rowSelector: '',
      getUrl: function (partial, full) {
        let element = Cheerio.load(partial.attr('title'));
        return element('img').attr('src');
      },
    },
  },

  // Show page data
  show: {
    checkIfPage: function(page) {
      return page('title').text().cleanWhitespace().match(/^.* anime \| Watch .* anime online in high quality$/);
    },

    // Show page attribute data
    attributes: {
      streamerUrls: function(partial, full) {
        return [{
          type: getTypeFromName(partial.find('strong.bigChar').text()),
          url: partial.find('link[rel=canonical]').attr('href')
        }];
      },
      name: function(partial, full) {
        return cleanName(partial.find('strong.bigChar').text());
      },
      altNames: function(partial, full) {
        return partial.find('div.bigBarContainer div.barContent div:nth-of-type(2) p:has(span:contains("Other name:")) a').map((index, element) => {
          return partial.find(element).text();
        }).get();
      },
      description: function(partial, full) {
        return partial.find('div.bigBarContainer div.barContent div.summary p').html();
      },
      type: function(partial, full) {
        let genres = partial.find('div.bigBarContainer div.barContent div:nth-of-type(2) p:has(span:contains("Genres:")) a').map((index, element) => {
          return partial.find(element).text();
        }).get();
        return Shows.validTypes.find((type) => {
          return genres.includes(type);
        });
      },
      genres: function(partial, full) {
        return partial.find('div.bigBarContainer div.barContent div:nth-of-type(2) p:has(span:contains("Genres:")) a').map((index, element) => {
          return partial.find(element).text().replace('Of', 'of');
        }).get().filter((genre) => {
          return !Shows.validTypes.includes(genre) && genre !== 'Dub' && genre !== 'Cartoon' && genre !== 'Animation';
        });
      },
      airedStart: function(partial, full) {
        return determineAiringDateShowPage(partial, 0);
      },
      airedEnd: function(partial, full) {
        return determineAiringDateShowPage(partial, 1);
      },
      episodeCount: function(partial, full) {
        if (partial.find('div.bigBarContainer div.barContent div:nth-of-type(2) p:has(span:contains("Status:"))').text().includes('Completed')) {
          let link = partial.find('div#rightside div:nth-of-type(3) div.barContent div:nth-of-type(2) a:last-of-type');
          if (link.attr('href') && link.attr('href').count('/') === 3) {
            return link.text().split(' ').pop() - 1;
          }
        }
        return undefined;
      },
    },

    // Show page thumbnail data
    thumbnails: {
      rowSelector: 'div.rightBox div.barContent div.a_center img',
      getUrl: function (partial, full) {
        return partial.attr('src');
      },
    },
  },

  // Related shows data
  showRelated: {
    rowSelector: 'div#rightside div:nth-of-type(3) div.barContent div:nth-of-type(2) a:not([title])',

    // Related shows attribute data
    attributes: {
      streamerUrls: function(partial, full) {
        return [{
          type: getTypeFromName(partial.text()),
          url: kissanime.homepage + partial.attr('href')
        }];
      },
      name: function(partial, full) {
        return cleanName(partial.text());
      },
    },
  },

  // Episode list data
  showEpisodes: {
    rowSelector: 'div.listing > div:has(a)',
    cannotCount: true,

    // Episode list attribute data
    attributes: {
      episodeNumStart: function(partial, full) {
        return getEpisodeData(partial.find('a').text(), full.find('strong.bigChar').text()).start;
      },
      episodeNumEnd: function(partial, full) {
        return getEpisodeData(partial.find('a').text(), full.find('strong.bigChar').text()).end;
      },
      notes: function(partial, full) {
        return getEpisodeData(partial.find('a').text(), full.find('strong.bigChar').text()).notes;
      },
      translationType: function(partial, full) {
        return getTypeFromName(full.find('strong.bigChar').text());
      },
      sources: function(partial, full) {
        let sourceUrl = partial.find('a').attr('href');
        let dateBits = partial.find('div:last-of-type').text().split('/');
        let uploadDate = {
          year: dateBits[2],
          month: dateBits[0] - 1,
          date: dateBits[1]
        };
        return [{
          sourceName: 'Gserver',
          sourceUrl: sourceUrl + '&s=gserver',
          uploadDate: uploadDate
        }, {
          sourceName: 'Oserver',
          sourceUrl: sourceUrl + '&s=oserver',
          uploadDate: uploadDate
        }, {
          sourceName: 'Hserver',
          sourceUrl: sourceUrl + '&s=hserver',
          uploadDate: uploadDate
        }];
      },
    },
  },

  // Recent page data
  recent: {
    rowSelector: 'div.bigBarContainer div.barContent div.scrollable div.items div a',

    // Recent episode attribute data
    attributes: {
      episodeNumStart: function(partial, full) {
        return getEpisodeData(partial.find('span').text(), partial.clone().children().remove().end().text()).start;
      },
      episodeNumEnd: function(partial, full) {
        return getEpisodeData(partial.find('span').text(), partial.clone().children().remove().end().text()).end;
      },
      notes: function(partial, full) {
        return getEpisodeData(partial.find('span').text(), partial.clone().children().remove().end().text()).notes;
      },
      translationType: function(partial, full) {
        return getTypeFromName(partial.clone().children().remove().end().text());
      },
    },
  },

  // Recent show data
  recentShow: {
    // Recent show attribute data
    attributes: {
      streamerUrls: function(partial, full) {
        return [{
          type: getTypeFromName(partial.clone().children().remove().end().text()),
          url: kissanime.homepage + '/' + partial.attr('href')
        }];
      },
      name: function(partial, full) {
        return cleanName(partial.clone().children().remove().end().text());
      },
    },

    // Recent show thumbnail data
    thumbnails: {
      rowSelector: 'img',
      getUrl: function (partial, full) {
        return partial.attr('src') || partial.attr('srctemp');
      },
    },
  },
};
