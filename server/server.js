const http = require("http")
// section 1.2 start
const wrtc = require("wrtc")

const clients = {}
let nextClientId = 0

function getOffer(request, response) {
  // 1. Create a PeerConnection specific to this client
  const clientId = nextClientId++
  const peerConnection = new wrtc.RTCPeerConnection()

  const client = { peerConnection, dataChannel: createDataChannel(peerConnection) }
  clients[clientId] = client

  // 2. Use the PeerConnection to create an Offer
  console.log(clientId, 'creating offer')
  peerConnection.createOffer(
    function(offer) {
      console.log(clientId, 'setting offer')
      // 3. Set the Offer on the PeerConnection
      peerConnection.setLocalDescription(
        offer,
        function() {
          console.log(clientId, 'sending offer')
          // 4. Return the ID and Offer to the Client
          response.setHeader('content-type', 'application/json')
          response.end(JSON.stringify({ clientId, sdp: offer.sdp }))
        },
        getErrorHandler(response, 'setting offer')
      )
    },
    getErrorHandler(response, 'creating offer')
  )

  peerConnection.onicecandidate = getIceCandidateHandler(clientId, client)
}

function getErrorHandler(response, failedAction) {
  return function(error) {
    console.error(`error ${failedAction}: `, error)
    response.statusCode = 500
    response.end(`error ${failedAction}`)
  }
}
// section 1.2 end

// section 2.2 start
// ICE Candidates
function sendAnswerGetCandidate(request, response) {
  // This starts with boilerplate to read the body from the request
  let body = ''
  request.on('readable', function() {
    const next = request.read()
    if (next) return body += next

    const answer = JSON.parse(body)

    // 1. Get the PeerConnection we started with
    const client = clients[answer.clientId]
    const peerConnection = client.peerConnection
    // 2. Set the Answer on the PeerConnection
    console.log(answer.clientId, 'setting answer')
    peerConnection.setRemoteDescription(
      { type: 'answer', sdp: answer.sdp },
      function() {

        // 3. If there is already an ICE Candidate ready, send it
        if (client.iceCandidate) {
          response.end(JSON.stringify(client.iceCandidate))
          delete client.iceCandidate
          return
        }

        // 4. Otherwise, Save the response for sending the ICE Candidate later
        console.log(answer.clientId, 'saving response')
        client.iceCandidateResponse = response
      },
      getErrorHandler(response, 'setting offer')
    )
  })
}
// section 2.2 end

// section 3.2 start
function getIceCandidateHandler(clientId, client) {
  return function(event) {
    const candidate = event.candidate

    // 1. 
    if (client.iceCandidate || !candidate) {
      return
    }

    // 2. Skip candidates with certain addresses.  If your server is public, you
    //    would want to skip private address, so you could add 192.168., etc.
    if (candidate.address.startsWith('10.')) {
      return
    }

    // 3. Skip candidates that aren't udp.  We only want unreliable, 
    //    unordered connections.
    if (candidate.protocol !== 'udp') {
      return
    }

    // 4. If the user is waiting for a response, send the ICE Candidate now
    if (client.iceCandidateResponse) {
      console.log(clientId, 'sending ICE candidate')
      client.iceCandidateResponse.end(JSON.stringify(candidate))
      delete client.iceCandidateResponse
      return
    }

    // 5. Otherwise, save it for when they are ready for a response
    console.log(clientId, 'sending ICE candidate')
    client.iceCandidate = candidate
  }
}
// section 3.2 end

// section 4.2 start
function createDataChannel(peerConnection) {
  return peerConnection.createDataChannel('hello', {
    ordered: false,
    maxRetransmits: 0
  })
}

// Build a random message with a set size. You can adjust the size
// to simulate different applications.
let message = "\n"
while (message.length < 1000) {
  message += String.fromCharCode(Math.round(Math.random()*256))
}

// DataChannel Loop
let messageId = 1
setInterval(function() {
  const clientIds = Object.keys(clients)

  for (const [id, client] of Object.entries(clients)) {
    if (client.dataChannel.readyState === 'open') {
      client.dataChannel.send(`${messageId}${message}`)
    }
  }

  messageId++
}, 20)
// section 4.2 end

// HTTP server boilerplate
const server = http.createServer((request, response) => {
  console.log(request.method, request.url)

  response.setHeader('Access-Control-Allow-Origin', '*')

  if (request.method == "GET" && request.url == '/get-offer') {
    return getOffer(request, response)
  } else if (request.method == "POST" && request.url == '/send-answer-get-candidate') {
    return sendAnswerGetCandidate(request, response)
  }

  response.statusCode = 400
  response.end("Bad Request\n")
});

server.on('listening', () => {
  console.log('listening')
})
server.on('close', () => console.log('closed'))

server.listen(8080)
