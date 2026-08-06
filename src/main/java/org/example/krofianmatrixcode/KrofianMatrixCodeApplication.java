package org.example.krofianmatrixcode;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import javax.swing.*;

@SpringBootApplication
public class KrofianMatrixCodeApplication {

    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {
            // Create a simple GUI frame
            JFrame frame = new JFrame("AMViewer");
            JLabel label = new JLabel("Application is running!", SwingConstants.CENTER);
            frame.add(label);

            // Configure the frame
            frame.setSize(300, 150);
            frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
            frame.setVisible(true);
        });
        SpringApplication.run(KrofianMatrixCodeApplication.class, args);
    }
}


