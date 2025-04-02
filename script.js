let ws;
let username;
let avatarUrl;
let userList = [];
let currentCallId = null;
let callDurationInterval;
let callStartTime;
let localStream;
let peerConnections = {};
let isMuted = false;
let isVideoOff = false;

// Initialize event listeners
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('messageInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    document.getElementById('fileInput').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            sendFile(file);
        }
    });

    window.addEventListener('beforeunload', function() {
        endChat();
    });

    window.addEventListener('click', function(event) {
        if (!event.target.matches('.message-menu, .message-menu *')) {
            const dropdowns = document.querySelectorAll('.message-menu-content');
            dropdowns.forEach(dropdown => {
                dropdown.style.display = 'none';
            });
        }
        
        // Close users popup when clicking outside of it
        if (!event.target.matches('.users-more, .users-popup, .users-popup *')) {
            const usersPopup = document.getElementById('usersPopup');
            usersPopup.classList.remove('active');
        }
    });
});

function addMessage(text, type = 'received', sender = '', isFile = false, isImage = false) {
    const messages = document.getElementById('messages');
    const messageElement = document.createElement('div');
    
    messageElement.className = `message ${type}`;
    messageElement.setAttribute('data-timestamp', Date.now());
    
    if (sender) {
        const senderElement = document.createElement('div');
        senderElement.className = 'sender';
        senderElement.textContent = sender;
        messageElement.appendChild(senderElement);
    }
    const contentElement = document.createElement('div');
    if (isFile) {
        if (isImage) {
            const image = document.createElement('img');
            image.src = text;
            contentElement.appendChild(image);
        } else {
            const fileLink = document.createElement('a');
            fileLink.href = text;
            fileLink.textContent = 'Download File';
            fileLink.download = text.split('/').pop();
            contentElement.appendChild(fileLink);
        }
    } else {
        contentElement.textContent = text;
    }
    messageElement.appendChild(contentElement);

    if (type === 'sent') {
        const messageMenu = document.createElement('div');
        messageMenu.className = 'message-menu';
        messageMenu.textContent = '⋮';
        messageMenu.onclick = function() {
            const menuContent = messageElement.querySelector('.message-menu-content');
            menuContent.style.display = menuContent.style.display === 'block' ? 'none' : 'block';
        };
        const messageMenuContent = document.createElement('div');
        messageMenuContent.className = 'message-menu-content';
        const editButton = document.createElement('button');
        editButton.textContent = 'Edit';
        editButton.onclick = function() {
            const originalText = contentElement.textContent;
            const messageInput = document.getElementById('messageInput');
            messageInput.value = originalText;
            messageElement.style.display = 'none';
        };
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.onclick = function() {
            ws.send(JSON.stringify({
                type: 'delete',
                username: username,
                messageId: messageElement.getAttribute('data-timestamp')
            }));
            messageElement.remove();
        };
        messageMenuContent.appendChild(editButton);
        messageMenuContent.appendChild(deleteButton);
        messageElement.appendChild(messageMenu);
        messageElement.appendChild(messageMenuContent);
    }

    messages.appendChild(messageElement);
    messages.scrollTop = messages.scrollHeight;
}

