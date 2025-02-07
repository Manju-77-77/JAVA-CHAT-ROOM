package com.chatapp.server;

import java.net.InetSocketAddress;
import java.nio.ByteBuffer;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

import org.java_websocket.WebSocket;
import org.java_websocket.drafts.Draft;
import org.java_websocket.exceptions.InvalidDataException;
import org.java_websocket.framing.Framedata;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.handshake.ServerHandshakeBuilder;

public class WebSocketServer extends org.java_websocket.server.WebSocketServer {

    private static int DEFAULT_PORT = 8887;
    private Set<WebSocket> connections = Collections.synchronizedSet(new HashSet<>());

    public WebSocketServer() {
        super(new InetSocketAddress(DEFAULT_PORT));
    }

    public WebSocketServer(InetSocketAddress address) {
        super(address);
    }

    public WebSocketServer(int port) {
        super(new InetSocketAddress(port));
    }

    public WebSocketServer(InetSocketAddress address, Draft protocolDraft) {
        super(address, Collections.singletonList(protocolDraft));
    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        connections.add(conn);

        // Log connection details
        String hostAddress = conn.getRemoteSocketAddress().getAddress().getHostAddress();
        System.out.println("New connection from " + hostAddress);

        // You can access HTTP headers from handshake
        String resourceDescriptor = handshake.getResourceDescriptor();
        System.out.println("Resource descriptor: " + resourceDescriptor);
    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        connections.remove(conn);
        System.out.println("Closed connection to " + conn.getRemoteSocketAddress() +
                ". Code: " + code + " Reason: " + reason +
                " Remote: " + remote);
    }

    @Override
    public void onMessage(WebSocket conn, String message) {
        System.out.println("Received message from " + conn.getRemoteSocketAddress() + ": " + message);
        // Echo the message back by default
        conn.send(message);
    }

    @Override
    public void onMessage(WebSocket conn, ByteBuffer message) {
        // Handle binary messages
        System.out.println("Received binary message from " + conn.getRemoteSocketAddress() +
                ". Length: " + message.remaining());
        // Echo binary message back by default
        conn.send(message);
    }

    @Override
    public void onError(WebSocket conn, Exception ex) {
        System.err.println("Error occurred on connection " + conn);
        ex.printStackTrace();
        if (conn != null) {
            connections.remove(conn);
        }
    }

    @Override
    public void onStart() {
        System.out.println("Server started successfully on port: " + getPort());
        setConnectionLostTimeout(30); // Configure ping/pong timeout
    }

    @Override
    public void onWebsocketPing(WebSocket conn, Framedata f) {
        super.onWebsocketPing(conn, f);
        System.out.println("Received ping from " + conn.getRemoteSocketAddress());
    }

    @Override
    public void onWebsocketPong(WebSocket conn, Framedata f) {
        super.onWebsocketPong(conn, f);
        System.out.println("Received pong from " + conn.getRemoteSocketAddress());
    }

    @Override
    public ServerHandshakeBuilder onWebsocketHandshakeReceivedAsServer(WebSocket conn, Draft draft,
            ClientHandshake request) throws InvalidDataException {
        ServerHandshakeBuilder builder = super.onWebsocketHandshakeReceivedAsServer(conn, draft, request);

        // You can modify the handshake response here
        // For example, add custom headers
        builder.put("Server", "WebSocketServer/1.0");

        return builder;
    }

    // Utility methods for broadcasting
    public void broadcast(String message) {
        broadcast(message, null);
    }

    public void broadcast(String message, WebSocket exclude) {
        synchronized (connections) {
            for (WebSocket client : connections) {
                if (client != exclude && client.isOpen()) {
                    client.send(message);
                }
            }
        }
    }

    // Get active connections count
    public int getConnectionCount() {
        return connections.size();
    }

    // Main method for standalone testing
    public static void main(String[] args) {
        int port = args.length > 0 ? Integer.parseInt(args[0]) : DEFAULT_PORT;
        WebSocketServer server = new WebSocketServer(port);
        server.start();
        System.out.println("WebSocketServer started on port: " + server.getPort());
    }
}