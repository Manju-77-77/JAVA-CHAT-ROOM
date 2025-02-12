package com.chatapp.server;

import java.net.InetSocketAddress;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.json.JSONObject;

public class ChatServer extends WebSocketServer {
    private Map<WebSocket, String> usernames;

    public ChatServer() {
        super(new InetSocketAddress(8887));
        usernames = new HashMap<>();
    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        super.onOpen(conn, handshake);
    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        String username = usernames.get(conn);
        if (username != null) {
            broadcastMessage("leave", username, null, null);
            usernames.remove(conn);
        }
        super.onClose(conn, code, reason, remote);
    }

    @Override
    public void onMessage(WebSocket conn, String message) {
        try {
            JSONObject jsonMessage = new JSONObject(message);
            String type = jsonMessage.getString("type");
            String username = jsonMessage.getString("username");

            switch (type) {
                case "join":
                    handleJoin(conn, username);
                    break;
                case "message":
                    handleChatMessage(username, jsonMessage.getString("message"));
                    break;
                case "file":
                    handleFileMessage(username, jsonMessage.getString("fileUrl"));
                    break;
                case "leave":
                    handleLeave(conn, username);
                    break;
            }
        } catch (Exception e) {
            System.out.println("Error processing message: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void handleJoin(WebSocket conn, String username) {
        usernames.put(conn, username);
        broadcastMessage("join", username, null, null);
    }

    private void handleChatMessage(String username, String message) {
        broadcastMessage("message", username, message, null);
    }

    private void handleFileMessage(String username, String fileUrl) {
        broadcastMessage("file", username, null, fileUrl);
    }

    private void handleLeave(WebSocket conn, String username) {
        usernames.remove(conn);
        broadcastMessage("leave", username, null, null);
    }

    private void broadcastMessage(String type, String username, String message, String fileUrl) {
        JSONObject jsonMessage = new JSONObject();
        jsonMessage.put("type", type);
        jsonMessage.put("username", username);
        jsonMessage.put("message", message);
        jsonMessage.put("fileUrl", fileUrl);
        jsonMessage.put("activeUsers", usernames.size());
        jsonMessage.put("userList", usernames.values());
        broadcast(jsonMessage.toString());
    }
}