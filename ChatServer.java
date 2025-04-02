package com.chatapp.server;

import java.net.InetSocketAddress;
import java.util.HashMap;
import java.util.Map;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;
import org.json.JSONObject;

public class ChatServer extends WebSocketServer {
    private Map<WebSocket, String> usernames;

    public ChatServer(InetSocketAddress address) {
        super(address);
        usernames = new HashMap<>();
    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        System.out.println("New connection: " + conn.getRemoteSocketAddress());
    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        String username = usernames.get(conn);
        if (username != null) {
            broadcastMessage("leave", username, null, null);
            usernames.remove(conn);
        }
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
                    handleFileMessage(username, jsonMessage.getString("fileUrl"), jsonMessage.getBoolean("isImage"));
                    break;
                case "leave":
                    handleLeave(conn, username);
                    break;
                case "location":
                    handleLocationMessage(username, jsonMessage.getDouble("latitude"), jsonMessage.getDouble("longitude"));
                    break;
                case "delete":
                    handleDeleteMessage(username, jsonMessage.getLong("messageId"));
                    break;
                case "edit":
                    handleEditMessage(username, jsonMessage.getLong("messageId"), jsonMessage.getString("newMessage"));
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

    private void handleFileMessage(String username, String fileUrl, boolean isImage) {
        broadcastMessage("file", username, null, fileUrl, isImage);
    }

    private void handleLeave(WebSocket conn, String username) {
        usernames.remove(conn);
        broadcastMessage("leave", username, null, null);
    }

    private void handleLocationMessage(String username, double latitude, double longitude) {
        broadcastMessage("location", username, null, null, latitude, longitude);
    }

    private void handleDeleteMessage(String username, long messageId) {
        JSONObject jsonMessage = new JSONObject();
        jsonMessage.put("type", "delete");
        jsonMessage.put("username", username);
        jsonMessage.put("messageId", messageId);
        broadcast(jsonMessage.toString());
    }

    private void handleEditMessage(String username, long messageId, String newMessage) {
        JSONObject jsonMessage = new JSONObject();
        jsonMessage.put("type", "edit");
        jsonMessage.put("username", username);
        jsonMessage.put("messageId", messageId);
        jsonMessage.put("newMessage", newMessage);
        broadcast(jsonMessage.toString());
    }

    private void broadcastMessage(String type, String username, String message, String fileUrl, boolean... isImage) {
        JSONObject jsonMessage = new JSONObject();
        jsonMessage.put("type", type);
        jsonMessage.put("username", username);
        jsonMessage.put("message", message);
        jsonMessage.put("fileUrl", fileUrl);
        if (isImage != null && isImage.length > 0) {
            jsonMessage.put("isImage", isImage[0]);
        }
        jsonMessage.put("activeUsers", usernames.size());
        jsonMessage.put("userList", usernames.values());
        broadcast(jsonMessage.toString());
    }

    private void broadcastMessage(String type, String username, String message, String fileUrl, double latitude, double longitude) {
        JSONObject jsonMessage = new JSONObject();
        jsonMessage.put("type", type);
        jsonMessage.put("username", username);
        jsonMessage.put("message", message);
        jsonMessage.put("fileUrl", fileUrl);
        jsonMessage.put("latitude", latitude);
        jsonMessage.put("longitude", longitude);
        jsonMessage.put("activeUsers", usernames.size());
        jsonMessage.put("userList", usernames.values());
        broadcast(jsonMessage.toString());
    }

    @Override
    public void onError(WebSocket conn, Exception ex) {
        System.err.println("An error occurred on connection " + conn.getRemoteSocketAddress() + ":" + ex);
    }

    @Override
    public void onStart() {
        System.out.println("Server started successfully");
    }

    public static void main(String[] args) {
        String host = "localhost";
        int port = 8887;
        WebSocketServer server = new ChatServer(new InetSocketAddress(host, port));
        server.run();
    }
}