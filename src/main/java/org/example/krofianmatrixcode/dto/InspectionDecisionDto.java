package org.example.krofianmatrixcode.dto;

import java.time.LocalDateTime;

public record InspectionDecisionDto(
        boolean available,
        String matrixCode,
        Boolean decision,
        LocalDateTime decidedAt
) {

    public static InspectionDecisionDto empty() {
        return new InspectionDecisionDto(
                false,
                null,
                null,
                null
        );
    }
}
