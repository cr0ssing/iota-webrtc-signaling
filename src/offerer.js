const intervalAsync = require('set-interval-async');
const setIntervalAsync = intervalAsync.fixed.setIntervalAsync;
const clearIntervalAsync = intervalAsync.clearIntervalAsync;
const $ = require('jquery');
const IOTA = require('./iota');

const cfg = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:numb.viagenie.ca',
      credential: 'muazkh',
      username: 'webrtc@live.com',
    },
  ],
};
const con = { optional: [{ DtlsSrtpKeyAgreement: true }] };

const sdpConstraints = {
  optional: [],
  mandatory: {
    OfferToReceiveAudio: false,
    OfferToReceiveVideo: false,
  },
};

const origin = window.location.protocol + '//' + window.location.host;
const receiverUrl =
  origin +
  location.pathname.substring(0, location.pathname.lastIndexOf('/')) +
  '/receiver.html';

let address;
let interval;
const connections = new Array(5).fill(undefined).map(() => createConnection());
const inits = connections.map((c) => {
  c.createOffer(sdpConstraints).then((offer) => c.setLocalDescription(offer));
  return new Promise((res, rej) => {
    c.onicecandidate = (e) => {
      if (e.candidate == null) {
        res();
      }
    };
  });
});
const processed = [];
const usedIndices = [];

Promise.all(inits).then(() => {
  console.info('Created offers');
  return publishOffer().then(() => waitForAnswers());
});

function createConnection() {
  const c = new RTCPeerConnection(cfg, con);

  c.onconnection = () => {
    console.info('Datachannel connected');
    writeToChatLog('Datachannel connected', 'text-success');
  };
  c.onicecandidateerror = (e) => console.error('ICE candidate error', e);
  c.oniceconnectionstatechange = (state) =>
    console.debug('ice connection state change:', state);
  c.onsignalingstatechange = (state) =>
    console.debug('signaling state change:', state);

  try {
    const dc1 = c.createDataChannel('test', { reliable: true });
    console.debug('Created datachannel');
    dc1.onopen = (e) => {
      writeToChatLog('Datachannel connected', 'text-success');
      console.info('data channel connect');

      const msg = 'ping';
      dc1.send(msg);
      writeToChatLog(msg, 'text-success');
    };
    dc1.onmessage = (e) => {
      console.info('Got message', e.data);
      writeToChatLog(e.data, 'text-info');
    };
    dc1.onerror = (e) => console.error('Data channel error', e);

    return c;
  } catch (e) {
    console.error('No data channel', e);
    throw e;
  }
}

$(document).ready(() => {
  $('#offerRecdBtn').click(() => clearIntervalAsync(interval));
});

function publishOffer() {
  return IOTA.publishOffer(connections.map((c) => c.localDescription)).then(
    (b) => {
      writeToChatLog('Published offers', 'text-success');
      address = b[0].address;
      const link = receiverUrl + '?bundle=' + b[0].hash;
      console.info(link);
      $('#copyLink').val(link);
      $('#link').html(`<a href="${link}" target="_blank">Join</a>`);
    }
  );
}

function waitForAnswers() {
  interval = setIntervalAsync(() => {
    console.debug('Fetching answers...');
    return IOTA.fetchAnswers(address).then((answers) =>
      answers
        .filter((a) => processed.indexOf(a.sdp) === -1)
        .filter((a) => usedIndices.indexOf(a.index) === -1)
        .forEach((msg) => {
          const answerDesc = new RTCSessionDescription(msg.localDescription);
          handleAnswerFromPC2(connections[msg.index], answerDesc);
          processed.push(msg.localDescription.sdp);
          usedIndices.push(msg.index);
        })
    );
  }, 2000);
}

function handleAnswerFromPC2(c, answerDesc) {
  console.info('Received remote answer');
  console.debug(answerDesc);
  writeToChatLog('Received remote answer', 'text-success');
  c.setRemoteDescription(answerDesc);
}

function getTimestamp() {
  var totalSec = new Date().getTime() / 1000;
  var hours = parseInt(totalSec / 3600) % 24;
  var minutes = parseInt(totalSec / 60) % 60;
  var seconds = parseInt(totalSec % 60);

  var result =
    (hours < 10 ? '0' + hours : hours) +
    ':' +
    (minutes < 10 ? '0' + minutes : minutes) +
    ':' +
    (seconds < 10 ? '0' + seconds : seconds);

  return result;
}

function writeToChatLog(message, message_type) {
  document.getElementById('chatlog').innerHTML +=
    '<p class="' +
    message_type +
    '">' +
    '[' +
    getTimestamp() +
    '] ' +
    message +
    '</p>';
}
