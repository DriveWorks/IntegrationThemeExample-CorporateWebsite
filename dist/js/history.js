/**
 * SPECIFICATION HISTORY
 */

const defaultLimit = 10;
const defaultOrder = "desc";

const historyList = document.getElementById("history-content");

let isLoadingHistory = false;
let blockLazyLoading = false;

/**
 * Start page functions
 */
 function startPageFunctions() {

    // Reset filter position (from previous scroll)
    localStorage.removeItem("lastFilterPosition");

    // Get last stored query (if set)
    const oDataQueryString = getStoredQuery();
    getSpecificationsWithQuery(oDataQueryString, true);
};

/**
 * Restore previous filter query
 */
function getStoredQuery(top, skip) {
    let query = "$top=";

    // Set limit (top)
    if (top) {
        query += top;
    } else {
        query += defaultLimit;
    }

    // Starting starting point (skip)
    if (skip) {
        query += "&$skip=" + skip;
    }

    // Get previous ordering
    let filterOrder = localStorage.getItem("lastFilterOrder");
    if (!filterOrder) {
        filterOrder = defaultOrder;
    }
    query += `&$orderby=DateEdited ${filterOrder}`;

    // Filter out running Specifications (shouldn't be accessible)
    query += "&$filter=StateType ne 'Running'";

    // Get previous name
    const filterName = localStorage.getItem("lastFilterName");
    if (filterName) {
        query += `and contains(tolower(name), tolower('${filterName}'))`;
        document.getElementById("filter-input").value = filterName;
    }

    return query;
}

/**
 * Get Specifications by query
 */
async function getSpecificationsWithQuery(oDataQueryString = "", clearList = false) {

    // Reset lazy-load blocking
    blockLazyLoading = false;

    try {
        const specifications = await client.getAllSpecifications(GROUP_ALIAS, oDataQueryString);

        // If Specifications is undefined (due to no connection)
        // - if nothing matches the given query, an empty Array [] is returned - not undefined.
        // - if the user's Session is invalid, an error string is returned - not undefined.
        if (!specifications) {
            handleUnauthorizedUser("No connection found.");
            return;
        }

        // Remove empty message (if previously shown)
        hideEmptyResults();

        // If 0 items are returned, block further loading
        const specificationCount = specifications.length;
        if (specificationCount === 0) {
            blockLazyLoading = true;

            clearLoadingState();
            if (clearList) {
                showEmptyResults();
            }

            return;
        }

        // If response is less than limit, disable further loading (no more items to be shown after this)
        if (specificationCount < defaultLimit) {
            blockLazyLoading = true;
        }

        // Get attached Properties for each Specification (for expanded view)
        const properties = [];
        for (let index = 0; index < specifications.length; index++) {
            const specification = specifications[index];
            try {

                // Get Specification Properties
                const props = await client.getSpecificationProperties(GROUP_ALIAS, specification.id);
                const propertyMarkup = generateProperties(props);

                properties.push(propertyMarkup);
            } catch (error) {
                handleGenericError(error);
            }
        }

        // Render
        renderSpecifications(specifications, properties, clearList);
    } catch (error) {
        handleGenericError(error);

        // If authorization error, handle appropriately
        if (String(error).includes("401")) {
            handleUnauthorizedUser();
            return;
        }
    }
}

/**
 * Render Specifications to container
 */
async function renderSpecifications(specifications, properties, clearList = false) {

    // Clear Specification list (optional: lazy-load adds to existing list)
    if (clearList) {
        clearHistoryList();
        window.scroll(0,0);
    }

    // Remove loading states
    clearActionsLoading();
    document.body.classList.remove("is-loading");

    // Build markup
    for (let index = 0; index < specifications.length; index++) {
        generateHistoryItem(specifications[index], properties[index], index);
    }
}

/**
 * Generate Property markup
 */