function connect() {
    username = document.getElementById('username').value.trim();
    avatarUrl = document.getElementById('avatarUrl').value.trim();
    
    if (!username) {
        alert('Please enter a username');
        return;
    }

    updateStatus('Connecting...', false);

    ws = new WebSocket('ws://localhost:8887');

    ws.onopen = function() {
        updateStatus('Connected', true);
        document.getElementById('loginArea').style.display = 'none';
        document.getElementById('chatArea').style.display = 'block';
        ws.send(JSON.stringify({
            type: 'join',
            username: username,
            avatar: avatarUrl
        }));
        addMessage(`Welcome to the chat room, ${username}!`, 'system');
    };

    ws.onclose = function() {
        updateStatus('Disconnected', false);
        document.getElementById('loginArea').style.display = 'block';
        document.getElementById('chatArea').style.display = 'none';
        addMessage('Disconnected from chat server', 'system');
        
        // Clean up any active calls
        if (currentCallId) {
            cleanupCall();
        }
    };

    ws.onerror = function(error) {
        updateStatus('Error connecting', false);
        console.error('WebSocket error:', error);
        addMessage('Error connecting to server', 'system');
    };

    ws.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            switch(data.type) {
                case 'join':
                    addMessage(`${data.username} joined the chat`, 'system');
                    break;
                case 'leave':
                    addMessage(`${data.username} left the chat`, 'system');
                    break;
                case 'message':
                    addMessage(data.message, data.username === username ? 'sent' : 'received', data.username);
                    break;
                case 'file':
                    addMessage(data.fileUrl, data.username === username ? 'sent' : 'received', data.username, true, data.isImage);
                    break;
                case 'location':
                    addLocation(data.username, data.latitude, data.longitude);
                    break;
                case 'delete':
                    const messageToDelete = document.querySelector(`[data-timestamp="${data.messageId}"]`);
                    if (messageToDelete) {
                        messageToDelete.remove();
                    }
                    break;
                case 'edit':
                    const messageToEdit = document.querySelector(`[data-timestamp="${data.messageId}"]`);
                    if (messageToEdit) {
                        const contentDiv = messageToEdit.querySelector('div:not(.sender)');
                        if (contentDiv) {
                            contentDiv.textContent = data.newMessage;
                        }
                    }
                    break;
                case 'user-list-update':
                    updateUserList(data.userList);
                    break;
                case 'call-incoming':
                    handleIncomingCall(data.callId, data.initiator);
                    break;
                case 'call-user-joined':
                    handleUserJoinedCall(data.callId, data.username, data.participants);
                    break;
                case 'call-user-left':
                    handleUserLeftCall(data.callId, data.username, data.participants);
                    break;
                case 'call-ended':
                    handleCallEnded(data.callId, data.initiator);
                    break;
                case 'call-rejected':
                    handleCallRejected(data.callId, data.username);
                    break;
                case 'call-signal':
                    handleCallSignal(data.callId, data.username, data.signal);
                    break;
            }
        } catch (e) {
            console.error('Error parsing message:', e);
        }
    };
}

function updateStatus(text, connected) {
    const status = document.getElementById('status');
    const dot = document.querySelector('.status-dot');
    status.textContent = text;
    dot.classList.toggle('offline', !connected);
}

function updateUserList(users) {
    userList = users;
    
    // Update the visible user avatars (show first 3)
    const usersContainer = document.getElementById('usersContainer');
    usersContainer.innerHTML = '';
    
    const visibleUsers = users.slice(0, 3);
    visibleUsers.forEach(user => {
        const userAvatar = document.createElement('div');
        userAvatar.className = 'user-avatar';
        
        if (user.avatar) {
            const img = document.createElement('img');
            img.src = user.avatar;
            img.alt = user.username;
            img.onerror = function() {
                this.onerror = null;
                this.parentNode.textContent = user.username.charAt(0).toUpperCase();
            };
            userAvatar.appendChild(img);
        } else {
            userAvatar.textContent = user.username.charAt(0).toUpperCase();
        }
        
        usersContainer.appendChild(userAvatar);
    });
    
    // Add the "more" button if there are more than 3 users
    if (users.length > 3) {
        const moreButton = document.createElement('div');
        moreButton.className = 'users-more';
        moreButton.textContent = '+' + (users.length - 3);
        moreButton.onclick = toggleUsersPopup;
        usersContainer.appendChild(moreButton);
    }
    
    // Update the full user list in the popup
    const usersPopupList = document.getElementById('usersPopupList');
    usersPopupList.innerHTML = '';
    
    users.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        
        const userItemAvatar = document.createElement('div');
        userItemAvatar.className = 'user-item-avatar';
        
        if (user.avatar) {
            const img = document.createElement('img');
            img.src = user.avatar;
            img.alt = user.username;
            img.onerror = function() {
                this.onerror = null;
                this.parentNode.textContent = user.username.charAt(0).toUpperCase();
            };
            userItemAvatar.appendChild(img);
        } else {
            userItemAvatar.textContent = user.username.charAt(0).toUpperCase();
        }
        
        const userItemInfo = document.createElement('div');
        userItemInfo.className = 'user-item-info';
        
        const userItemUsername = document.createElement('div');
        userItemUsername.className = 'user-item-username';
        userItemUsername.textContent = user.username;
        
        userItemInfo.appendChild(userItemUsername);
        userItem.appendChild(userItemAvatar);
        userItem.appendChild(userItemInfo);
        usersPopupList.appendChild(userItem);
    });
}

