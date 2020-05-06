const IOTA = require('./iota');

const args = location.search
  .substring(1)
  .split('&')
  .map((s) => ({
    [s.substring(0, s.indexOf('='))]: s.substring(s.indexOf('=')).substring(1),
  }))
  .reduce((acc, v) => ({ ...acc, ...v }), {});

let address;
let index;

if (args.bundle) {
  console.info('Retrieving offer from', args.bundle);
  IOTA.fetchOffer(args.bundle).then((result) => {
    writeToChatLog('Received remote offer', 'text-success');
    console.info('Received remote offer');
    console.debug(result);
    index = Math.floor(result.offer.length * Math.random());
    console.info('Use index', index);
    address = result.address;
    const offerDesc = new RTCSessionDescription(result.offer[index]);
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

pc2.ondatachannel = (e) => {
  const datachannel = e.channel || e; // Chrome sends event, FF sends raw channel
  console.debug('Received datachannel');
  datachannel.onopen = () => {
    writeToChatLog('Datachannel connected', 'text-success');
    console.info('Data channel connect');
  };
  datachannel.onmessage = (e) => {
    console.info('Got message', e.data);
    writeToChatLog(e.data, 'text-info');
    if (e.data === 'ping') {
      const msg = 'pong';
      datachannel.send(msg);
      writeToChatLog(msg, 'text-success');
    }
  };
};

function handleOfferFromPC1(offerDesc) {
  pc2.setRemoteDescription(offerDesc);
  pc2.createAnswer(
    (answerDesc) => {
      writeToChatLog('Created local answer', 'text-success');
      console.debug('Created local answer');
      pc2.setLocalDescription(answerDesc);
    },
    () => {
      console.warn("Couldn't create offer");
    },
    sdpConstraints
  );
}

pc2.onicecandidate = (e) => {
  if (e.candidate == null) {
    const answer = {
      localDescription: pc2.localDescription,
      bundle: args.bundle,
      index,
    };
    IOTA.publishAnswer(answer, address).then((b) => {
      console.debug(b[0].hash);
      writeToChatLog('Published answer', 'text-success');
    });
  }
};

pc2.onconnection = () => {
  console.info('Datachannel connected');
  writeToChatLog('Datachannel connected', 'text-success');
};

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
