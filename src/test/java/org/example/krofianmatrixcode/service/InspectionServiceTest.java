package org.example.krofianmatrixcode.service;

import org.example.krofianmatrixcode.dto.InspectionDecisionDto;
import org.example.krofianmatrixcode.dto.InspectionGroupDto;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class InspectionServiceTest {

    @Test
    void queuesOnlyInitialAndFinalDecisionForOkInspection() {
        InspectionService service = new InspectionService();

        service.addInspection(
                "ABC123_inner_ST1.jpg",
                "image/jpeg",
                new byte[] {1}
        );

        List<InspectionGroupDto> groups = service.getGroups();
        UUID groupId = groups.get(0).id();

        assertTrue(service.publishDecision(groupId, "ok"));
        assertTrue(service.publishDecision(groupId, "ok"));

        InspectionDecisionDto initialDecision =
                service.consumeDecision();
        InspectionDecisionDto duplicatedInitialDecision =
                service.consumeDecision();

        service.deleteGroup(groupId, "ok");
        service.deleteGroup(groupId, "ok");

        InspectionDecisionDto finalDecision =
                service.consumeDecision();
        InspectionDecisionDto duplicatedFinalDecision =
                service.consumeDecision();

        assertTrue(initialDecision.available());
        assertTrue(initialDecision.decision());
        assertFalse(duplicatedInitialDecision.available());

        assertTrue(finalDecision.available());
        assertTrue(finalDecision.decision());
        assertFalse(duplicatedFinalDecision.available());
    }
}
