const Package = require('./package.json');

const config = {
    uri: 'https://zenodo.org/api/',
    port: 3030,
    info: {
        title: "Zenodeo API documentation for BLR",
        version: "1.6.1",
        description: Package.description,
        termsOfService: "/tos",
        contact: {
            name: Package.author,
            url: "https://punkish.org/About",
            email: "punkish@plazi.org"
        },
        license: {
            name: "CC0 Public Domain Dedication",
            url: "https://creativecommons.org/publicdomain/zero/1.0/legalcode"
        }
    },
    cacheBase: '/home/punkish/tmp/zenodeoCache'
};

module.exports = config;