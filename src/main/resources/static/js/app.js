let viewer = OpenSeadragon({
    id: "viewer",
    prefixUrl: "https://cdnjs.cloudflare.com/ajax/libs/openseadragon/5.0.1/images/",

    showNavigator: false,

    showZoomControl: true,
    showHomeControl: true,
    showFullPageControl: false,
    showRotationControl: false,

    gestureSettingsMouse: {
        clickToZoom: true,
        dblClickToZoom: true,
        dragToPan: false,
        scrollToZoom: true
    },

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

const Language = {
    EN: "en",
    DE: "de"
};

const Text = {
    en: {
        noImage: "No image",
        waitingForPart: "Waiting for the next part",
        scanNextPart: "Scan the next part",
        lastImage: "LAST IMAGE",
        markedOk: "Part is marked as OK",
        markedNok: "Part is marked as NOK",
        confirmOk: "Press OK again to confirm",
        confirmNok: "Press NOK again to confirm",
        confirmationRequired: "confirmation required"
    },
    de: {
        noImage: "Kein Bild",
        waitingForPart: "Warten auf das naechste Teil",
        scanNextPart: "Naechstes Teil scannen",
        lastImage: "LETZTES BILD",
        markedOk: "Teil ist als OK markiert",
        markedNok: "Teil ist als NOK markiert",
        confirmOk: "Zum Bestaetigen erneut OK druecken",
        confirmNok: "Zum Bestaetigen erneut NOK druecken",
        confirmationRequired: "Bestaetigung erforderlich"
    }
};

let appState = AppState.WAITING;
let language =
    localStorage.getItem("language") ?? Language.EN;

if (!Text[language]) {
    language = Language.EN;
}

let groups = [];

let selectedGroup = null;

let images = [];
let currentImageIndex = 0;

let pendingDecision = null;

let finishing = false;
let deciding = false;


/* ======================================================= */
/* ELEMENTS                                                */
/* ======================================================= */

const previousButton =
    document.getElementById("previousButton");

const nextButton =
    document.getElementById("nextButton");

const englishButton =
    document.getElementById("englishButton");

const germanButton =
    document.getElementById("germanButton");

const imageName =
    document.getElementById("imageName");

const viewerElement =
    document.getElementById("viewer");


function setDecisionControlsEnabled(enabled) {

    if (previousButton != null) {
        previousButton.disabled = !enabled;
    }

    if (nextButton != null) {
        nextButton.disabled = !enabled;
    }
}


function t(key) {

    return Text[language][key];
}


function setLanguage(newLanguage) {

    language = newLanguage;
    localStorage.setItem("language", language);
    document.documentElement.lang = language;

    englishButton.classList.toggle(
        "active",
        language === Language.EN
    );

    germanButton.classList.toggle(
        "active",
        language === Language.DE
    );

    renderCurrentScreen();
}


function renderCurrentScreen() {

    if (appState === AppState.CONFIRMATION) {
        showConfirmationScreen(pendingDecision);
        return;
    }

    if (appState === AppState.VIEWING) {
        showImage();
        return;
    }

    showWaitingScreen();
}


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


function setInspectionResult(decision) {

    const okResult =
        decision === Decision.OK;

    viewerElement.classList.toggle(
        "inspection-ok-viewer",
        okResult
    );

    viewerElement.classList.toggle(
        "inspection-nok-viewer",
        !okResult
    );

    imageName.classList.toggle(
        "inspection-ok-name",
        okResult
    );

    imageName.classList.toggle(
        "inspection-nok-name",
        !okResult
    );
}


function clearInspectionResult() {

    viewerElement.classList.remove(
        "inspection-ok-viewer",
        "inspection-nok-viewer"
    );

    imageName.classList.remove(
        "inspection-ok-name",
        "inspection-nok-name"
    );

    statusOverlay.classList.remove(
        "status-ok",
        "status-nok"
    );
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

    } catch (error) {

        console.error(
            "Error while loading inspections:",
            error
        );
    }
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
            t("noImage");

        viewer.close();

        return;
    }

    appState = AppState.VIEWING;

    clearInspectionResult();

    hideStatus();

    const lastImage =
        isLastInspectionImage();

    setLastImageWarning(lastImage);

    const image =
        images[currentImageIndex];

    const station =
        selectedGroup?.station ?? "";

    const location =
        image.inspectionName;

    const imageTitle =
        station
            ? station + " - " + location
            : location;

    imageName.innerText =
        imageTitle
        + "   "
        + (currentImageIndex + 1)
        + " / "
        + images.length
        + (
            lastImage
                ? " - " + t("lastImage")
                : ""
        );

    viewer.open({
        type: "image",
        url: "/image/" + image.id
    });

    setDecisionControlsEnabled(true);
}


