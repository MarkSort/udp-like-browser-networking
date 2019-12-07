// section 1.1 start
const apiPort = 8080
const baseUrl = `${window.location.protocol}//${window.location.hostname}:${apiPort}/`

function connect() {
  fetch(`${baseUrl}get-offer`)
    .then(function(response) {
      return response.json()
    })
    .then(sendAnswer)
}
connect()
// section 1.1 end

// section 2.1 start
let peerConnection

function sendAnswer(offer) {
  // 1. Create the client side PeerConnection
  peerConnection = new RTCPeerConnection()
  const clientId = offer.clientId

  // 2. Set the offer on the PeerConnection
  peerConnection.setRemoteDescription(
    { type: 'offer', sdp: offer.sdp }
  ).then(function() {
    // 3. Create an answer to send to the Server
    peerConnection.createAnswer().then(function(answer) {
      // 4. Set the answer on the PeerConnection
      peerConnection.setLocalDescription(answer).then(function() {
        // 5. Send the answer to the server
        fetch(`${baseUrl}send-answer-get-candidate`, {
          method: 'POST',
          body: JSON.stringify({clientId, sdp: answer.sdp})
        })
          .then(function(response) {
            return response.json()
          })
          .then(addIceCandidate)
      })
    })
  })

  setupDataChannel()
}
// section 2.1 end

// section 3.1 start
function addIceCandidate(candidate) {
  // 1. This checks for the server indicating it could not provide any
  //    ICE Candidates.
  if (candidate.candidate === '') {
    return console.error('the server had no ICE Candidates')
  }

  // 2. Pass the ICE Candidate to the Client PeerConnection
  peerConnection.addIceCandidate(candidate)
}
// section 3.1 end

// section 4.1 start
function setupDataChannel() {
  let messagesOk = 0
  let messagesLost = 0
  let messagesLate = 0
  let messagesOkElement = document.getElementById('ok')
  let messagesLostElement = document.getElementById('lost')
  let messagesLateElement = document.getElementById('late')
  peerConnection.ondatachannel = function (event) {
    const dataChannel = event.channel

    let lastMessageId = 0
    let firstMessage = true
    dataChannel.onmessage = function(event) {
      // Ideally this wouldn't be a string, but that's out of scope here.
      const messageId = parseInt(event.data.split("\n")[0], 10)

      if (messageId <= lastMessageId) {
        // This message is old. We can either skip it, or handle it
        // differently knowing it is old.
        if (messageId < lastMessageId) {
          messagesLost--
          messagesLate++
        }
      } else {
        messagesOk++
      }

      if (messageId > lastMessageId + 1) {
        if (firstMessage) {
          firstMessage = false
        } else {
          // Some messages before this one are late or were lost. 
          // If this happens a lot we may want to alert the user that the
          // connection seems unstable.
          messagesLost += messageId - lastMessageId - 1
        }
      }
      lastMessageId = messageId

      messagesOkElement.innerText = messagesOk
      messagesLostElement.innerText = messagesLost
      messagesLateElement.innerText = messagesLate
    }
  }
}
// section 4.1 end
