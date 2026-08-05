package org.example.krofianmatrixcode.service;

import org.example.krofianmatrixcode.dto.InspectionGroupDto;
import org.example.krofianmatrixcode.model.InspectionGroup;
import org.example.krofianmatrixcode.model.InspectionImage;
import org.example.krofianmatrixcode.model.ParsedFileName;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class InspectionService {

    private final Map<UUID, InspectionGroup> groups = new ConcurrentHashMap<>();

    private final Map<String, UUID> groupIndex = new ConcurrentHashMap<>();

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    private String currentMatrixCode = null;

    public void addInspection(
            String fileName,
            String contentType,
            byte[] imageBytes) {
        ParsedFileName parsed = parseFileName(fileName);

        String matrixCode = parsed.matrixCode();
        String station = parsed.station();
        String inspectionName = parsed.inspectionName();

        if (currentMatrixCode == null || !currentMatrixCode.equals(matrixCode)) {
            groups.clear();
            groupIndex.clear();
            currentMatrixCode = matrixCode;
        }

        String key = station + "|" + matrixCode;

        InspectionGroup group;

        UUID groupId = groupIndex.get(key);

        if (groupId == null) {
            group = new InspectionGroup();

            group.setId(UUID.randomUUID());
            group.setStation(station);
            group.setMatrixCode(matrixCode);
            group.setReceivedAt(LocalDateTime.now());

            groups.put(group.getId(), group);

            groupIndex.put(key, group.getId());

        } else {
            group = groups.get(groupId);
            boolean alreadyExists = group.getImages().stream()
                    .anyMatch(img -> img.getInspectionName().equals(inspectionName));

            if (alreadyExists) {
                return;
            }
        }

        InspectionImage image = new InspectionImage();

        image.setId(UUID.randomUUID());
        image.setInspectionName(inspectionName);
        image.setContentType(contentType);
        image.setImage(imageBytes);

        group.getImages().add(image);

        notifyClients();
    }

    public List<InspectionGroupDto> getGroups() {
        return groups.values()
                .stream()
                .sorted(
                        Comparator.comparing(InspectionGroup::getReceivedAt)
                                .reversed())
                .map(group -> new InspectionGroupDto(
                        group.getId(),
                        group.getStation(),
                        group.getMatrixCode(),
                        group.getImages().size(),
                        group.getReceivedAt()
                ))
                .toList();
    }

    public InspectionGroup getGroup(UUID id) {
        return groups.get(id);
    }

    public void deleteGroup(UUID id) {
        InspectionGroup group = groups.remove(id);

        if (group == null)
            return;

        String key = group.getStation() + "|" + group.getMatrixCode();

        groupIndex.remove(key);

        notifyClients();
    }

    public InspectionImage findImage(UUID imageId) {
        for (InspectionGroup group : groups.values()) {
            for (InspectionImage image : group.getImages()) {
                if (image.getId().equals(imageId)) {
                    return image;
                }
            }
        }
        return null;
    }

    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(0L);

        emitters.add(emitter);

        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(e -> emitters.remove(emitter));

        return emitter;
    }

    private void notifyClients() {

        System.out.println("Notify clients: " + emitters.size());

        List<SseEmitter> dead = new ArrayList<>();

        for (SseEmitter emitter : emitters) {

            try {

                System.out.println("Sending SSE...");

                emitter.send(
                        SseEmitter.event()
                                .name("inspection")
                                .data("refresh")
                );

            } catch (Exception ex) {
                ex.printStackTrace();
                dead.add(emitter);
            }
        }
        emitters.removeAll(dead);
    }

    private ParsedFileName parseFileName(String fileName) {
        String name = fileName;
        int dot = name.lastIndexOf('.');
        if (dot > 0) {
            name = name.substring(0, dot);
        }

        String[] parts = name.split("_");
        if (parts.length < 3) {
            throw new IllegalArgumentException(
                    "Neplatný název souboru: " + fileName);
        }

        String matrixCode = parts[0];
        String station = parts[parts.length - 1];
        String inspectionName = String.join(
                "_",
                Arrays.copyOfRange(parts, 1, parts.length - 1));

        return new ParsedFileName(
                matrixCode,
                inspectionName,
                station);
    }
}