function toggleUsersPopup() {
    const usersPopup = document.getElementById('usersPopup');
    usersPopup.classList.toggle('active');
}

function sendMessage() {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        addMessage('You are not connected to the chat server', 'system');
        return;
    }
    
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (!message) {
        return;
    }
    
    ws.send(JSON.stringify({
        type: 'message',
        username: username,
        message: message
    }));
    
    messageInput.value = '';
}

function sendFile(file) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        addMessage('You are not connected to the chat server', 'system');
        return;
    }
    
    // In a real app, you would upload the file to a server and get a URL
    // For simplicity, we'll create a temporary URL and simulate sending it
    const reader = new FileReader();
    reader.onload = function(event) {
        const isImage = file.type.startsWith('image/');
        const fileUrl = URL.createObjectURL(file);
        
        ws.send(JSON.stringify({
            type: 'file',
            username: username,
            fileUrl: fileUrl,
            isImage: isImage
        }));
        
        addMessage(fileUrl, 'sent', username, true, isImage);
    };
    reader.readAsDataURL(file);
}

function shareLocation() {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        addMessage('You are not connected to the chat server', 'system');
        return;
    }
    
    if (!navigator.geolocation) {
        addMessage('Geolocation is not supported by your browser', 'system');
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            
            ws.send(JSON.stringify({
                type: 'location',
                username: username,
                latitude: latitude,
                longitude: longitude
            }));
            
            addLocation(username, latitude, longitude, true);
        },
        function(error) {
            addMessage(`Error getting location: ${error.message}`, 'system');
        }
    );
}

function addLocation(sender, latitude, longitude, isSender = false) {
    const messages = document.getElementById('messages');
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isSender ? 'sent' : 'received'}`;
    
    if (sender) {
        const senderElement = document.createElement('div');
        senderElement.className = 'sender';
        senderElement.textContent = sender;
        messageElement.appendChild(senderElement);
    }
    
    const locationLink = document.createElement('a');
    locationLink.href = `https://www.google.com/maps?q=${latitude},${longitude}`;
    locationLink.textContent = 'View Location on Map';
    locationLink.target = '_blank';
    
    const locationElement = document.createElement('div');
    locationElement.appendChild(locationLink);
    messageElement.appendChild(locationElement);
    
    messages.appendChild(messageElement);
    messages.scrollTop = messages.scrollHeight;
}

function endChat() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'leave',
            username: username
        }));
        ws.close();
    }
}

// WebRTC Call functions
function initiateCall() {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        addMessage('You are not connected to the chat server', 'system');
        return;
    }
    
    if (userList.length <= 1) {
        addMessage('There are no other users to call', 'system');
        return;
    }
    
    if (currentCallId) {
        addMessage('You are already in a call', 'system');
        return;
    }
    
    currentCallId = Date.now().toString();
    
    ws.send(JSON.stringify({
        type: 'call-initiate',
        username: username,
        callId: currentCallId
    }));
    
    setupLocalMedia()
        .then(() => {
            showCallUI();
            startCallTimer();
            addMessage('You started a group call', 'system');
        })
        .catch(error => {
            console.error('Error setting up media:', error);
            addMessage('Failed to access camera/microphone', 'system');
            currentCallId = null;
        });
}