function generateProperties(properties) {
    let propertyMarkup = "";
    for (const [name, value] of Object.entries(properties)) {
        const markup = `
            <div class="prop-item prop-${stringToLowerDashed(name)}">
                <div>${name}: </div>
                <div>${value}</div>
            </div>
        `;
        propertyMarkup += markup;
    }

    return propertyMarkup;
}

/**
 * Generate history item markup
 */
function generateHistoryItem(specification, propertyMarkup, index) {
    const id = specification.id;
    const name = specification.name;
    const status = specification.stateName;
    const dateEdited = specification.dateEdited;
    const markup = `
        <a href="details.html?specification=${specification.id}" class="item-details">
            <h3 class="item-name">${name}</h3>
            ${ status && `<div><div class="status-tag status-${stringToLowerDashed(status)}">${splitOnUpperCase(status)}</div></div>`}
            ${ dateEdited && `<div class="edit-date">${new Date(dateEdited).toLocaleString("en-GB", { minimumFractionDigits: 2 })}</div>`}
            <div><div class="view-action button">View</div></div>
        </a>
        ${ propertyMarkup && `
            <div class="item-properties">
                ${propertyMarkup}
            </div>
        `}
    `;

    // Generate element
    const item = document.createElement("div");
    item.classList.add("history-item");
    item.style.setProperty("--index", index);
    item.setAttribute("data-id", id);
    item.innerHTML = markup;

    // Remove loading state (after first item injected)
    clearLoadingState();

    // Inject new Specification item
    historyList.appendChild(item);
}

/**
 * Load on scroll
 */
window.onscroll = function () {

    // If scrolled to the end of the page body
    if ( (window.innerHeight + window.scrollY) >= document.body.scrollHeight - 1 ) {

        // If loading isn't blocked (no more items) or already loading (stop duplication)
        if (!blockLazyLoading && !isLoadingHistory) {
            getNextPaginationChunk();
        }
    }
};

/**
 * Load next chunk
 */
function getNextPaginationChunk() {

    // Prevent parallel loading
    isLoadingHistory = true;

    // Show loading state
    addLoadingState();

    // Get saved filter position (results previously shown)
    const lastFilterPosition = localStorage.getItem("lastFilterPosition");
    if (lastFilterPosition) {
        newPosition = parseFloat(lastFilterPosition);
    } else {
        newPosition = defaultLimit;
    }

    // Append new Specifications
    const oDataQueryString = getStoredQuery(defaultLimit, newPosition);
    getSpecificationsWithQuery(oDataQueryString);

    // Increment stored position (to match items shown)
    localStorage.setItem("lastFilterPosition", newPosition + defaultLimit);
}

// Name filter input
const filterInput = document.getElementById("filter-input");
let filterTimeout;
filterInput.onkeyup = function() {
    clearTimeout(filterTimeout);

    // Delay to allow brief typing period
    filterTimeout = setTimeout(function() {

        document.body.classList.add("is-loading");
        filterInput.parentNode.classList.add("is-loading");

        filterSpecificationsByName(filterInput.value);

    }, 300);
};

/**
 * Filter results by name
 */
async function filterSpecificationsByName(name) {
    try {
        let currentOrder = localStorage.getItem("lastFilterOrder");
        if (!currentOrder) {
            currentOrder = defaultOrder;
        }

        // Create OData filter (contains name)
        const query = `$filter=contains(tolower(name), tolower('${escapeStringForOData(name)}')) and StateType ne 'Running'&$orderby=DateEdited ${currentOrder}&$top=${defaultLimit}`;

        // Reset stage
        resetFilterPosition();

        // Return results based on name query
        getSpecificationsWithQuery(query, true)

        // Save filtered name (to restore on reload)
        localStorage.setItem("lastFilterName", name);
    } catch (error) {
        handleGenericError(error);
    }
}

/**
 * Ensure string is valid for use in OData
 */
