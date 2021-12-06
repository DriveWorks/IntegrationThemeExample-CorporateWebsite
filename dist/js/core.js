/**
 * SHARED CORE PAGE FUNCTIONS
 */

const SERVER_URL = config.serverUrl;
const GROUP_ALIAS = localStorage.getItem("sessionAlias");
const CURRENT_SESSION = localStorage.getItem("sessionId");

let client;

/**
 * Run on page load.
 */
(() => {
    // Check if Session Id exists
    checkStoredSessionId();

    // Quick Logout (?bye)
    // https://docs.driveworkspro.com/Topic/WebThemeLogout
    const coreQuery = new URLSearchParams(window.location.search);
    if (coreQuery.has("bye")) {
        handleLogout();
    }

    showUsername();
    attachLogoutActions();
    detectTouchDevice();
    handleMobileNavigationToggle();
})();

/**
 * DriveWorks Live client library loaded.
 */
function dwClientLoaded() {
    try {
        // Create client
        client = new window.DriveWorksLiveClient(SERVER_URL);

        // Set session id from stored value - set by and passed from login page
        client._sessionId = getLocalSession();
    } catch (error) {
        dwClientLoadError();
        return;
    }

    // Start individual page functions
    startPageFunctions();
}

/**
 * DriveWorks Live client library load error.
 */
function dwClientLoadError() {
    redirectToLogin("Cannot access client.", "error");
}

/**
 * Check Session Id exists locally.
 */
async function checkStoredSessionId() {
    // If no session is stored (e.g. not logged in), redirect to login
    if (CURRENT_SESSION === null || CURRENT_SESSION === "undefined") {
        handleUnauthorizedUser();
    }
}

/**
 * Add generic client error handling for unauthorized users.
 */
async function setCustomClientErrorHandler() {
    client.responseErrorDelegate = (res) => {
        if (res.status == 401) {
            handleUnauthorizedUser();
        }
    }
}

/**
 * Set login screen notice.
 * 
 * @param {string} text - The text displayed to the user on the login screen.
 * @param {string} [state] - The type of message state (error/success/info).
 */
function setLoginNotice(text, state = "info") {
    const notice = JSON.stringify({text, state});
    localStorage.setItem("loginNotice", notice);
}

/**
 * Redirect to login screen.
 * 
 * @param {string} notice - The text displayed to the user on the login screen.
 * @param {string} state - The type of message state (error/success/info).
 * @param {boolean} [noReturnUrl] - Optionally disable return url
 */
function redirectToLogin(notice, state, noReturnUrl) {

    // Clear Session from storage
    localStorage.clear();

    // Store login screen message
    if (notice && state) {
        setLoginNotice(notice, state);
    }

    // Redirect to login
    if (noReturnUrl || !config.loginReturnUrls) {
        window.location.replace("index.html");
        return;
    }

    // Redirect to login, with return url to restore position
    const currentLocation = window.location.pathname + window.location.search;
    window.location.replace(`index.html?returnUrl=${encodeURIComponent(currentLocation.substring(1))}`);
}

/**
 * Attach logout actions.
 */
function attachLogoutActions() {
    const logoutButtons = document.getElementsByClassName("logout-button");
    if (!logoutButtons) {
        return;
    }

    for (const logoutButton of logoutButtons) {
        logoutButton.addEventListener("click", handleLogout);
    }
}

/**
 * Redirect on logout.
 */
function logoutRedirect() {

    // Clear Session from storage
    localStorage.clear();

    // Redirect
    window.location.replace(config.logout.redirectUrl);
}

/**
 * Logout action.
 */
async function handleLogout() {
    try {
        await client.logoutAllGroups();
        logoutRedirect();
    } catch (error) {
        handleGenericError(error);
    }
}

/**
 * Handle unauthorized users.
 * 
 * @param {Object} error - Object representing originating error.
 */
function handleUnauthorizedUser(error) {
    let message = "Please login to view that.";
    if (error) {
        message = error;
    }

    redirectToLogin(message, "error");
}

/**
 * Mobile navigation toggle.
 */
function handleMobileNavigationToggle() {
    const navList = document.getElementById("nav-list");
    if (!navList) {
        return;
    }

    document.getElementById("nav-toggle").onclick = function () {
        document.body.classList.toggle("sidebar-open");
    };

    document.getElementById("nav-close").onclick = function () {
        document.body.classList.remove("sidebar-open");
    };
}

/**
 * Split string on uppercase.
 * "MyStringValue" => "My String Value".
 * 
 * @param {string} string - The string to split.
 */
function splitOnUpperCase(string) {
    return string.split(/(?=[A-Z])/).join(" ");
}

/**
 * Format string to remove (clean) special characters, lowercase & hyphenate whitespace for class & file names.
 * e.g. "Total (Plus VAT) " => "total-plus-vat".
 * 
 * @param {string} string - The string to normalize.
 */
function normalizeString(string) {
    string = string.toLowerCase();
    string = string.replaceAll(/[^a-zA-Z0-9 _-]/g, ""); // Strip all characters excluding: alphanumeric, whitespace, underscore, hyphen
    string = string.trim(); // Remove outer whitespace
    string = string.replaceAll(/ +/g, "-"); // Convert whitespace to hyphens
    return string;
}

/**
 * Check if 2 objects are equal.
 * 
 * @param {Object} a - The 1st object to compare.
 * @param {Object} b - The 2nd object to compare.
 */
function objectsEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Check if object is empty.
 * 
 * @param {Object} obj - The object to check for content.
 */
function isEmpty(obj) {
    return Object.keys(obj).length === 0;
}

/**
 * Visual output of username.
 */
function showUsername() {
    const usernameOutput = document.getElementById("active-username");
    const username = localStorage.getItem("sessionUsername");
    if (!username || !usernameOutput) {
        return;
    }

    usernameOutput.classList.add("is-shown");
    document.querySelector("#active-username .username").innerHTML = username;
}

/**
* Detect touch devices - alter UI accordingly.
*/
function detectTouchDevice() {
    try {
        document.createEvent("TouchEvent");
        document.body.classList.add("touch");
    } catch (error) {
        document.body.classList.add("no-touch");
    }
}

/**
 * Get local Session Id from storage - between pages.
 */
getLocalSession = () => localStorage.getItem("sessionId");

/**
 * Handle generic error.
 * 
 * @param {Object} error - Error object to handle.
 */
function handleGenericError(error) {
    console.log(error);
}