function setupLocalMedia() {
    return navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        .then(stream => {
            localStream = stream;
            addVideoToCall('local', stream, username);
        });
}

function addVideoToCall(id, stream, participant) {
    const callParticipants = document.getElementById('callParticipants');
    
    // Check if the participant already exists
    if (document.getElementById(`participant-${id}`)) {
        return;
    }
    
    const participantElement = document.createElement('div');
    participantElement.className = 'call-participant';
    participantElement.id = `participant-${id}`;
    
    const videoElement = document.createElement('video');
    videoElement.autoplay = true;
    videoElement.srcObject = stream;
    
    if (id === 'local') {
        videoElement.muted = true; // Mute local video to prevent feedback
    }
    
    const nameElement = document.createElement('div');
    nameElement.className = 'participant-name';
    nameElement.textContent = participant + (id === 'local' ? ' (You)' : '');
    
    participantElement.appendChild(videoElement);
    participantElement.appendChild(nameElement);
    callParticipants.appendChild(participantElement);
}

function showCallUI() {
    document.getElementById('callModal').style.display = 'flex';
}

function hideCallUI() {
    document.getElementById('callModal').style.display = 'none';
}

function startCallTimer() {
    callStartTime = Date.now();
    const durationElement = document.getElementById('callDuration');
    
    callDurationInterval = setInterval(() => {
        const duration = Math.floor((Date.now() - callStartTime) / 1000);
        const minutes = Math.floor(duration / 60).toString().padStart(2, '0');
        const seconds = (duration % 60).toString().padStart(2, '0');
        durationElement.textContent = `${minutes}:${seconds}`;
    }, 1000);
}

function handleIncomingCall(callId, initiator) {
    if (currentCallId) {
        // Already in a call, auto-reject
        ws.send(JSON.stringify({
            type: 'call-reject',
            username: username,
            callId: callId
        }));
        return;
    }
    
    // Show incoming call UI
    document.getElementById('incomingCallUser').textContent = initiator;
    document.getElementById('incomingCallModal').style.display = 'flex';
    
    // Store call ID
    currentCallId = callId;
}

function acceptCall() {
    document.getElementById('incomingCallModal').style.display = 'none';
    
    setupLocalMedia()
        .then(() => {
            showCallUI();
            startCallTimer();
            
            ws.send(JSON.stringify({
                type: 'call-accept',
                username: username,
                callId: currentCallId
            }));
            
            addMessage(`You joined ${document.getElementById('incomingCallUser').textContent}'s call`, 'system');
        })
        .catch(error => {
            console.error('Error setting up media:', error);
            addMessage('Failed to access camera/microphone', 'system');
            currentCallId = null;
        });
}

function declineCall() {
    document.getElementById('incomingCallModal').style.display = 'none';
    
    ws.send(JSON.stringify({
        type: 'call-reject',
        username: username,
        callId: currentCallId
    }));
    
    currentCallId = null;
}

function handleUserJoinedCall(callId, user, participants) {
    if (callId !== currentCallId) return;
    
    addMessage(`${user} joined the call`, 'system');
    
    // Create peer connection for this user
    createPeerConnection(user);
    
    // Create offer if we're the initiator or this user just joined
    if (participants.indexOf(username) < participants.indexOf(user)) {
        const peerConnection = peerConnections[user];
        
        peerConnection.createOffer()
            .then(offer => peerConnection.setLocalDescription(offer))
            .then(() => {
                ws.send(JSON.stringify({
                    type: 'call-signal',
                    username: username,
                    target: user,
                    callId: currentCallId,
                    signal: {
                        type: 'offer',
                        sdp: peerConnection.localDescription
                    }
                }));
            })
            .catch(error => console.error('Error creating offer:', error));
    }
}

