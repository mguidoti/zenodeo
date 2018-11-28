const Crypto = require('crypto');
const Joi = require('joi');
const ResponseMessages = require('../response-messages');
const Config = require('../../config.js');

const find = function(pattern, source) {
    const re = new RegExp(`^${pattern}`, 'i');
    const res = data[source].filter(function(element) {
        return (element.search(re) > -1)
    });
    return(res);
};

const data = {
    authors: require('../../data/authors.js'),
    taxa: require('../../data/taxa.min.js'),
    families: require('../../data/families.min.js'),
    keywords: require('../../data/keywords.js')
};

const utils = {
    createCacheKey: function(str) {
        return Crypto
            .createHash('md5')
            .update(str.toLowerCase(), 'utf8')
            .digest('hex');
    },

    updateCache: async function(cache, cacheKey, result) {

        const r = await result;
    
        // getResult succeeded
        if (cache.getSync(cacheKey)) {
                
            // delete old cached value and 
            // cache the new result
            cache.deleteSync(cacheKey);
            cache.putSync(cacheKey, r);
        }
        else {
    
            // no result in cache so nothing 
            // to delete
            cache.putSync(cacheKey, r);
        }
    },

    cache: function(name) {
        return require('persistent-cache')({
            base: Config.cacheBase,
            name: name
        })
    },

    facets: function(facet) {
        return {

            method: 'GET',
            path: `/${facet}/{term?}`,
            handler: function (request, h) {
                if (request.params.term) {
                    
                    return find(request.params.term, facet);
                }
            },
            config: {
                description: `retrieve all ${facet} starting with the provided letters`,
                tags: [facet, 'api'],
                plugins: {
                    'hapi-swagger': {
                        order: 2,
                        responseMessages: ResponseMessages
                    }
                },
                validate: {
                    params: {
                        term: Joi.string()
                    }
                },
                notes: [
                    `This route fetches ${facet} matching the search term (the portion after /${facet}/ in the URI).`
                ]
            }
        };
    },

    errorMsg: {
        "data": [],
        "error": "nothing found"
    },

    jsonHeader: "application/json"
};

module.exports = utils;