package org.example.krofianmatrixcode.controller;

import org.example.krofianmatrixcode.service.InspectionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class UploadController {

    private final InspectionService inspectionService;

    public UploadController(InspectionService inspectionService) {
        this.inspectionService = inspectionService;
    }

    @PostMapping("/upload")
    public ResponseEntity<Void> upload(
            @RequestParam("image") MultipartFile image) {
        try {
            inspectionService.addInspection(
                    image.getOriginalFilename(),
                    image.getContentType(),
                    image.getBytes());

            return ResponseEntity.ok().build();
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }
}
