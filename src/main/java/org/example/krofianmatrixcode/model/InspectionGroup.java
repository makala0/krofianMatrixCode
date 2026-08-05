package org.example.krofianmatrixcode.model;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
public class InspectionGroup {
    private UUID id;
    private String station;
    private String matrixCode;
    private LocalDateTime receivedAt;
    private final List<InspectionImage> images = new ArrayList<>();
}
