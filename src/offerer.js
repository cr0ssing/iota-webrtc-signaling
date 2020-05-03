const intervalAsync = require('set-interval-async');
const setIntervalAsync = intervalAsync.fixed.setIntervalAsync; // SetIntervalAsync.fixed.setIntervalAsync;
const clearIntervalAsync = intervalAsync.clearIntervalAsync; // SetIntervalAsync.clearIntervalAsync;
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

/* THIS IS ALICE, THE CALLER/SENDER */

let address;
let interval;
const connected = [];

const pc1 = createConnection();
pc1.createOffer(
  function (desc) {
    mainDesc = desc;
    pc1.setLocalDescription(
      desc,
      function () {},
      function () {}
    );
    console.info('created first offer', desc);
  },
  function () {
    console.warn("Couldn't create first offer");
  },
  sdpConstraints
);
let current = pc1;

function createConnection() {
  const c = new RTCPeerConnection(cfg, con);

  c.onconnection = function handleOnconnection() {
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
    dc1.onopen = function (e) {
      writeToChatLog('Datachannel connected', 'text-success');
      console.info('data channel connect');

      const msg = 'ping';
      dc1.send(msg);
      writeToChatLog(msg, 'text-success');
    };
    dc1.onmessage = function (e) {
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

$('#offerRecdBtn').click(function () {
  clearIntervalAsync(interval);
});

function publishOffer(c) {
  console.debug(JSON.stringify(c.localDescription));
  return IOTA.publishOffer(c.localDescription).then((b) => {
    writeToChatLog('Published offer', 'text-success');
    address = b[0].address;
    const link = receiverUrl + '?bundle=' + b[0].hash;
    console.info(link);
    $('#copyLink').val(link);
    $('#link').html(`<a href="${link}" target="_blank">Join</a>`);
  });
}

pc1.onicecandidate = function (e) {
  if (e.candidate == null) {
    publishOffer(pc1).then(() => {
      interval = setIntervalAsync(() => {
        console.debug('Fetching answers...');
        return IOTA.fetchAnswers(address).then((answers) =>
          Promise.all(
            answers
              .filter((a) => connected.indexOf(a.sdp) === -1)
              .map((answer) => {
                if (current) {
                  var answerDesc = new RTCSessionDescription(answer);
                  handleAnswerFromPC2(current, answerDesc);
                  current = null;
                  const c = createConnection();
                  connected.push(answer.sdp);
                  c.onicecandidate = (e) => {
                    if (e.candidate == null) {
                      publishOffer(c);
                    }
                  };
                  return c.createOffer(
                    function (desc) {
                      current = c;
                      c.setLocalDescription(
                        desc,
                        function () {},
                        function () {}
                      );
                      console.info('created local offer', desc);
                    },
                    function () {
                      console.warn("Couldn't create offer");
                    },
                    sdpConstraints
                  );
                }
                // clearIntervalAsync(interval);
              })
          )
        );
      }, 2000);
    });
  }
};

function handleAnswerFromPC2(c, answerDesc) {
  console.info('Received remote answer: ', answerDesc);
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
