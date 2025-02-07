package lib;

// Server.java
import java.io.*;
import java.net.*;
import java.util.*;

public class Server {
    private static final int PORT = 5000;
    private static HashSet<PrintWriter> writers = new HashSet<>();

    public static void main(String[] args) throws Exception {
        System.out.println("Chat Server is running...");
        ServerSocket listener = new ServerSocket(PORT);
        try {
            while (true) {
                new ClientHandler(listener.accept()).start();
            }
        } finally {
            listener.close();
        }
    }

    private static class ClientHandler extends Thread {
        private String name;
        private Socket socket;
        private BufferedReader in;
        private PrintWriter out;

        public ClientHandler(Socket socket) {
            this.socket = socket;
        }

        public void run() {
            try {
                in = new BufferedReader(new InputStreamReader(socket.getInputStream()));
                out = new PrintWriter(socket.getOutputStream(), true);

                // Request a name from this client
                while (true) {
                    out.println("SUBMITNAME");
                    name = in.readLine();
                    if (name == null) {
                        return;
                    }
                    synchronized (writers) {
                        if (!name.isEmpty()) {
                            break;
                        }
                    }
                }

                // Add client's printwriter to the set of all writers
                out.println("NAMEACCEPTED " + name);
                synchronized (writers) {
                    writers.add(out);
                }

                // Broadcast that a new user joined
                for (PrintWriter writer : writers) {
                    writer.println("MESSAGE " + name + " has joined the chat");
                }

                // Accept messages from this client and broadcast them
                while (true) {
                    String input = in.readLine();
                    if (input == null) {
                        return;
                    }
                    for (PrintWriter writer : writers) {
                        writer.println("MESSAGE " + name + ": " + input);
                    }
                }
            } catch (IOException e) {
                System.out.println(e);
            } finally {
                if (out != null) {
                    synchronized (writers) {
                        writers.remove(out);
                    }
                }
                if (name != null) {
                    for (PrintWriter writer : writers) {
                        writer.println("MESSAGE " + name + " has left the chat");
                    }
                }
                try {
                    socket.close();
                } catch (IOException e) {
                }
            }
        }
    }
}