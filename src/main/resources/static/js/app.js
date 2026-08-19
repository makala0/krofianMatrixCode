let viewer = OpenSeadragon({
    id: "viewer",
    prefixUrl: "https://cdnjs.cloudflare.com/ajax/libs/openseadragon/5.0.1/images/",

    showNavigator: true,
    navigatorPosition: "BOTTOM_RIGHT",

    showZoomControl: true,
    showHomeControl: true,
    showFullPageControl: true,
    showRotationControl: false,

    animationTime: 0.4,
    blendTime: 0.1,
    maxZoomPixelRatio: 4,
    visibilityRatio: 1,
    constrainDuringPan: true
});

/* ======================================================= */
/* APP STATE                                               */
/* ======================================================= */

const AppState = {
    WAITING: "WAITING",
    VIEWING: "VIEWING",
    CONFIRMATION: "CONFIRMATION"
};

const Decision = {
    OK: "OK",
    NOK: "NOK"
};

let appState = AppState.WAITING;

let groups = [];

let selectedGroup = null;

let images = [];
let currentImageIndex = 0;

let pendingDecision = null;

let finishing = false;


/* ======================================================= */
/* ELEMENTS                                                */
/* ======================================================= */

const inspectionList =
    document.getElementById("inspectionList");

const previousButton =
    document.getElementById("previousButton");

const nextButton =
    document.getElementById("nextButton");

const deleteButton =
    document.getElementById("deleteButton");

const imageName =
    document.getElementById("imageName");

const viewerElement =
    document.getElementById("viewer");


/* ======================================================= */
/* STATUS OVERLAY                                          */
/* ======================================================= */

const statusOverlay = document.createElement("div");

statusOverlay.id = "statusOverlay";
statusOverlay.className = "viewer-status hidden";

viewerElement.appendChild(statusOverlay);

function showStatus(message) {

    statusOverlay.innerHTML = message;

    statusOverlay.classList.remove("hidden");
}


function hideStatus() {

    statusOverlay.classList.add("hidden");
}


function setLastImageWarning(visible) {

    viewerElement.classList.toggle(
        "last-image-viewer",
        visible
    );

    imageName.classList.toggle(
        "last-image-name",
        visible
    );
}


/* ======================================================= */
/* REFRESH                                                 */
/* ======================================================= */

async function refresh() {

    try {

        const response = await fetch("/inspections");

        if (!response.ok) {
            console.error("Failed to load inspections.");
            return;
        }

        groups = await response.json();

        /*
         * Backend returns groups from newest to oldest.
         */
        if (groups.length === 0) {

            selectedGroup = null;

            renderGroups();

            showWaitingScreen();

            return;
        }

        const newestGroup = groups[0];

        /*
         * If a new NOK arrives,
         * open it automatically.
         */
        const newGroup =
            selectedGroup == null
            || selectedGroup.id !== newestGroup.id;

        await loadGroup(
            newestGroup,
            newGroup
        );

        renderGroups();

    } catch (error) {

        console.error(
            "Error while loading inspections:",
            error
        );
    }
}


/* ======================================================= */
/* GROUP LIST                                              */
/* ======================================================= */

function renderGroups() {

    inspectionList.innerHTML = "";

    groups.forEach(group => {

        const card = document.createElement("div");

        card.className = "card";

        if (
            selectedGroup != null
            && selectedGroup.id === group.id
        ) {
            card.classList.add("selected");
        }

        const received =
            group.receivedAt
                ? new Date(group.receivedAt).toLocaleString()
                : "";

        card.innerHTML = `
            <div class="station">${group.station}</div>

            <div class="matrix">
                ${group.matrixCode}
            </div>

            <div class="count">
                ${group.imageCount} images
            </div>

            <div class="time">
                ${received}
            </div>
        `;

        card.onclick = async () => {

            await loadGroup(
                group,
                true
            );

            renderGroups();
        };

        inspectionList.appendChild(card);
    });
}


function getSelectedGroupIndex() {

    if (selectedGroup == null) {
        return -1;
    }

    return groups.findIndex(
        group => group.id === selectedGroup.id
    );
}


function getNextGroup() {

    const selectedGroupIndex =
        getSelectedGroupIndex();

    if (selectedGroupIndex < 0) {
        return null;
    }

    return groups[selectedGroupIndex + 1] ?? null;
}


function isLastInspectionImage() {

    return currentImageIndex === images.length - 1
        && getNextGroup() == null;
}


/* ======================================================= */
/* LOAD GROUP                                              */
/* ======================================================= */

async function loadGroup(
    group,
    resetIndex = true
) {

    selectedGroup = group;

    const response =
        await fetch(
            "/inspection/" + group.id
        );

    if (!response.ok) {
        return;
    }

    const newImages =
        await response.json();

    images = newImages;

    /*
     * New NOK
     */
    if (resetIndex) {

        currentImageIndex = 0;

        pendingDecision = null;

        appState = AppState.VIEWING;
    }

    /*
     * If more photos of the same NOK arrive
     * while it is being viewed,
     * keep the current index.
     */
    if (
        currentImageIndex
        >= images.length
    ) {
        currentImageIndex =
            Math.max(0, images.length - 1);
    }

    /*
     * We may have thought we were
     * on the last image, but Zebra
     * sent another one in the meantime.
     */
    if (
        appState === AppState.CONFIRMATION
        && currentImageIndex < images.length - 1
    ) {

        appState = AppState.VIEWING;
    }

    deleteButton.disabled = false;

    if (appState === AppState.CONFIRMATION) {

        showConfirmationScreen(pendingDecision);

        return;
    }

    showImage();
}


/* ======================================================= */
/* SHOW IMAGE                                              */
/* ======================================================= */