/* ======================================================= */
/* WAITING SCREEN                                          */
/* ======================================================= */

function showWaitingScreen() {

    appState = AppState.WAITING;

    images = [];

    currentImageIndex = 0;

    pendingDecision = null;

    clearInspectionResult();

    viewer.close();

    setLastImageWarning(false);

    imageName.innerText =
        t("waitingForPart");

    setDecisionControlsEnabled(false);

    showStatus(`
        <div class="status-title">
            ${t("waitingForPart")}
        </div>

        <div class="status-description">
            ${t("scanNextPart")}
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

    setDecisionControlsEnabled(true);

    setLastImageWarning(false);
    setInspectionResult(decision);

    const resultText =
        decision === Decision.OK
            ? "OK"
            : "NOK";

    const resultDescription =
        decision === Decision.OK
            ? t("markedOk")
            : t("markedNok");

    const confirmText =
        decision === Decision.OK
            ? t("confirmOk")
            : t("confirmNok");

    statusOverlay.classList.toggle(
        "status-ok",
        decision === Decision.OK
    );

    statusOverlay.classList.toggle(
        "status-nok",
        decision === Decision.NOK
    );

    imageName.innerText =
        resultText + " - " + t("confirmationRequired");

    showStatus(`
        <div class="status-title">
            ${resultText}
        </div>

        <div class="status-description">
            ${resultDescription}
        </div>

        <div class="status-action">
            ${confirmText}
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

        await finishInspection(
            pendingDecision ?? decision
        );

        return;
    }

    if (decision === Decision.NOK) {

        await decideInspection(Decision.NOK);

        return;
    }

    if (isLastInspectionImage()) {

        await decideInspection(Decision.OK);

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
    }
}


async function decideInspection(decision) {

    if (
        deciding
        || finishing
        || selectedGroup == null
    ) {
        return;
    }

    deciding = true;

    const groupId =
        selectedGroup.id;

    try {

        const response =
            await fetch(
                "/inspection/"
                    + groupId
                    + "/decision?decision="
                    + decision.toLowerCase(),
                {
                    method: "POST"
                }
            );

        if (!response.ok) {

            throw new Error(
                "Failed to send inspection decision."
            );
        }

        showConfirmationScreen(decision);

    } catch (error) {

        console.error(
            "Error while sending inspection decision:",
            error
        );

    } finally {

        deciding = false;
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
                "Failed to finish inspection."
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

if (previousButton != null) {
    previousButton.onclick = async () => {

        if (
            appState === AppState.WAITING
        ) {
            return;
        }

        await handleControlSignal(Decision.NOK);
    };
}


if (nextButton != null) {
    nextButton.onclick = async () => {

        if (
            appState === AppState.WAITING
        ) {
            return;
        }

        await handleControlSignal(Decision.OK);
    };
}


englishButton.onclick = () => {
    setLanguage(Language.EN);
};


germanButton.onclick = () => {
    setLanguage(Language.DE);
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

setLanguage(language);
refresh();
