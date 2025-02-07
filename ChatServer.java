import java.net.InetSocketAddress;
import java.util.HashSet;
import java.util.Set;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

public class ChatServer extends WebSocketServer {
    private Set<WebSocket> conns;
    private Set<String> usernames;

    public ChatServer() {
        super(new InetSocketAddress(8887));
        conns = new HashSet<>();
        usernames = new HashSet<>();
    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        conns.add(conn);
        System.out.println("New connection from " + conn.getRemoteSocketAddress());
    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        conns.remove(conn);
        System.out.println("Closed connection to " + conn.getRemoteSocketAddress());
    }

    @Override
    public void onMessage(WebSocket conn, String message) {
        System.out.println("Received message from " + conn.getRemoteSocketAddress() + ": " + message);

        // Broadcast message to all connected clients
        for (WebSocket client : conns) {
            client.send(message);
        }
    }

    @Override
    public void onError(WebSocket conn, Exception ex) {
        System.out.println("Error occurred on connection " + conn);
        ex.printStackTrace();
    }

    public static void main(String[] args) {
        ChatServer server = new ChatServer();
        server.start();
        System.out.println("ChatServer started on port: 8887");
    }
}