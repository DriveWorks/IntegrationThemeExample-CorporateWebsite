/**
 * SHARED CORE PAGE FUNCTIONS
 */

const SERVER_URL = config.serverUrl;
const PING_INTERVAL = config.pingInterval;
const GROUP_ALIAS = localStorage.getItem("sessionAlias");
const CURRENT_SESSION = localStorage.getItem("sessionId");
let client;

/**
 * Run on page load
 */
(() => {
    // Check if Session Id exists
    checkStoredSessionId();

    showUsername();
    detectTouchDevice();
    attachLogoutActions();
})();

/**
 * DriveWorks Live client library loaded
 */
function dwClientLoaded() {
    try {
        // Create client
        client = new window.DriveWorksLiveClient(SERVER_URL);

        // Set session id from stored value - set by and passed from login page
        client._sessionId = getLocalSession();
    } catch (error) {
        handleUnauthorizedUser("Cannot access client.");
        return;
    }

    // Start individual page functions
    startPageFunctions();
}

/**
 * Quick Logout (?bye)
 * https://docs.driveworkspro.com/Topic/WebThemeLogout
 */
const coreQuery = new URLSearchParams(window.location.search);
if (coreQuery.has("bye")) {
    handleLogout();
}

/**
 * Check Session Id exists locally
 */
async function checkStoredSessionId() {
    // If no session is stored (e.g. not logged in), redirect to login
    if (CURRENT_SESSION === null || CURRENT_SESSION === "undefined") {
        handleUnauthorizedUser();
    }
}

/**
 * Set login screen notice
 */
function setLoginNotice(text, state) {
    if (!state) {
        state = "info";
    }

    const notice = JSON.stringify({text,state});
    localStorage.setItem("loginNotice", notice);
}

/**
 * Redirect to login screen
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
 * Redirect on logout (destination set in config)
 */
function logoutRedirect() {

    // Clear Session from storage
    localStorage.clear();

    // Redirect
    window.location.replace(config.logout.redirectUrl);
}

/**
 * Logout action
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
 * Handle unauthorized users
 */
function handleUnauthorizedUser(error) {
    let message = "Please login to view that.";
    if (error) {
        message = error;
    }

    redirectToLogin(message, "error");
}

/**
 * Mobile navigation toggle (closed by default)
 */
const navList = document.getElementById("nav-list");
if (navList) {
    const navToggle = document.getElementById("nav-toggle");
    const navClose = document.getElementById("nav-close");

    navToggle.onclick = function() {
        document.body.classList.toggle("sidebar-open");
    };

    navClose.onclick = function () {
        document.body.classList.remove("sidebar-open");
    };
}

/**
 * Split string on uppercase
 */
function splitOnUpperCase(string) {
    return string.match(/[A-Z][a-z]+|[0-9]+/g).join(" ");
}

/**
 * Convert string formatting to lowercase & dashed  (e.g. "Total Price" => "total-price" )
 */
function stringToLowerDashed(string) {
    string = string.toLowerCase();
    string = string.replace(/[^a-zA-Z ]/g, "");
    string = string.replace(" ", "-");

    return string;
}

/**
 * Check if 2 objects are equal
 */
function objectsEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Check object is empty
 */
function isEmpty(obj) {
    return Object.keys(obj).length === 0;
}

/**
 * Visual output of username
 */
function showUsername() {
    const usernameOutput = document.getElementById("active-username");
    const username = localStorage.getItem("sessionUsername");
    if (!username || !usernameOutput ) {
        return;
    }

    usernameOutput.classList.add("is-shown");
    document.querySelector("#active-username .username").innerHTML = username;
}

/**
* Detect touch devices (alter UI accordingly)
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
 * Get local Session Id from storage (between pages)
 */
getLocalSession = () => localStorage.getItem("sessionId");

/**
 * Handle generic error
 */
function handleGenericError(error) {
    console.log(error);
}
