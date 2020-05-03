const IOTA = require('./iota');

const args = location.search
  .substring(1)
  .split('&')
  .map((s) => ({
    [s.substring(0, s.indexOf('='))]: s.substring(s.indexOf('=')).substring(1),
  }))
  .reduce((acc, v) => ({ ...acc, ...v }), {});

let address;

if (args.bundle) {
  console.log('Retrieving offer from', args.bundle);
  IOTA.fetchOffer(args.bundle).then((result) => {
    address = result.address;
    var offerDesc = new RTCSessionDescription(result.offer);
    console.log('Received remote offer', offerDesc);
    writeToChatLog('Received remote offer', 'text-success');
    handleOfferFromPC1(offerDesc);
  });
}

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

var pc2 = new RTCPeerConnection(cfg, con);
let dc2 = null;

pc2.ondatachannel = function (e) {
  var datachannel = e.channel || e; // Chrome sends event, FF sends raw channel
  console.log('Received datachannel (pc2)', arguments);
  dc2 = datachannel;
  dc2.onopen = function (e) {
    writeToChatLog('Datachannel connected', 'text-success');
    console.log('data channel connect');
  };
  dc2.onmessage = function (e) {
    console.log('Got message (pc2)', e.data);
    writeToChatLog(e.data, 'text-info');
    if (e.data === 'ping') {
      const msg = 'pong';
      dc2.send(msg);
      writeToChatLog(msg, 'text-success');
    }
  };
};

function handleOfferFromPC1(offerDesc) {
  pc2.setRemoteDescription(offerDesc);
  pc2.createAnswer(
    function (answerDesc) {
      writeToChatLog('Created local answer', 'text-success');
      console.log('Created local answer: ', answerDesc);
      pc2.setLocalDescription(answerDesc);
    },
    function () {
      console.warn("Couldn't create offer");
    },
    sdpConstraints
  );
}

pc2.onicecandidate = function (e) {
  // console.log('ICE candidate (pc2)', e);
  if (e.candidate == null) {
    console.log(JSON.stringify(pc2.localDescription));
    IOTA.publishAnswer(pc2.localDescription, address).then((b) => {
      console.log(b[0].hash);
      writeToChatLog('Published answer', 'text-success');
    });
  }
};

function onsignalingstatechange(state) {
  console.info('signaling state change:', state);
}

function oniceconnectionstatechange(state) {
  console.info('ice connection state change:', state);
}

function onicegatheringstatechange(state) {
  console.info('ice gathering state change:', state);
}

pc2.onsignalingstatechange = onsignalingstatechange;
pc2.oniceconnectionstatechange = oniceconnectionstatechange;
pc2.onicegatheringstatechange = onicegatheringstatechange;

function handleCandidateFromPC1(iceCandidate) {
  pc2.addIceCandidate(iceCandidate);
}

function handleOnconnection() {
  console.log('Datachannel connected');
  writeToChatLog('Datachannel connected', 'text-success');
}

pc2.onconnection = handleOnconnection;

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