function escapeStringForOData(string) {
    return cleanString = encodeURIComponent(string.replace(/'/g, "''"));
}

/**
 * Reverse results order
 */
const lastOrder = localStorage.getItem("lastFilterOrder");
let filterOrder = (lastOrder ? lastOrder : defaultOrder);

const reverseAction = document.getElementById("filter-reverse");
reverseAction.onclick = function () {

    // Show loading state
    this.classList.add("is-loading");
    document.body.classList.add("is-loading");
    window.scroll(0,0);

    // Switch stored order
    filterOrder = (filterOrder === "desc" ? "asc" : "desc");

    // Flip order in query items
    let query = "$orderby=DateEdited " + filterOrder + "&$top=" + defaultLimit;

    // Filter with name (if set)
    const filterName = localStorage.getItem("lastFilterName");
    if (filterName) {
        query += "&$filter=startswith(tolower(name), tolower('" + filterName + "'))";
    }

    // Reset stage
    resetFilterPosition();

    // Render in new order
    getSpecificationsWithQuery(query, true);

    // Stored new order
    localStorage.setItem("lastFilterOrder", filterOrder);
};

/**
 * Expand/collapse Properties
 */
const filterExpand = document.getElementById("filter-expand");
filterExpand.onclick = function () {
    document.body.classList.toggle("history-expanded");
    this.innerHTML = (this.innerHTML === "Collapse" ? "Expand" : "Collapse");
};

/**
 * Reset filters buttons
 */
const filterReset = document.getElementById("filter-reset");
filterReset.onclick = function () {

    // Show loading state
    this.classList.add("is-loading");
    document.body.classList.add("is-loading");
    window.scroll(0,0);

    // Clear stored query
    localStorage.removeItem("lastFilterName");
    localStorage.removeItem("lastFilterOrder");
    localStorage.removeItem("lastFilterPosition");

    // Clear input
    filterInput.value = "";

    // Allow lazy loading
    blockLazyLoading = false;

    // Update list
    const oDataQueryString = getStoredQuery();
    getSpecificationsWithQuery(oDataQueryString, true);
};

/**
 * Add loading state
 */
function addLoadingState() {

    // Add loading element
    const loading = document.createElement("div");
    loading.classList.add("history-loading", "history-skeleton");

    const markup = `
        <div class="skeleton-block"></div>
        <div class="skeleton-block"></div>
        <div class="skeleton-block"></div>
        <div class="skeleton-block"></div>
    `;
    loading.innerHTML = markup;

    historyList.appendChild(loading);
}

/**
 * Clear loading states
 */
function clearLoadingState() {

    // Reset loading state (delay to stop potential overlap)
    setTimeout(() => {
        isLoadingHistory = false;
    }, 250);

    // Remove inline loading indicators (lazy-load)
    document.querySelectorAll(".history-loading").forEach(e => e.remove());
}

/**
 * Clear list
 */
function clearHistoryList() {
    historyList.innerHTML = "";
}

/**
 * Clear actions loading states
 */
function clearActionsLoading() {

    // Name input
    filterInput.parentNode.classList.remove("is-loading")

    // Buttons
    const actions = document.querySelectorAll(".history-controls button")
    for (let i = 0; i < actions.length; i++) {
        actions[i].classList.remove("is-loading");
    }
}

/**
 * Show/hide empty results message
 */
function showEmptyResults() {

    // Show message
    const markup = "<div class=\"history-empty\">No matching results found.</div>";
    historyList.innerHTML = markup;

    // Clear loading state
    document.body.classList.remove("is-loading");

    clearActionsLoading();
}

function hideEmptyResults() {
    const empty = document.getElementsByClassName("history-empty");
    if (empty.length > 0) {
        empty[0].parentNode.removeChild(empty[0]);
    }
}

/**
 * Reset stored position
 */
function resetFilterPosition() {
    localStorage.removeItem("lastFilterPosition");
    allowLoad = true;
}

/**
* Track sticky header (stuck/unstuck)
*/
const pageHeader = document.querySelector(".history-controls");
const headerObserver = new IntersectionObserver(
    ([e]) => e.target.classList.toggle("is-stuck", e.intersectionRatio < 1),
    { threshold: [1] }
);
headerObserver.observe(pageHeader);
