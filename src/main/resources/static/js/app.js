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

const inspectionList = document.getElementById("inspectionList");

const previousButton = document.getElementById("previousButton");
const nextButton = document.getElementById("nextButton");
const deleteButton = document.getElementById("deleteButton");
const imageName = document.getElementById("imageName");

let groups = [];

let selectedGroup = null;
let selectedCard = null;

let images = [];
let currentImageIndex = 0;

/* ======================================================= */

async function refresh() {

    const response = await fetch("/inspections");

    groups = await response.json();

    renderGroups();
}

/* ======================================================= */

function renderGroups() {

    inspectionList.innerHTML = "";

    groups.forEach(group => {

        const card = document.createElement("div");

        card.className = "card";

        const received =
            group.receivedAt
                ? new Date(group.receivedAt).toLocaleString()
                : "";

        card.innerHTML = `
            <div class="station">${group.station}</div>

            <div class="matrix">${group.matrixCode}</div>

            <div class="count">${group.imageCount} snímků</div>

            <div class="time">${received}</div>
        `;

        card.onclick = async () => {

            if (selectedCard)
                selectedCard.classList.remove("selected");

            selectedCard = card;

            card.classList.add("selected");

            await loadGroup(group);
        };

        inspectionList.appendChild(card);

    });

}

/* ======================================================= */

async function loadGroup(group) {

    selectedGroup = group;

    const response = await fetch("/inspection/" + group.id);

    images = await response.json();

    currentImageIndex = 0;

    deleteButton.disabled = false;

    previousButton.disabled = images.length <= 1;
    nextButton.disabled = images.length <= 1;

    showImage();
}

/* ======================================================= */

function showImage() {

    if (images.length === 0) {

        imageName.innerText = "Žádný snímek";

        viewer.close();

        return;
    }

    const image = images[currentImageIndex];

    imageName.innerText = image.inspectionName;

    viewer.open({
        type: "image",
        url: "/image/" + image.id
    });

    previousButton.disabled = currentImageIndex === 0;
    nextButton.disabled = currentImageIndex === images.length - 1;

}

/* ======================================================= */

previousButton.onclick = () => {

    if (currentImageIndex === 0)
        return;

    currentImageIndex--;

    showImage();

};

/* ======================================================= */

nextButton.onclick = () => {

    if (currentImageIndex >= images.length - 1)
        return;

    currentImageIndex++;

    showImage();

};

/* ======================================================= */

deleteButton.onclick = async () => {

    if (selectedGroup == null)
        return;

    if (!confirm("Opravdu chcete odstranit tento NOK kus?"))
        return;

    await fetch("/inspection/" + selectedGroup.id, {
        method: "DELETE"
    });

    viewer.close();

    imageName.innerText = "Žádný snímek";

    images = [];

    currentImageIndex = 0;

    selectedGroup = null;

    deleteButton.disabled = true;

    refresh();

};

/* ======================================================= */

const eventSource = new EventSource("/subscribe");

eventSource.addEventListener("inspection", () => {

    refresh();

});

eventSource.onerror = () => {

    console.log("SSE odpojeno");

};

eventSource.onopen = () => {
    console.log("SSE connected");
};

eventSource.onerror = (e) => {
    console.log("SSE error", e);
};

eventSource.onmessage = (e) => {
    console.log("Default message:", e.data);
};

eventSource.addEventListener("inspection", (e) => {
    console.log("Inspection event:", e.data);
    refresh();
});
/* ======================================================= */

refresh();