const Wreck = require('wreck');
const config = require('../config.js');

const biosyslit = {

    method: 'GET',

    path: '/',

    config: {
        description: "biosyslit",
        tags: ['biosyslit', 'communities', 'api'],
        plugins: {
            'hapi-swagger': {
                order: 1
            }
        },
        validate: {},
        notes: [
            'A community to share publications related to bio-systematics. The goal is to provide open access to publications cited in publications or in combination with scientific names a digital object identifier (DOI) to enable citation of the publications including direct access to its digital representation. For additional search functionality  can be used. This includes also searches in CrossRef, DataCite, PubMed, RefBank, GNUB and Mendeley.',
        ]
    },

    handler: function(request, reply) {
        Wreck.get(config.uri + 'communities/biosyslit', (err, res, payload) => {

            reply(payload).headers = res.headers;
        })
    }
};

module.exports = biosyslit;