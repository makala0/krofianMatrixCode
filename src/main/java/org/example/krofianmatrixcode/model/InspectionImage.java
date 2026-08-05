package org.example.krofianmatrixcode.model;

import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Getter
@Setter
public class InspectionImage {
    private UUID id;
    private String inspectionName;
    private byte[] image;
    private String contentType;
}
