/**
 * PROJECTS
 */

const CREDENTIALS = config.credentials;
const driveAppList = document.getElementById("drive-app-list");

/**
 * Start page functions.
 */
async function startPageFunctions() {

    // After short delay, show loading state (skip loading state entirely if very quick loading)
    const loadingTimeout = setTimeout(() => {
        driveAppList.style.opacity = "";
    }, 1000);

    try {
        setCustomClientErrorHandler();

        // Get DriveApps
        const driveApps = await client.getDriveApps(GROUP_ALIAS);
        clearTimeout(loadingTimeout);

        // (Optional) Order alphabetically by alias
        const orderedDriveApps = sortDriveAppsByAlias(driveApps);

        // Render DriveApps
        renderDriveApps(orderedDriveApps);
    } catch (error) {
        handleGenericError(error);
    }
};

/**
 * Render DriveApps to container.
 * 
 * @param {Object} driveApps - DriveAppData object.
 */
function renderDriveApps(driveApps) {

    // Clear loading state, show list
    driveAppList.innerHTML = "";
    driveAppList.style.opacity = "";

    // Empty state
    if (!driveApps || !driveApps.length) {
        driveAppList.innerHTML = `
            <div class="empty-drive-apps">
                <p>No DriveApps available.</p>
            </div>
        `;
        return;
    }

    // Loop out DriveApps
    for (let index = 0; index < driveApps.length; index++) {
        const driveApp = driveApps[index];
        const markup = `
            <div class="inner">
                <svg class="icon"><use xlink:href="dist/icons.svg#drive-app-item" /></svg>
                <div class="details">
                    <h4 class="drive-app-alias" title="${driveApp.alias}">${driveApp.alias}</h4>
                    <div class="drive-app-name" title="${driveApp.name}">${driveApp.name}</div>
                </div>
                <div class="drive-app-action">Start</div>
            </div>
        `;

        // Create DriveApp item
        const item = document.createElement("a");
        item.classList.add("drive-app-item");
        item.style.setProperty("--index", index);
        item.setAttribute("data-id", driveApp.id);
        item.href = `run.html?driveApp=${driveApp.alias}`;
        item.title = `Start DriveApp: ${driveApp.alias}`;
        item.innerHTML = markup;

        driveAppList.appendChild(item);

        // Animate entrance (hidden by default)
        item.classList.add("animate");
    }
}

/**
 * Order DriveApps alphabetically by alias.
 * @param {Object} driveApps - The unsorted DriveApps to order.
 */
function sortDriveAppsByAlias(driveApps) {
    return driveApps.sort((a, b) => {
        return a.alias.localeCompare(b.alias, undefined, { numeric: true, caseFirst: "upper" });
    });
}
