package com.chatapp.server;

import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

import java.net.InetSocketAddress;
import java.util.Collection;

public abstract class WebSocketServer extends org.java_websocket.server.WebSocketServer {

    public WebSocketServer(InetSocketAddress address) {
        super(address);
    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        // Handle new connection
    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        // Handle connection close
    }

    @Override
    public void onMessage(WebSocket conn, String message) {
        // Handle incoming message
    }

    @Override
    public void onError(WebSocket conn, Exception ex) {
        // Handle error
    }

    @Override
    public void onStart() {
        // Handle server start
    }

    public void broadcast(String message) {
        Collection<WebSocket> connections = getConnections();
        synchronized (connections) {
            for (WebSocket conn : connections) {
                conn.send(message);
            }
        }
    }
}
}