function showImage() {

    if (images.length === 0) {

        setLastImageWarning(false);

        imageName.innerText =
            "No image";

        viewer.close();

        return;
    }

    appState = AppState.VIEWING;

    hideStatus();

    const lastImage =
        isLastInspectionImage();

    setLastImageWarning(lastImage);

    const image =
        images[currentImageIndex];

    imageName.innerText =
        image.inspectionName
        + "   "
        + (currentImageIndex + 1)
        + " / "
        + images.length
        + (
            lastImage
                ? " - LAST IMAGE"
                : ""
        );

    viewer.open({
        type: "image",
        url: "/image/" + image.id
    });

    previousButton.disabled =
        false;

    nextButton.disabled =
        false;
}


/* ======================================================= */
/* WAITING SCREEN                                          */
/* ======================================================= */

function showWaitingScreen() {

    appState = AppState.WAITING;

    images = [];

    currentImageIndex = 0;

    pendingDecision = null;

    viewer.close();

    setLastImageWarning(false);

    imageName.innerText =
        "Waiting for the next part";

    previousButton.disabled = true;
    nextButton.disabled = true;
    deleteButton.disabled = true;

    showStatus(`
        <div class="status-title">
            Waiting for the next part
        </div>

        <div class="status-description">
            Scan the next NOK part
        </div>
    `);
}


/* ======================================================= */
/* CONFIRMATION                                            */
/* ======================================================= */

function showConfirmationScreen(decision) {

    pendingDecision =
        decision;

    appState =
        AppState.CONFIRMATION;

    previousButton.disabled = false;
    nextButton.disabled = false;

    setLastImageWarning(false);

    showStatus(`
        <div class="status-title">
            Last image
        </div>

        <div class="status-description">
            Do you want to release or reject the part?
        </div>

        <div class="status-action">
            OK releases the part, NOK rejects it
        </div>
    `);
}


/* ======================================================= */
/* PHYSICAL NEXT SIGNAL                                    */
/* ======================================================= */

async function handleNextSignal() {

    await handleControlSignal(Decision.OK);
}


async function handleControlSignal(decision) {

    console.log(
        "Control signal, state:",
        appState,
        "decision:",
        decision
    );

    if (appState === AppState.WAITING) {
        return;
    }

    if (appState === AppState.CONFIRMATION) {

        await finishInspection(decision);

        return;
    }

    if (isLastInspectionImage()) {

        showConfirmationScreen(null);

        return;
    }

    await showNextInspectionImage();
}


async function showNextInspectionImage() {

    if (currentImageIndex < images.length - 1) {

        currentImageIndex++;

        showImage();

        return;
    }

    const nextGroup =
        getNextGroup();

    if (nextGroup != null) {

        await loadGroup(
            nextGroup,
            true
        );

        renderGroups();
    }
}


/* ======================================================= */
/* FINISH INSPECTION                                       */
/* ======================================================= */

async function finishInspection(decision) {

    if (
        finishing
        || selectedGroup == null
    ) {
        return;
    }

    finishing = true;

    const groupId =
        selectedGroup.id;

    try {

        const response =
            await fetch(
                "/inspection/"
                    + groupId
                    + "?decision="
                    + decision.toLowerCase(),
                {
                    method: "DELETE"
                }
            );

        if (!response.ok) {

            throw new Error(
                "Failed to finish NOK."
            );
        }

        selectedGroup = null;

        groups = [];

        images = [];

        currentImageIndex = 0;

        pendingDecision = null;

        showWaitingScreen();

        await refresh();

    } catch (error) {

        console.error(
            "Error while finishing NOK:",
            error
        );

        /*
         * If DELETE fails,
         * stay on the confirmation screen.
         */
        appState =
            AppState.CONFIRMATION;

        showConfirmationScreen(decision);

    } finally {

        finishing = false;
    }
}


/* ======================================================= */
/* MOUSE CONTROLS                                          */
/* ======================================================= */

previousButton.onclick = async () => {

    if (
        appState === AppState.WAITING
    ) {
        return;
    }

    await handleControlSignal(Decision.NOK);
};


nextButton.onclick = async () => {

    if (
        appState === AppState.WAITING
    ) {
        return;
    }

    await handleControlSignal(Decision.OK);
};


/* ======================================================= */
/* MANUAL DELETE                                           */
/* ======================================================= */

deleteButton.onclick = async () => {

    if (selectedGroup == null) {
        return;
    }

    if (
        !confirm(
            "Do you really want to delete this NOK part?"
        )
    ) {
        return;
    }

    await fetch(
        "/inspection/" + selectedGroup.id,
        {
            method: "DELETE"
        }
    );

    selectedGroup = null;

    groups = [];

    images = [];

    currentImageIndex = 0;

    pendingDecision = null;

    showWaitingScreen();

    refresh();
};


/* ======================================================= */
/* SSE                                                     */
/* ======================================================= */

const eventSource =
    new EventSource("/subscribe");


eventSource.onopen = () => {

    console.log(
        "SSE connected"
    );
};


eventSource.onerror = (event) => {

    console.log(
        "SSE error",
        event
    );
};


/*
 * New photos / new NOK
 */
eventSource.addEventListener(
    "inspection",
    async event => {

        console.log(
            "Inspection event:",
            event.data
        );

        await refresh();
    }
);


/*
 * Physical button signal
 */
eventSource.addEventListener(
    "next-image",
    async event => {

        console.log(
            "Physical NEXT:",
            event.data
        );

        await handleControlSignal(Decision.OK);
    }
);


eventSource.addEventListener(
    "control",
    async event => {

        const decision =
            event.data === "nok"
                ? Decision.NOK
                : Decision.OK;

        console.log(
            "Physical control:",
            decision
        );

        await handleControlSignal(decision);
    }
);


/* ======================================================= */

refresh();
