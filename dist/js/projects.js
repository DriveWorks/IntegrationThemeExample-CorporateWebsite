/**
 * PROJECTS
 */

const CREDENTIALS = config.credentials;
const projectsList = document.getElementById("project-list");

/**
 * Start page functions.
 */
async function startPageFunctions() {

    // After short delay, show loading state (skip loading state entirely if very quick loading)
    const loadingTimeout = setTimeout(() => {
        projectsList.style.opacity = "";
    }, 1000);

    try {
        setCustomClientErrorHandler();

        // Get Projects
        const projects = await client.getProjects(GROUP_ALIAS);
        clearTimeout(loadingTimeout);

        // (Optional) Order Projects alphabetically by alias
        const orderedProjects = sortProjectsByAlias(projects);

        // Render Projects
        renderProjects(orderedProjects);

    } catch (error) {
        handleGenericError(error);
    }
};

/**
 * Render Projects to container.
 * 
 * @param {Object} projects - ProjectData object.
 */
function renderProjects(projects) {

    // Clear loading state, show list
    projectsList.innerHTML = "";
    projectsList.style.opacity = "";

    // Empty state
    if (!projects || !projects.length) {
        projectsList.innerHTML = `
            <div class="empty-projects">
                <p>No Projects available.</p>
            </div>
        `;
        return;
    }

    // Loop out Projects
    for (let index = 0; index < projects.length; index++) {
        const project = projects[index];
        const name = project.alias || project.name;
        const description = project.description;
        let imagePath = project.absoluteImagePath;
        if (!imagePath) {
            imagePath = "dist/img/placeholder.png";
        }

        const markup = `
            <div class="inner">
                <div class="project-image">
                    <div class="image" style="background-image: url('${imagePath}');"></div>
                </div>
                <h4 class="project-name">${name}</h4>
                ${description && '<div class="project-description">' + description + "</div>"}
                <div class="project-action">Create</div>
            </div>
        `;

        // Create Project item
        const item = document.createElement("a");
        item.classList.add("project-item");
        item.style.setProperty("--index", index);
        item.setAttribute("data-id", project.id);
        item.setAttribute("data-name", project.name);
        item.href = `run.html?project=${project.name}`;
        item.title = "Create Specification: " + name;
        item.innerHTML = markup;

        projectsList.appendChild(item);

        // Animate entrance (hidden by default)
        item.classList.add("animate");
    }
}

/**
 * Order Projects alphabetically by alias - using name if unavailable.
 * @param {Object} projects - The unsorted Projects to order.
 */
function sortProjectsByAlias(projects) {
    return projects.sort((a, b) => {
        const nameA = a.alias || a.name;
        const nameB = b.alias || b.name;
        return nameA.localeCompare(nameB, undefined, { numeric: true, caseFirst: "upper" });
    });
}
