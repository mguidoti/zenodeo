const Schema = require('../schema.js');
const ResponseMessages = require('../../responseMessages');
const Database = require('better-sqlite3');
const config = require('config');
const db = new Database(config.get('data.treatments'));
const fs = require('fs');
const Utils = require('../utils');

module.exports = {

    plugin: {
        name: 'treatments2',
        register: function(server, options) {

            const treatmentsCache = server.cache({
                cache: options.cacheName,
                expiresIn: options.expiresIn,
                generateTimeout: options.generateTimeout,
                segment: 'treatments2', 
                generateFunc: async (query) => { return await getTreatments(query) },
                getDecoratedValue: options.getDecoratedValue
            });

            // binds treatmentsCache to every route registered  
            // **within this plugin** after this line
            server.bind({ treatmentsCache });

            server.route([
                { 
                    path: '/treatments', 
                    method: 'GET', 
                    config: {
                        description: "Retrieve treatments",
                        tags: ['treatments', 'api'],
                        plugins: {
                            'hapi-swagger': {
                                order: 3,
                                responseMessages: ResponseMessages
                            }
                        },
                        //validate: Schema.treatments,
                        notes: [
                            'A taxonomic treatment.',
                        ]
                    },
                    handler 
                }
            ]);
        },
    },
};

const getStats = function(taxon) {

    let cols = [];
    let vals = [];

    for (let col in taxon) {

        vals.push( taxon[col] )

        // we add double quotes to 'order' otherwise the 
        // sql statement would choke since order is a  
        // reserved word
        if (col === 'order') col = '"order"';
        cols.push(col + ' = ?');

    }

    const select = `SELECT Count(*) AS num FROM treatments WHERE ${cols.join(' AND ')}`;
    //console.log(select);
    return db.prepare(select).get(vals)

    
};

const getOneTreatment = async function(qryObj) {
    const one = qryObj.treatmentId.substr(0, 1);
    const two = qryObj.treatmentId.substr(0, 2);
    const thr = qryObj.treatmentId.substr(0, 3);

    const xml = fs.readFileSync(
        `data/treatments/${one}/${two}/${thr}/${qryObj.treatmentId}.xml`,
        'utf8'
    )

    if (qryObj.format === 'xml') {
        return xml;
    }
    else {
        let selectTreatments = 'SELECT * FROM treatments WHERE treatmentId = ?';
        let data = db.prepare(selectTreatments).get(qryObj.treatmentId);

        const selectMaterialCitations = "SELECT treatmentId, typeStatus, latitude, longitude FROM materialsCitations WHERE latitude != '' AND longitude != '' AND treatmentId = ?";

        const mcData = db.prepare(selectMaterialCitations).all(qryObj.treatmentId);

        if (mcData.length) {
            data.materialsCitations = mcData
        }

        data.images = await Utils.getImages(qryObj.treatmentId);
        data.xml = xml;

        const taxonStats = {
            kingdom: { 
                qryObj: {
                    kingdom: data.kingdom
                },
                num: 0
            },
            phylum: {
                qryObj: {
                    kingdom: data.kingdom,
                    phylum: data.phylum
                },
                num: 0,
            },
            order: {
                qryObj: {
                    kingdom: data.kingdom,
                    phylum: data.phylum,
                    order: data.order
                },
                num: 0
            },
            family: {
                qryObj: {
                    kingdom: data.kingdom,
                    phylum: data.phylum,
                    order: data.order,
                    family: data.family
                },
                num: 0
            },
            genus: {
                qryObj: {
                    kingdom: data.kingdom,
                    phylum: data.phylum,
                    order: data.order,
                    family: data.family,
                    genus: data.genus
                },
                num: 0
            },
            species: {
                qryObj: {
                    kingdom: data.kingdom,
                    phylum: data.phylum,
                    order: data.order,
                    family: data.family,
                    genus: data.genus,
                    species: data.species
                },
                num: 0
            }
        };

        for (let t in taxonStats) {
            taxonStats[t].num = getStats(taxonStats[t].qryObj);
        }

        data.taxonStats = taxonStats;
        
        return data
    }
};

const getTreatments = async function(query) {

    qryObj = {};
    query.split('&').forEach(el => { a = el.split('='); qryObj[ a[0] ] = a[1]; })

    
    // There are three kinds of possible queries for treatments
    //
    // 1. A 'treatmentId' is present. The query is for a specific
    // treatment. All other query params are ignored

    if (qryObj.treatmentId) {
        return await getOneTreatment(qryObj);
    }

    
    // 2. The param 'q' is present. The query is a fullText query.
    // There could be other optional params to narrow the result.
    else if (qryObj.q) {

        const selectTreatments = `SELECT t.treatmentTitle, v.treatmentId, snippet(v.vtreatments, 1, '<b>', '</b>', '', 50) s 
        FROM treatments t JOIN vtreatments v ON t.treatmentId = v.treatmentId 
        WHERE vtreatments MATCH ?`;
        console.log(selectTreatments)
        return db.prepare(selectTreatments).all(qryObj.q);
    }

    // 3. 'lat' and 'lon' are present in the query string, so 
    // this is a location query. A location query is performed 
    // against the 'materialcitations' table
    else if (qryObj.lat && qryObj.lon) {

        const selectTreatments = 'SELECT * FROM materialsCitations WHERE latitude = ? AND longitude = ?'
        console.log(selectTreatments)
        return db.prepare(selectTreatments).all(qryObj.lat, qryObj.lon)
        
    }

    // 4. Neither the 'treatmentId' nor 'q' are present. The query 
    // A standard SQL query is performed against the treatments 
    // database 
    else {

        let cols = [];
        let vals = [];

        for (let col in qryObj) {

            vals.push( qryObj[col] )

            // we add double quotes to 'order' otherwise the 
            // sql statement would choke since order is a  
            // reserved word
            if (col === 'order') col = '"order"';
            cols.push(col + ' = ?');

        }

        const selectTreatments = `SELECT treatmentId, treatmentTitle, journalTitle || ', ' || journalYear || ', ' || pages || ', ' || journalVolume || ', ' || journalIssue AS s FROM treatments WHERE ${cols.join(' AND ')} LIMIT 30`;
        return db.prepare(selectTreatments).all(vals)
        
    }

}

const handler = function(request, h) {

    // remove 'refreshCache' from the query params and make the 
    // queryString into a standard form (all params sorted) so
    // it can be used as a cachekey
    let arr = [];

    for (let k in request.query) {
        if (k !== 'refreshCache') {
            arr.push(k + '=' + request.query[k])
        }
    }

    const query = arr.sort().join('&');

    if (request.query.refreshCache === 'true') {
        console.log('forcing refreshCache')
        this.treatmentsCache.drop(query);
    }

    return this.treatmentsCache.get(query);
    
};