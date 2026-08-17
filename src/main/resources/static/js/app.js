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

let appState = AppState.WAITING;

let groups = [];

let selectedGroup = null;

let images = [];
let currentImageIndex = 0;

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


/* ======================================================= */
/* REFRESH                                                 */
/* ======================================================= */

async function refresh() {

    try {

        const response = await fetch("/inspections");

        if (!response.ok) {
            console.error("Nepodařilo se načíst inspections.");
            return;
        }

        groups = await response.json();

        /*
         * Backend vrací skupiny od nejnovější.
         */
        if (groups.length === 0) {

            selectedGroup = null;

            renderGroups();

            showWaitingScreen();

            return;
        }

        const newestGroup = groups[0];

        /*
         * Pokud přišel nový NOK,
         * automaticky ho otevřeme.
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
            "Chyba při načítání inspections:",
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
                ${group.imageCount} snímků
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
     * Nový NOK
     */
    if (resetIndex) {

        currentImageIndex = 0;

        appState = AppState.VIEWING;
    }

    /*
     * Pokud během zobrazování přišly
     * další fotografie stejného NOK,
     * zachováme aktuální index.
     */
    if (
        currentImageIndex
        >= images.length
    ) {
        currentImageIndex =
            Math.max(0, images.length - 1);
    }

    /*
     * Mohli jsme si myslet, že jsme
     * na posledním snímku, ale Zebra
     * mezitím poslala další.
     */
    if (
        appState === AppState.CONFIRMATION
        && currentImageIndex < images.length - 1
    ) {

        appState = AppState.VIEWING;
    }

    deleteButton.disabled = false;

    if (appState === AppState.CONFIRMATION) {

        showConfirmationScreen();

        return;
    }

    showImage();
}


/* ======================================================= */
/* SHOW IMAGE                                              */
/* ======================================================= */

function showImage() {

    if (images.length === 0) {

        imageName.innerText =
            "Žádný snímek";

        viewer.close();

        return;
    }

    appState = AppState.VIEWING;

    hideStatus();

    const image =
        images[currentImageIndex];

    imageName.innerText =
        image.inspectionName
        + "   "
        + (currentImageIndex + 1)
        + " / "
        + images.length;

    viewer.open({
        type: "image",
        url: "/image/" + image.id
    });

    previousButton.disabled =
        currentImageIndex === 0;

    nextButton.disabled =
        currentImageIndex
        === images.length - 1;
}


/* ======================================================= */
/* WAITING SCREEN                                          */
/* ======================================================= */

function showWaitingScreen() {

    appState = AppState.WAITING;

    images = [];

    currentImageIndex = 0;

    viewer.close();

    imageName.innerText =
        "Čeká se na další díl";

    previousButton.disabled = true;
    nextButton.disabled = true;
    deleteButton.disabled = true;

    showStatus(`
        <div class="status-title">
            Čeká se na další díl
        </div>

        <div class="status-description">
            Naskenujte další NOK kus
        </div>
    `);
}


/* ======================================================= */
/* CONFIRMATION                                            */
/* ======================================================= */

function showConfirmationScreen() {

    appState =
        AppState.CONFIRMATION;

    previousButton.disabled = true;
    nextButton.disabled = true;

    showStatus(`
        <div class="status-title">
            Poslední snímek
        </div>

        <div class="status-description">
            Opravdu chcete pokračovat?
        </div>

        <div class="status-action">
            Pro potvrzení stiskněte
            znovu fyzické tlačítko
        </div>
    `);
}


/* ======================================================= */
/* PHYSICAL NEXT SIGNAL                                    */
/* ======================================================= */

function handleNextSignal() {

    console.log(
        "NEXT signal, state:",
        appState
    );

    /*
     * Čekáme na nový NOK.
     * Tlačítko nic nedělá.
     */
    if (appState === AppState.WAITING) {
        return;
    }

    /*
     * Druhé stisknutí na potvrzovací
     * obrazovce dokončí NOK.
     */
    if (
        appState === AppState.CONFIRMATION
    ) {

        finishInspection();

        return;
    }

    /*
     * Máme další snímek.
     */
    if (
        currentImageIndex
        < images.length - 1
    ) {

        currentImageIndex++;

        showImage();

        return;
    }

    /*
     * Jsme na posledním snímku.
     * První stisk zobrazí potvrzení.
     */
    showConfirmationScreen();
}


/* ======================================================= */
/* FINISH INSPECTION                                       */
/* ======================================================= */

async function finishInspection() {

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
                "/inspection/" + groupId,
                {
                    method: "DELETE"
                }
            );

        if (!response.ok) {

            throw new Error(
                "NOK se nepodařilo dokončit."
            );
        }

        selectedGroup = null;

        groups = [];

        images = [];

        currentImageIndex = 0;

        showWaitingScreen();

        await refresh();

    } catch (error) {

        console.error(
            "Chyba při dokončení NOK:",
            error
        );

        /*
         * Pokud DELETE selže,
         * zůstaneme na potvrzení.
         */
        appState =
            AppState.CONFIRMATION;

        showConfirmationScreen();

    } finally {

        finishing = false;
    }
}


/* ======================================================= */
/* MOUSE CONTROLS                                          */
/* ======================================================= */

previousButton.onclick = () => {

    if (
        appState !== AppState.VIEWING
    ) {
        return;
    }

    if (currentImageIndex === 0) {
        return;
    }

    currentImageIndex--;

    showImage();
};


nextButton.onclick = () => {

    if (
        appState !== AppState.VIEWING
    ) {
        return;
    }

    if (
        currentImageIndex
        >= images.length - 1
    ) {
        return;
    }

    currentImageIndex++;

    showImage();
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
            "Opravdu chcete odstranit tento NOK kus?"
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
 * Nové fotografie / nový NOK
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
 * Signál fyzického tlačítka
 */
eventSource.addEventListener(
    "next-image",
    event => {

        console.log(
            "Physical NEXT:",
            event.data
        );

        handleNextSignal();
    }
);


/* ======================================================= */

refresh();