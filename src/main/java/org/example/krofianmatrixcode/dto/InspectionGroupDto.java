package org.example.krofianmatrixcode.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record InspectionGroupDto(
        UUID id,
        String station,
        String matrixCode,
        int imageCount,
        LocalDateTime receivedAt
) {
}
