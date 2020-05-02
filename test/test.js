const iota = require('../src/iota');
const json = require('./testOffer');
iota.publishOffer(json)
    .then(bundle => iota.fetchOffer(bundle[0].hash))
    .then(result => {
        console.log(result);
        return iota.publishAnswer(json, result.address);
    })
    .then(result => iota.fetchAnswers(result[0].address))
    .then(answers => answers.forEach(answer => {
        console.log(answer);
    }));