package lib;

// WebSocketServer.java
import java.net.InetSocketAddress;
import java.util.HashMap;
import java.util.Map;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

public class ChatServer extends WebSocketServer {
    private Map<WebSocket, String> users = new HashMap<>();
    private static final int DEFAULT_PORT = 8887;

    public ChatServer(int port) {
        super(new InetSocketAddress(port));
    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        System.out.println("New connection from " + conn.getRemoteSocketAddress());
    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        String userName = users.get(conn);
        if (userName != null) {
            broadcast(userName + " has left the chat");
            users.remove(conn);
        }
    }

    @Override
    public void onMessage(WebSocket conn, String message) {
        if (!users.containsKey(conn)) {
            // First message from user is their name
            users.put(conn, message);
            broadcast(message + " has joined the chat");
            return;
        }

        String userName = users.get(conn);
        broadcast(userName + ": " + message);
    }

    @Override
    public void onError(WebSocket conn, Exception ex) {
        System.err.println("Error occurred on connection " + conn + ":");
        ex.printStackTrace();
    }

    @Override
    public void onStart() {
        System.out.println("WebSocket server started on port: " + getPort());
    }

    public static void main(String[] args) {
        int port = args.length > 0 ? Integer.parseInt(args[0]) : DEFAULT_PORT;
        ChatServer server = new ChatServer(port);
        server.start();
    }
}