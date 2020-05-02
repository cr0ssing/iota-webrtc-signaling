const iota = require('@iota/core');
const converter = require('@iota/converter');
const TX_LENGTH = require('@iota/transaction').TRANSACTION_LENGTH / 3;
const prepareTransfers = iota.createPrepareTransfers();

const OFFER_TAG = 'A99999999999999999999999999';
const ANSWER_TAG = 'B99999999999999999999999999';

module.exports.publishOffer = async function (offer) {
  return await publish(offer, generateSeed(), OFFER_TAG);
};

module.exports.publishAnswer = async function (answer, address) {
  return await publish(answer, address, ANSWER_TAG);
};

module.exports.fetchOffer = async function (bundleHash) {
  const client = getClient();
  const bundle = await client.getBundle(bundleHash);
  return { offer: extractData(bundle), address: bundle[0].address };
};

module.exports.fetchAnswers = async function (address) {
  const client = getClient();
  const hashes = await client.findTransactions({
    addresses: [address],
    // tags: [ANSWER_TAG],
  });
  const response = await client.getTransactionObjects(hashes);

  let bundles = response
    .filter((tx) => tx.tag === ANSWER_TAG)
    .filter((tx) => tx.address === address)
    .reduce((acc, v) => {
      if (Object.keys(acc).includes(v.bundle)) {
        acc[v.bundle].push(v);
      } else {
        acc[v.bundle] = [v];
      }
      return acc;
    }, {});

  bundles = Object.keys(bundles).map((k) => bundles[k]);
  bundles.forEach((b) => b.sort((a, b) => a.currentIndex - b.currentIndex));

  return bundles.map(extractData);
};

function extractData(txs) {
  const trytes = txs
    .map((t) => t.signatureMessageFragment)
    .reduce((acc, v) => acc + v, '');
  const json = trytesToString(trytes);
  return JSON.parse(json);
}

function getClient() {
  return iota.composeAPI({
    provider: 'https://nodes.comnet.thetangle.org:443',
  });
}

async function publish(data, address, tag) {
  const message = converter.asciiToTrytes(JSON.stringify(data));

  const transfers = [];
  for (let i = 0; i < Math.ceil(message.length / TX_LENGTH); i++) {
    transfers.push({
      address,
      value: 0,
      message: message.slice(i * TX_LENGTH, (i + 1) * TX_LENGTH),
      tag,
    });
  }
  const client = getClient();
  const trytes = await prepareTransfers('9'.repeat(81), transfers);

  return await client.sendTrytes(trytes, 3, 10);
}

function trytesToString(input) {
  if (input.length % 2) {
    input += '9';
  }
  return Array.from(converter.trytesToAscii(input))
    .filter((value) => value.charCodeAt(0) !== 0)
    .join('');
}

function generateSeed(length = 81) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ9';
  let retVal = [81];
  for (let i = 0, n = charset.length; i < length; ++i) {
    retVal[i] = charset.charAt(Math.floor(Math.random() * n));
  }
  let result = retVal.join('');
  return result;
}
