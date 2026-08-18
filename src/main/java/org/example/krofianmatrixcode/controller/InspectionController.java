package org.example.krofianmatrixcode.controller;

import org.example.krofianmatrixcode.dto.InspectionDecisionDto;
import org.example.krofianmatrixcode.dto.InspectionImageDto;
import org.example.krofianmatrixcode.model.InspectionGroup;
import org.example.krofianmatrixcode.model.InspectionImage;
import org.example.krofianmatrixcode.service.InspectionService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.UUID;

@RestController
public class InspectionController {

    private final InspectionService inspectionService;

    public InspectionController(InspectionService inspectionService) {
        this.inspectionService = inspectionService;
    }

    @GetMapping("/inspections")
    public List<?> inspections() {
        return inspectionService.getGroups();
    }

    @GetMapping("/inspection/{groupId}")
    public List<InspectionImageDto> inspection(
            @PathVariable UUID groupId) {
        InspectionGroup group = inspectionService.getGroup(groupId);

        if (group == null)
            return List.of();

        return group.getImages()
                .stream()
                .map(image -> new InspectionImageDto(
                        image.getId(),
                        image.getInspectionName()
                ))
                .toList();
    }

    @GetMapping("/image/{imageId}")
    public ResponseEntity<byte[]> image(
            @PathVariable UUID imageId) {
        InspectionImage image =
                inspectionService.findImage(imageId);

        if (image == null)
            return ResponseEntity.notFound().build();

        return ResponseEntity.ok()
                .contentType(
                        MediaType.parseMediaType(
                                image.getContentType()))
                .body(image.getImage());
    }

    @DeleteMapping("/inspection/{groupId}")
    public void delete(
            @PathVariable UUID groupId,
            @RequestParam(required = false) String decision) {
        inspectionService.deleteGroup(
                groupId,
                decision == null
                        ? null
                        : decision.toLowerCase()
        );
    }

    @GetMapping("/inspection/decision")
    public InspectionDecisionDto decision() {
        return inspectionService.consumeDecision();
    }

    @PostMapping("/control/next")
    public ResponseEntity<Void> nextImage() {

        inspectionService.nextImage();

        return ResponseEntity.ok().build();
    }

    @PostMapping("/control/{decision}")
    public ResponseEntity<Void> control(
            @PathVariable String decision) {

        String normalizedDecision = decision.toLowerCase();

        if (!normalizedDecision.equals("ok") && !normalizedDecision.equals("nok")) {
            return ResponseEntity.badRequest().build();
        }

        inspectionService.control(normalizedDecision);

        return ResponseEntity.ok().build();
    }

    @GetMapping("/subscribe")
    public SseEmitter subscribe() {
        return inspectionService.subscribe();
    }
}