function handleUserLeftCall(callId, user, participants) {
    if (callId !== currentCallId) return;
    
    addMessage(`${user} left the call`, 'system');
    
    // Remove video element
    const participantElement = document.getElementById(`participant-${user}`);
    if (participantElement) {
        participantElement.remove();
    }
    
    // Clean up peer connection
    if (peerConnections[user]) {
        peerConnections[user].close();
        delete peerConnections[user];
    }
}

function handleCallEnded(callId, initiator) {
    if (callId !== currentCallId) return;
    
    addMessage(`${initiator} ended the call`, 'system');
    cleanupCall();
}

function handleCallRejected(callId, user) {
    if (callId !== currentCallId) return;
    
    addMessage(`${user} declined the call`, 'system');
}

function handleCallSignal(callId, user, signal) {
    if (callId !== currentCallId) return;
    
    if (!peerConnections[user]) {
        createPeerConnection(user);
    }
    
    const peerConnection = peerConnections[user];
    
    if (signal.type === 'offer') {
        peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp))
            .then(() => peerConnection.createAnswer())
            .then(answer => peerConnection.setLocalDescription(answer))
            .then(() => {
                ws.send(JSON.stringify({
                    type: 'call-signal',
                    username: username,
                    target: user,
                    callId: currentCallId,
                    signal: {
                        type: 'answer',
                        sdp: peerConnection.localDescription
                    }
                }));
            })
            .catch(error => console.error('Error handling offer:', error));
    } 
    else if (signal.type === 'answer') {
        peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp))
            .catch(error => console.error('Error handling answer:', error));
    } 
    else if (signal.type === 'candidate') {
        peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate))
            .catch(error => console.error('Error adding ICE candidate:', error));
    }
}

function createPeerConnection(user) {
    const peerConnection = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    });
    
    peerConnections[user] = peerConnection;
    
    // Add local tracks to the connection
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });
    
    // Handle ICE candidates
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            ws.send(JSON.stringify({
                type: 'call-signal',
                username: username,
                target: user,
                callId: currentCallId,
                signal: {
                    type: 'candidate',
                    candidate: event.candidate
                }
            }));
        }
    };
    
    // Handle incoming tracks
    peerConnection.ontrack = event => {
        addVideoToCall(user, event.streams[0], user);
    };
    
    return peerConnection;
}

function endCall() {
    if (!currentCallId) return;
    
    ws.send(JSON.stringify({
        type: 'call-end',
        username: username,
        callId: currentCallId
    }));
    
    cleanupCall();
    addMessage('You ended the call', 'system');
}

function cleanupCall() {
    // Stop all tracks
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    // Close all peer connections
    Object.values(peerConnections).forEach(pc => pc.close());
    peerConnections = {};
    
    // Hide call UI
    hideCallUI();
    
    // Clear call timer
    clearInterval(callDurationInterval);
    document.getElementById('callDuration').textContent = '00:00';
    
    // Clear call participants
    document.getElementById('callParticipants').innerHTML = '';
    
    // Reset call ID
    currentCallId = null;
    
    // Reset call controls
    document.getElementById('muteIcon').textContent = '🎙️';
    document.getElementById('videoIcon').textContent = '📹';
    isMuted = false;
    isVideoOff = false;
}

function toggleMute() {
    if (!localStream) return;
    
    const audioTracks = localStream.getAudioTracks();
    isMuted = !isMuted;
    
    audioTracks.forEach(track => {
        track.enabled = !isMuted;
    });
    
    document.getElementById('muteIcon').textContent = isMuted ? '🔇' : '🎙️';
}

function toggleVideo() {
    if (!localStream) return;
    
    const videoTracks = localStream.getVideoTracks();
    isVideoOff = !isVideoOff;
    
    videoTracks.forEach(track => {
        track.enabled = !isVideoOff;
    });
    
    document.getElementById('videoIcon').textContent = isVideoOff ? '📵' : '📹';
}